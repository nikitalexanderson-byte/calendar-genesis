import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { calendarModule } from "./helpers/calendar-modules.mjs";

const model = calendarModule("app/stoicheion-restoration-strategy.ts");
const commit = calendarModule("app/stoicheion-restoration-commit.ts");
const { EMPTY_HABIT_WORKSPACE } = calendarModule("app/habits.ts");
const { RESTORATION_SECTORS, RESTORATION_LETTER_FOCI, RESTORATION_AUXILIARIES } = calendarModule("app/stoicheion-restoration-data.ts");
const { SACRED_PRACTICES } = calendarModule("app/sacred-practices.ts");
const { restorationLocal, restorationCopy } = calendarModule("app/stoicheion-restoration-copy.ts");
const languages = ["ru","en","el","de","fr","es","it","pt","pl","sr","uk","zh","tr","ja"];
const options = {today:"2026-10-22",startedAt:"2026-10-22T10:00:00Z",calendarMode:"sacred",language:"ru"};
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const source = {version:1,sourceDate:"2026-10-22",sourceSeed:305419896,
    cards:["mu","psi","omega","theta","upsilon","chi","omicron","pi","beta"].map((letterId,index) => ({letterId,reversed:index%2===0})),activeSectorId:"northwest",plans:{}};
  for (const id of model.reversedSectors(source)) {
    const guidance = RESTORATION_SECTORS.find(item => item.id===id).needs.conflict;
    const plan = {need:"conflict",supportIds:[guidance.supportId],resourceLetterId:"",intention:guidance.intention.ru,linkedHabitId:"",step:3,prepared:true,touched:true};
    plan.resourceLetterId = model.restorationPlanEquation(source,id,plan).candidates[0].id;
    source.plans[id] = plan;
  }
  return source;
}
function workspace() { return clone(EMPTY_HABIT_WORKSPACE); }

