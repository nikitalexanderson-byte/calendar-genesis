import { isCivilDate } from "./calendar-context.ts";
import { effectiveHabitMeasurement, habitMeasurementProgress, habitRuleForDate } from "./habit-measurement.ts";
import { scoreHabitFormula } from "./tracker-math.ts";
import type { Habit, HabitCompletion, HabitWorkspace } from "./habits";
import type { TrackerEntity } from "./tracker-core";

export type HabitHistoryValue = Pick<HabitCompletion, "completed" | "qualityValue" | "note"> & {
  completedTimes: string[]; qualityConfirmedAt: string | null;
};
export type HabitHistoryEdit = TrackerEntity & {
  habitId: string; date: string; ruleId: string; epoch: string;
  replaces: string[]; value: HabitHistoryValue; baseline: HabitCompletion | null;
  source: "history" | "import";
};
const canonical=(value:unknown):string=>value&&typeof value==="object"
  ? Array.isArray(value)?`[${value.map(canonical).join(",")}]`
    :`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(",")}}`
  :JSON.stringify(value)??"null";
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const identifier=(value:unknown):value is string=>typeof value==="string"&&value.length>0&&value.length<=512;
const instant=(value:unknown):value is string=>typeof value==="string"&&Number.isFinite(Date.parse(value));

export function habitHistoryValue(value:unknown):HabitHistoryValue {
  if(!object(value)||typeof value.completed!=="boolean"||typeof value.note!=="string"||value.note.length>2000
    ||value.qualityValue!==null&&(!Number.isFinite(value.qualityValue)||Number(value.qualityValue)<-5||Number(value.qualityValue)>10)
    ||value.qualityConfirmedAt!==null&&!instant(value.qualityConfirmedAt)||!Array.isArray(value.completedTimes)
    ||value.completedTimes.length>1440||value.completedTimes.some(time=>typeof time!=="string"||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))
    throw new RangeError("INVALID_HABIT_HISTORY");
  return {completed:value.completed,qualityValue:value.qualityValue as number|null,note:value.note,
    qualityConfirmedAt:value.qualityConfirmedAt as string|null,completedTimes:[...new Set(value.completedTimes as string[])].sort()};
}

/** Immutable history events survive merge/replay; identical IDs cannot change their meaning. */
export function mergeHabitHistoryEdits(...sources:unknown[]):HabitHistoryEdit[] {
  const result=new Map<string,HabitHistoryEdit>();
  for(const source of sources){
    if(!Array.isArray(source))throw new RangeError("INVALID_HABIT_HISTORY");
    for(const value of source){
      if(!object(value)||!identifier(value.id)||!identifier(value.habitId)||!identifier(value.ruleId)
        ||typeof value.date!=="string"||!isCivilDate(value.date)||typeof value.epoch!=="string"||value.epoch.length>160
        ||!instant(value.createdAt)||!instant(value.updatedAt)||value.createdAt!==value.updatedAt
        ||value.version!==1||!["local","pending","synced"].includes(String(value.syncState))
        ||!["history","import"].includes(String(value.source))||!Array.isArray(value.replaces)
        ||value.replaces.some(id=>!identifier(id)||id===value.id))throw new RangeError("INVALID_HABIT_HISTORY");
      const baseline=value.baseline;
      if(baseline!==null&&(!object(baseline)||baseline.habitId!==value.habitId||baseline.date!==value.date
        ||!identifier(baseline.id)||!instant(baseline.createdAt)||!instant(baseline.updatedAt)
        ||!Number.isSafeInteger(baseline.xpAwarded)||Number(baseline.xpAwarded)<0||Number(baseline.xpAwarded)>20))
        throw new RangeError("INVALID_HABIT_HISTORY");
      if(baseline)habitHistoryValue({...baseline,completedTimes:baseline.completedTimes??[],qualityConfirmedAt:baseline.qualityConfirmedAt??null});
      const row={...value,value:habitHistoryValue(value.value),replaces:[...new Set(value.replaces as string[])].sort()} as unknown as HabitHistoryEdit;
      const prior=result.get(row.id);
      if(prior&&canonical({...prior,syncState:"local"})!==canonical({...row,syncState:"local"}))throw new RangeError("HABIT_HISTORY_ID_CONFLICT");
      result.set(row.id,row);
    }
  }
  const rows=[...result.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const byId=new Map(rows.map(row=>[row.id,row]));
  for(const row of rows)for(const id of row.replaces){
    const parent=byId.get(id);
    if(!parent||parent.habitId!==row.habitId||parent.date!==row.date||parent.epoch!==row.epoch||parent.createdAt>row.createdAt)
      throw new RangeError("INVALID_HABIT_HISTORY");
  }
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(row:HabitHistoryEdit)=>{
    if(visiting.has(row.id))throw new RangeError("INVALID_HABIT_HISTORY");
    if(visited.has(row.id))return;visiting.add(row.id);row.replaces.forEach(id=>visit(byId.get(id)!));visiting.delete(row.id);visited.add(row.id);
  };
  rows.forEach(visit);return rows;
}

export function habitHistoryState(events:readonly HabitHistoryEdit[],habitId:string,date:string){
  const rows=events.filter(row=>row.habitId===habitId&&row.date===date);
  const superseded=new Set(rows.flatMap(row=>row.replaces));
  const heads=rows.filter(row=>!superseded.has(row.id));
  const root=rows.filter(row=>!row.replaces.length).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))[0];
  return {rows,heads,baseline:root?.baseline??null,current:heads.length===1?heads[0]:null,conflict:heads.length>1};
}

