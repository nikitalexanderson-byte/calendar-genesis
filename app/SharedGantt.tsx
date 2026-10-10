"use client";
import { useRef, useState, type CSSProperties } from "react";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { formatCalendarDate, type CalendarMode } from "./calendar-data";
import type { SharedProjectSnapshot, SharedTask } from "./cloud-sync";
import { dateSerial, serialDate, taskSpan, ganttSchedule, type GanttSchedule, type GanttScale } from "./shared-gantt";
import { calendarGanttRange, calendarGanttPeriods, calendarGanttMonths, shiftGanttAnchor, type GanttPeriod } from "./shared-gantt-calendar";
import { useAffairDrag } from "./use-affair-drag";
import { formatTimeValue, type TimeFormat } from "./time-format";

export function SharedGantt({snapshot,english,calendarMode,timeFormat,initialDay,onOpen,onSchedule,busy,externalDrop}:{snapshot:SharedProjectSnapshot;english:boolean;calendarMode:CalendarMode;timeFormat:TimeFormat;initialDay?:string;onOpen:(task:SharedTask)=>void;onSchedule:(task:SharedTask,schedule:GanttSchedule)=>void;busy:boolean;externalDrop?:GanttSchedule}) {
  const root=useRef<HTMLElement>(null);
  const grabOffset=useRef(0);
  const canEdit=snapshot.project.permissions?.editTasks ?? ["owner","manager","member"].includes(snapshot.project.role);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [anchor,setAnchor] = useState(initialDay || todayKey);
  const [scale,setScale] = useState<GanttScale>(initialDay ? "day" : "weeks");
  const [fit,setFit] = useState(false);
  const range = calendarGanttRange(anchor,scale,snapshot.tasks,calendarMode,fit);
  const pxPerDay = scale === "day" ? 1152 : scale === "months" ? 14 : scale === "weeks" ? 24 : 72;
  const width = (range.end-range.start)*pxPerDay;
  const ticks = calendarGanttPeriods(range,scale,calendarMode);
  const months = scale !== "day" && scale !== "months" ? calendarGanttMonths(range,calendarMode) : [];
  const periodStyle = (period:GanttPeriod) => ({left:(Math.max(range.start,period.start)-range.start)*pxPerDay,width:(Math.min(period.end,range.end)-Math.max(period.start,range.start))*pxPerDay});
  const gridLines = ticks.map(tick=><i className="shared-gantt-grid-line" key={tick.start} style={{left:periodStyle(tick).left}} aria-hidden="true"/>);
  const rows = snapshot.tasks.map(task=>({task,span:taskSpan(task)})).filter(({span})=>span && (scale !== "day" || span.timed) && span.start<range.end && span.end>range.start);
  const unscheduled = snapshot.tasks.filter(task=>{const span=taskSpan(task);return scale === "day"
    ? !span || !span.timed && span.start<range.end && span.end>range.start : !span;});
  const drag=useAffairDrag<SharedTask,GanttSchedule>((x,y,task)=>{
    const target=document.elementFromPoint(x,y)?.closest<HTMLElement>("[data-gantt-axis]");
    if(busy||!canEdit||!target||!root.current?.contains(target))return null;
    const point=range.start+(x-target.getBoundingClientRect().left)/pxPerDay-grabOffset.current;
    return ganttSchedule(task,Math.max(range.start,Math.min(range.end-(scale==="day" ? 1/96 : 1),point)),scale);
  },onSchedule);
  const dragProps=(task:SharedTask,bar=false)=>{
    const bindings=drag.props(task,!busy&&canEdit&&!task.pending);
    const offset=(x:number,element:HTMLElement)=>{const span=taskSpan(task);grabOffset.current=bar ? (x-element.getBoundingClientRect().left)/pxPerDay+Math.max(0,range.start-(span?.start??range.start)) : 0;};
    return {...bindings,onPointerDown:(event:React.PointerEvent<HTMLElement>)=>{offset(event.clientX,event.currentTarget);bindings.onPointerDown(event);},onTouchStart:(event:React.TouchEvent<HTMLElement>)=>{if(event.touches[0])offset(event.touches[0].clientX,event.currentTarget);bindings.onTouchStart(event);}};
  };
  const drop=drag.target||externalDrop;
  const dropSpan=drop ? taskSpan({...drag.preview?.item,...drop} as SharedTask) : null;
  const positions = new Map(rows.map(({task,span},index)=>[task.id,{x:Math.max(0,((scale === "day" ? span!.start : Math.floor(span!.start))-range.start)*pxPerDay),end:Math.min(width,((scale === "day" ? span!.end : Math.ceil(span!.end))-range.start)*pxPerDay),y:index*56+28}]));
  const formatDate = (key:string)=>formatCalendarDate(new Date(`${key}T12:00:00`),calendarMode);
  const shift = (direction:number)=>{setFit(false);setAnchor(shiftGanttAnchor(anchor,scale,calendarMode,direction));};
  const groupedLabel = calendarMode === "sacred" ? (english ? "Five-day periods" : "Пятидневки") : calendarMode === "lunar" ? (english ? "Ten-day periods" : "Декады") : (english ? "Weeks" : "Недели");
  return <section className="shared-gantt" ref={root} aria-busy={busy} aria-label={english ? "Gantt chart" : "Диаграмма Ганта"}>
    <div className="shared-gantt-tools"><div role="group" aria-label={english ? "Time scale" : "Масштаб времени"}>
      {(["day","days","weeks","months"] as const).map(item=><button type="button" key={item} aria-pressed={scale===item} onClick={()=>{setScale(item);setFit(false);}}>{({day:english ? "Within a day" : "Внутри дня",days:english ? "Days" : "Дни",weeks:groupedLabel,months:english ? "Months" : "Месяцы"})[item]}</button>)}
    </div><div className="shared-gantt-navigation"><button type="button" onClick={()=>shift(-1)} aria-label={english ? "Previous period" : "Предыдущий период"}>←</button>
      <CalendarDatePicker mode={calendarMode} value={anchor} onChange={value=>{setAnchor(value);setFit(false);}} ariaLabel={english ? "Timeline date" : "Дата таймлайна"}/>
      <button type="button" onClick={()=>shift(1)} aria-label={english ? "Next period" : "Следующий период"}>→</button>
      <button type="button" onClick={()=>{setAnchor(todayKey);setFit(false);}}>{english ? "Today" : "Сегодня"}</button>
      {scale!=="day" ? <button type="button" aria-pressed={fit} onClick={()=>setFit(value=>!value)}>{english ? "Fit tasks" : "По задачам"}</button> : null}
    </div></div>
    <p className="shared-gantt-period">{formatDate(serialDate(range.start))}{scale!=="day" ? ` — ${formatDate(serialDate(range.end-1))}` : ""}</p>
    <p className="shared-gantt-help">{english ? "Drag tasks from the inbox or the section below onto the timeline. Move bars by days or in 15-minute steps. Duration is preserved; dependent dates change separately. Open a task for precise entry." : "Перетащите задачу из Хаос-бокса или блока ниже на шкалу. Перемещайте плашки по дням или с шагом 15 минут. Длительность сохраняется, сроки зависимых задач меняются отдельно. Для точного ввода откройте задачу."}</p>
    {snapshot.tasks.length>=500 ? <p role="status">{english ? "Showing the first 500 loaded tasks." : "Показаны первые 500 загруженных задач."}</p> : null}
    <div className="shared-gantt-scroll" role="region" aria-label={english ? "Scrollable timeline" : "Прокручиваемая шкала времени"}>
      <div className="shared-gantt-sheet" style={{"--gantt-width":`${width}px`} as CSSProperties}>
        <div className={`shared-gantt-header${months.length ? " has-months" : ""}`}><strong>{english ? "Task" : "Задача"}</strong><div data-gantt-axis data-gantt-start={range.start} data-gantt-end={range.end} data-gantt-px={pxPerDay} data-gantt-scale={scale}>
          {months.map(month=><span className="shared-gantt-month" key={month.start} style={periodStyle(month)} title={month.label}>{month.label}</span>)}
          {ticks.map(tick=><span className="shared-gantt-tick" key={tick.start} style={periodStyle(tick)} title={scale === "months" ? tick.label : `${formatDate(serialDate(tick.start))} — ${formatDate(serialDate(Math.ceil(tick.end)-1))}`}>{scale === "day" ? formatTimeValue(`${String(Math.round((tick.start-range.start)*24)).padStart(2,"0")}:00`,timeFormat) : tick.label || formatDate(serialDate(tick.start))}</span>)}
        </div></div>
        <div className="shared-gantt-rows">
          {rows.map(({task,span})=>{const status=snapshot.statuses.find(item=>item.id===task.statusId);const pos=positions.get(task.id)!;
            return <div className="shared-gantt-row" key={task.id}><button type="button" className="shared-gantt-name" onClick={()=>onOpen(task)} title={task.title} data-no-translate>{task.title}</button>
              <div className="shared-gantt-track" data-gantt-axis data-gantt-start={range.start} data-gantt-end={range.end} data-gantt-px={pxPerDay} data-gantt-scale={scale}>{gridLines}<button type="button" data-affair-drag-surface {...dragProps(task,true)} className={`shared-gantt-bar${status?.isDone ? " is-done" : ""}`} onClick={()=>onOpen(task)} style={{left:pos.x,width:Math.max(4,pos.end-pos.x),"--bar-color":status?.color||"#2d6c68"} as CSSProperties}
                aria-label={`${task.title} · ${formatDate(serialDate(Math.floor(span!.start)))} ${task.startTime||""} — ${formatDate(task.dueDate||task.startDate!)} ${task.endTime||""}${status?.isDone ? english ? " · Completed" : " · Завершена" : ""}`} title={`${task.title} · ${task.startTime||""}–${task.endTime||""}`}><span data-no-translate>{task.title}</span></button></div>
            </div>;})}
          <div className="shared-gantt-drop-row shared-gantt-row"><strong>{english ? "Drop task here" : "Перенесите задачу сюда"}</strong><div className="shared-gantt-track" data-gantt-axis data-gantt-start={range.start} data-gantt-end={range.end} data-gantt-px={pxPerDay} data-gantt-scale={scale}>{gridLines}{dropSpan ? <span className="shared-gantt-drop-preview" style={{left:(dropSpan.start-range.start)*pxPerDay,width:Math.max(12,Math.min(width,(dropSpan.end-range.start)*pxPerDay)-(dropSpan.start-range.start)*pxPerDay)}}/> : null}</div></div>
          <svg className="shared-gantt-dependencies" width={width} height={rows.length*56} aria-hidden="true">
            {rows.flatMap(({task})=>(task.dependsOnIds||[]).flatMap(id=>{const from=positions.get(id);const to=positions.get(task.id);if(!from||!to)return [];
              const bend=Math.max(from.end+10,to.x+10);return [<g key={`${id}-${task.id}`}><path d={`M ${from.end} ${from.y} H ${bend} V ${to.y-14} H ${to.x} V ${to.y-4}`}/><path d={`M ${to.x-3} ${to.y-8} l 3 4 3 -4`}/></g>];}))}
          </svg>
          {dateSerial(todayKey)>=range.start && dateSerial(todayKey)<range.end ? <div className="shared-gantt-today" style={{left:`calc(var(--gantt-name-width) + ${(dateSerial(todayKey)+(scale==="day" ? (today.getHours()*60+today.getMinutes())/1440 : 0)-range.start)*pxPerDay}px)`}} aria-hidden="true"/> : null}
        </div>
      </div>
    </div>
    {drop ? <p className="shared-gantt-drop-label" role="status">{formatDate(drop.startDate)} {drop.startTime ? formatTimeValue(drop.startTime,timeFormat) : ""} — {formatDate(drop.dueDate)} {drop.endTime ? formatTimeValue(drop.endTime,timeFormat) : ""}</p> : null}
    {!rows.length ? <p>{english ? "No scheduled tasks in this period." : "В этом периоде нет задач с заданным временем."}</p> : null}
    {fit && snapshot.tasks.some(task=>{const span=taskSpan(task);return span && span.end>range.end;}) ? <p role="status">{english ? "The fitted range is limited to one year. Use navigation to see later tasks." : "Общий диапазон ограничен годом. Используйте навигацию для более поздних задач."}</p> : null}
    {unscheduled.length ? <details className="shared-gantt-unscheduled" open><summary>{scale==="day" ? (english ? "Without hours / date" : "Без часов или даты") : (english ? "Without dates" : "Без дат")} · {unscheduled.length}</summary><div>{unscheduled.map(task=><button type="button" key={task.id} onClick={()=>onOpen(task)} data-affair-drag-surface {...dragProps(task)} data-no-translate>{task.title}</button>)}</div></details> : null}
  </section>;
}