test("every reversed card has its own validated draft and choices survive serialization", () => {
  const draft = fixture();
  draft.plans.northwest.intention="Моё собственное намерение";
  draft.activeSectorId="southeast";
  const recovered=model.validateRestorationStrategy(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(recovered,draft);
  recovered.plans.northwest.supportIds.push("exit");
  assert.notDeepEqual(recovered.plans.northwest.supportIds,draft.plans.northwest.supportIds);
  assert.equal(model.restorationPreparedCount(draft,[]),5);
  for (const mutate of [value=>{value.cards[0].letterId="beta";},value=>{value.plans.northwest.resourceLetterId="nonexistent";},value=>{delete value.plans.southeast;},value=>{value.sourceDate="2026-02-30";}]) {
    const invalid=clone(draft);mutate(invalid);assert.throws(()=>model.validateRestorationStrategy(invalid));
  }
});
test("saving the whole strategy creates all practices atomically, preserves the draw, and prevents duplicates", () => {
  const source=fixture(),before=workspace(),original=clone(before);
  const result=commit.materializeRestorationStrategy(source,before,options);
  assert.deepEqual(before,original);
  assert.equal(result.habits.length,5);
  for(const habit of result.habits){assert.deepEqual(habit.stoicheionRestoration.cards,source.cards);assert.equal(habit.stoicheionRestoration.sourceSeed,source.sourceSeed);assert.equal(habit.schedule.recurrence.enabled,true);}
  assert.equal(commit.materializeRestorationStrategy(source,result,options).habits.length,5);
  const partial={...result,habits:result.habits.slice(0,2)};
  assert.equal(commit.materializeRestorationStrategy(source,partial,options).habits.length,5);
  const invalid=clone(source);invalid.plans.southeast.prepared=false;
  assert.throws(()=>commit.materializeRestorationStrategy(invalid,before,options),/INCOMPLETE/);
  assert.deepEqual(before,original);
  assert.throws(()=>commit.materializeRestorationStrategy(source,{...before,habitSettings:{...before.habitSettings,enabled:false}},options),/DISABLED/);
});
test("provenance compares all nine cards, and saved copies remain independent", () => {
  const source=fixture(),saved=commit.materializeRestorationStrategy(source,workspace(),options);
  const snapshot=saved.habits[0].stoicheionRestoration;
  const another=clone(source);another.cards[1].reversed=!another.cards[1].reversed;
  assert.equal(model.snapshotMatchesSource(snapshot,another),false);
  const copy={...clone(saved.habits[0]),id:crypto.randomUUID()};
  const withCopy={...saved,habits:[...saved.habits,copy]};
  const result=commit.materializeRestorationStrategy(source,withCopy,options);
  assert.equal(result.habits.length,6);assert.equal(result.habits.filter(habit=>habit.stoicheionRestoration.cycleId===snapshot.cycleId).length,2);
});
test("one existing habit cannot be assigned to two different cards", () => {
  const source=fixture(),before=workspace();
  const initial=commit.materializeRestorationStrategy(source,before,options).habits[0];
  const habit={...initial,id:crypto.randomUUID(),stoicheionRestoration:undefined,practiceGoal:null};
  const [a,b]=model.reversedSectors(source);source.plans[a].linkedHabitId=habit.id;source.plans[b].linkedHabitId=habit.id;
  assert.throws(()=>commit.materializeRestorationStrategy(source,{...before,habits:[habit]},options),/DUPLICATE_HABIT/);
  assert.equal(habit.stoicheionRestoration,undefined);
});
test("all 14 languages cover every recommendation, preserve source indexes, and fit saved snapshots", () => {
  const sources=new Map();
  const collect=value=>{if(!value||typeof value!=="object")return;if(typeof value.ru==="string"&&typeof value.en==="string"){if(!sources.has(value.en))sources.set(value.en,value);}else Object.values(value).forEach(collect);};
  const content=JSON.parse(readFileSync(new URL("../app/stoicheion-restoration-content.json",import.meta.url),"utf8"));collect(content);
  const helpers=RESTORATION_AUXILIARIES.map(item=>SACRED_PRACTICES.find(practice=>practice.id===item.practiceId));helpers.forEach(helper=>{collect(helper.title);collect(helper.description);});
  const sourceHash=createHash("sha256").update(JSON.stringify([...sources.keys()])).digest("hex");
  const keys=Object.keys(restorationCopy("en")).sort();
  for(const language of languages){
    const copy=restorationCopy(language);assert.deepEqual(Object.keys(copy).sort(),keys,language);
    for(const text of Object.values(copy))assert.ok(typeof text==="string"&&text.trim(),language);
    if(!["ru","en"].includes(language)){
      const locale=JSON.parse(readFileSync(new URL(`../app/stoicheion-restoration-locales/${language}.json`,import.meta.url),"utf8"));
      assert.equal(locale.sourceHash,sourceHash,language);assert.equal(locale.values.length,sources.size,language);
    }
    for(const text of sources.values()){
      const localized=restorationLocal(text,language);assert.ok(localized?.trim(),`${language}: ${text.en}`);
      if(!["ru","en"].includes(language))assert.notEqual(localized,text.en,`${language}: English fallback: ${text.en}`);
      assert.doesNotMatch(localized,/ZXQ|⟦\d+⟧|〔\d+〕|\bTODO\b/u,language);
      if(!["ru","sr","uk"].includes(language))assert.doesNotMatch(localized,/\p{Script=Cyrillic}/u,language);
    }
    const helperText=helpers.map(helper=>`${restorationLocal(helper.title,language)}: ${restorationLocal(helper.description,language)}`).join("\n\n");
    for(const sector of RESTORATION_SECTORS)for(const need of ["deficit","excess","conflict"])for(const focus of Object.values(RESTORATION_LETTER_FOCI)){
      const action=[restorationLocal(sector.needs[need].action,language),restorationLocal(focus.needs[need].action,language),helperText].join("\n\n");
      assert.ok(action.length<=1600,`${language}: ${sector.id}/${need}: ${action.length} > 1600`);
    }
  }
});