/** Project the history for statistics, retaining every prior credit even after a correction removes a mark. */
export function projectHabitHistory(habits:readonly Habit[],events:readonly HabitHistoryEdit[],completions:readonly HabitCompletion[],
  measurements:HabitWorkspace["habitMeasurements"]):HabitCompletion[] {
  const output=[...completions];
  const days=new Map(events.map(row=>[`${row.habitId}:${row.date}`,row]));
  for(const row of days.values()){
    const habit=habits.find(item=>item.id===row.habitId);if(!habit||row.date<habit.createdDate)continue;
    const state=habitHistoryState(events,row.habitId,row.date),current=output.find(item=>item.habitId===row.habitId&&item.date===row.date);
    const edit=state.current,value=edit?.value??(state.baseline&&habitHistoryValue({...state.baseline,
      completedTimes:state.baseline.completedTimes??[],qualityConfirmedAt:state.baseline.qualityConfirmedAt??null}));
    output.splice(0,output.length,...output.filter(item=>item.habitId!==row.habitId||item.date!==row.date));
    if(!value){if(current?.xpAwarded)output.push({...current,completed:false,score:0});continue;}
    let completed=value.completed;
    if(effectiveHabitMeasurement(habitRuleForDate(habit,row.date)))completed=habitMeasurementProgress(habit,row.date,measurements).completed
      &&(habit.qualityScale==="none"||Boolean(value.qualityConfirmedAt));
    output.push({...state.baseline,...current,id:state.baseline?.id??current?.id??`habit-completion:${habit.id}:${row.date}`,
      createdAt:state.baseline?.createdAt??state.rows[0].createdAt,updatedAt:edit?.createdAt??state.rows.at(-1)!.createdAt,
      version:Math.max(current?.version??0,state.rows.length),syncState:"local",habitId:habit.id,date:row.date,...value,completed,
      score:scoreHabitFormula(habit.scoringMode,completed,value.qualityValue),xpAwarded:Math.max(state.baseline?.xpAwarded??0,current?.xpAwarded??0)});
  }
  return output;
}

/** Reward calculators see the pre-correction record; statistics see the corrected history. */
export function habitEconomyHistory<T extends Pick<HabitWorkspace,"habitHistory"|"habitCompletions"|"habitMeasurements">>(workspace:T):T {
  if(!workspace.habitHistory?.length)return workspace;
  const days=new Map(workspace.habitHistory.map(row=>[`${row.habitId}:${row.date}`,row]));
  const completions=workspace.habitCompletions.filter(row=>!days.has(`${row.habitId}:${row.date}`));
  for(const row of days.values()){
    const baseline=habitHistoryState(workspace.habitHistory,row.habitId,row.date).baseline;
    if(baseline)completions.push(baseline);
  }
  return {...workspace,habitCompletions:completions,habitMeasurements:workspace.habitMeasurements.filter(row=>!row.historical)};
}
