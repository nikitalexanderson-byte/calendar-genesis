import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dateSerial, ganttRange, serialDate, taskSpan, ganttSchedule } from "../app/shared-gantt.ts";
import { stoicheionReadingSections } from "../app/stoicheion-reading.ts";

test("Gantt keeps all-day dates inclusive and timed spans exact across day boundaries",()=>{
  assert.deepEqual(taskSpan({startDate:"2026-10-10",dueDate:"2026-10-12"}),{start:dateSerial("2026-10-10"),end:dateSerial("2026-10-13"),timed:false});
  const span=taskSpan({startDate:"2026-10-10",dueDate:"2026-10-11",startTime:"23:00",endTime:"01:30"});
  assert.ok(Math.abs((span.end-span.start)*24-2.5)<1e-8);
  assert.equal(taskSpan({dueDate:null}),null);
  assert.equal(taskSpan({dueDate:"2026-10-10"}).end-taskSpan({dueDate:"2026-10-10"}).start,1);
  assert.equal(serialDate(dateSerial("2026-10-25")+1),"2026-10-26");
});
test("Gantt drops snap to minutes or dates and preserve duration including overnight spans",()=>{
  const task={startDate:"2026-10-10",dueDate:"2026-10-11",startTime:"23:00",endTime:"01:30"};
  assert.deepEqual(ganttSchedule(task,dateSerial("2026-10-12")+10.16/24,"day"),{startDate:"2026-10-12",dueDate:"2026-10-12",startTime:"10:15",endTime:"12:45"});
  assert.deepEqual(ganttSchedule(task,dateSerial("2026-10-25"),"weeks"),{startDate:"2026-10-25",dueDate:"2026-10-26",startTime:"23:00",endTime:"01:30"});
  assert.deepEqual(ganttSchedule({startDate:"2026-10-10",dueDate:"2026-10-12"},dateSerial("2026-10-13"),"days"),{startDate:"2026-10-13",dueDate:"2026-10-15",startTime:null,endTime:null});
  assert.deepEqual(ganttSchedule({},dateSerial("2026-10-10")+23.75/24,"day"),{startDate:"2026-10-10",dueDate:"2026-10-11",startTime:"23:45",endTime:"00:45"});
});
test("Gantt scales and fitted ranges preserve the selected day and bound large projects",()=>{
  const day=dateSerial("2026-10-10");
  assert.deepEqual(ganttRange("2026-10-10","day",[],true),{start:day,end:day+1});
  assert.equal(serialDate(ganttRange("2026-10-10","days",[]).start),"2026-10-05");
  const fit=ganttRange("2026-10-10","months",[{startDate:"2026-01-01",dueDate:"2030-01-01"}],true);
  assert.equal(fit.end-fit.start,366);
});
test("The translated reading catalog retains all 24 consistently grouped descriptions",()=>{
  const cards=JSON.parse(readFileSync(new URL("../app/catalog-translations/en.json",import.meta.url),"utf8")).stoicheion;
  assert.equal(Object.keys(cards).length,24);
  for(const [id,card] of Object.entries(cards)) {
    const sections=stoicheionReadingSections(card.content);
    assert.ok(sections.length>=5,id);
    assert.ok(sections.every(section=>section.heading.length<65&&section.body.length>0),id);
  }
});
const source=readFileSync(new URL("../app/stoicheion-data.ts",import.meta.url),"utf8");
const ru=[...source.matchAll(/id: "([^"]+)"[\s\S]*?content: ("(?:[^"\\]|\\.)*")/g)].map(match=>({id:match[1],content:JSON.parse(match[2])}));
test("All 24 authored cards have full, consistently grouped reading sections",()=>{
  assert.equal(ru.length,24);
  for(const card of ru){
    const sections=stoicheionReadingSections(card.content);
    for(const heading of ["Космогонический профиль","Магическая настройка и Корень — ῥίζα","Парадное положение","Перевернутое положение","Практика и магическая поза"]){
      const matching=sections.filter(section=>section.heading===heading);
      assert.equal(matching.length,1,`${card.id}: ${heading}`);
      assert.ok(matching[0].body.length>40,`${card.id}: empty ${heading}`);
    }
    assert.ok(sections.every(section=>section.heading.length<65 && section.body.length>0),card.id);
    const body=sections.map(section=>section.body).join("\n");
    for(const field of ["Заклинание:","Божество:","Центр в теле:","Медитация:","Магическая поза:","Работа с телом:"]){assert.ok(body.includes(field),`${card.id}: ${field}`);}
    for(const line of card.content.split("\n").filter(line=>/^\s*-\s/.test(line))){assert.ok(body.includes(line),`${card.id}: lost authored bullet`);}
  }
});
