import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarModule} from './helpers/calendar-modules.mjs';
const c=calendarModule('app/calendar-context.ts'),a=calendarModule('app/calendar-astronomy.ts'),d=calendarModule('app/calendar-data.ts');
const h=calendarModule('app/habits.ts'),goals=calendarModule('app/habit-period-goal.ts'),analysis=calendarModule('app/habit-goal-analysis.ts');
const reports=calendarModule('app/habit-insights.ts'),records=calendarModule('app/habit-insight-analysis.ts');
const recurrence=calendarModule('app/task-recurrence.ts'),schedule=calendarModule('app/personal-task-schedule.ts'),backup=calendarModule('app/habit-backup.ts');
const configurations=[['profane','january'],['profane','march'],['sacred','january'],['lunar','january']];
const zones=['UTC','Europe/Moscow','America/New_York','Pacific/Auckland'];
const dates=['2024-01-01','2024-02-28','2024-02-29','2024-03-01','2024-03-19','2024-03-20','2025-03-29','2026-03-08','2026-03-19','2026-03-20','2026-04-16','2026-11-01'];

test('solar model zoom preserves the focal centre and keeps edge selections inside the drawing',async()=>{
 const {SOLAR_OVERVIEW,fitSolarElement,zoomSolarCamera,clampSolarCamera}=await import('../app/solar-calendar-camera.ts');
 const overview={...SOLAR_OVERVIEW};
 for(const factor of [.5,.25,.1]){
  const zoom=zoomSolarCamera(overview,factor);
  assert.equal(zoom.x+zoom.size/2,2500);assert.equal(zoom.y+zoom.size/2,2500);
 }
 for(const box of [{x:0,y:0,width:20,height:400},{x:4900,y:4900,width:80,height:80},{x:2300,y:3000,width:10,height:1}]){
  const camera=fitSolarElement(box);
  assert.ok(camera.x>=0&&camera.y>=0&&camera.x+camera.size<=5000&&camera.y+camera.size<=5000);
  assert.ok(camera.x<=box.x&&camera.x+camera.size>=box.x+box.width);
  assert.ok(camera.y<=box.y&&camera.y+camera.size>=box.y+box.height);
 }
 assert.deepEqual(zoomSolarCamera(overview,2),overview);
 assert.equal(clampSolarCamera({x:-100,y:9000,size:1}).size,320);
 assert.deepEqual(SOLAR_OVERVIEW,overview);
});

test('supplied solar SVG retains every calendar target and contains only local vector content',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svg=await readFile(new URL('../public/calendar-art/genesis-sacred-calendar-v8.svg',import.meta.url),'utf8');
 assert.equal((svg.match(/data-kind="month"/g)||[]).length,13);
 assert.equal((svg.match(/data-kind="pentad"/g)||[]).length,72);
 assert.equal((svg.match(/class="regular-day"/g)||[]).length,360);
 assert.equal((svg.match(/class="apeiron-day"/g)||[]).length,6);
 assert.doesNotMatch(svg,/<(?:script|foreignObject|image|a)\b|\son\w+=|(?:href|src)="(?:https?:|javascript:|data:)/i);
 for(let month=1;month<=12;month++)for(let day=1;day<=30;day++){
  assert.ok(svg.includes(`data-month="${month}" data-day="${day}"`));
 }
});

test('all four display years share exact boundaries with goals, reports and the full mosaic in every zone',()=>{
 for(const [mode,gregorianYearStart]of configurations)for(const timeZone of zones)for(const date of dates){
  const context=c.calendarContext({timeZone,gregorianYearStart}),year=a.calendarPeriod(date,mode,'year',context),last=c.addCivilDays(year.end,-1);
  const inclusive=d.calendarYearRange(date,mode,context),month=a.calendarPeriod(date,mode,'month',context);
  assert.deepEqual(inclusive,{start:year.start,end:last});
  const goal={version:1,period:'month',metric:'days',target:1,calendar:mode,context};
  assert.deepEqual(goals.habitGoalPeriod(goal,date),month);
  const mosaic=reports.buildHabitYearMosaic([{date:last,status:'perfect',completedCount:1,scheduledCount:1}],last,inclusive);
  assert.equal(mosaic.length,c.civilDayNumber(year.end)-c.civilDayNumber(year.start));
  assert.equal(new Set(mosaic.map(row=>row.date)).size,mosaic.length);
  assert.equal(mosaic[0].date,year.start);assert.equal(mosaic.at(-1).date,last);assert.equal(mosaic.at(-1).status,'perfect');
  const ws=structuredClone(h.EMPTY_HABIT_WORKSPACE),before=JSON.stringify(ws);
  const comparison=records.buildHabitGoalComparison(ws,date,mode,context,new Date(date+'T12:00:00Z'));
  const weekly=reports.buildWeeklyHabitSummary(ws,date,mode,context);
  assert.equal(comparison.start,weekly.startDate);assert.equal(JSON.stringify(ws),before);
 }
});

test('a real 384-day lunar year retains its last opportunity, historical entry, record and export',async()=>{
 const context=c.calendarContext({timeZone:'UTC'}),year=a.lunarYearPeriod(2025,context),last=c.addCivilDays(year.end,-1),count=c.civilDayNumber(year.end)-c.civilDayNumber(year.start);
 assert.ok(count>370);assert.equal(year.monthCount,13);
 const habit={...h.defaultHabit(year.start,'profane'),id:'cross-feature-last',title:'Собственное название · 日本語',createdDate:year.start,createdAt:year.start+'T00:00:00Z'};
 habit.schedule.timezone='UTC';
 const completion={id:'historical-last',habitId:habit.id,date:last,completed:true,version:1,createdAt:last+'T12:00:00Z',updatedAt:last+'T12:00:00Z',xpAwarded:10,score:10,note:'',qualityValue:null,syncState:'local'};
 const ws={...structuredClone(h.EMPTY_HABIT_WORKSPACE),habits:[habit],habitCompletions:[completion]};
 const before=JSON.stringify(ws),range={start:year.start,end:year.end},now=new Date(year.end+'T12:00:00Z');
 const report=analysis.analyzeHabitRange(ws,habit,range,now);
 assert.equal(report.days.length,count);assert.equal(report.days.at(-1).date,last);assert.equal(report.days.at(-1).activity,'completed');
 const record=records.buildAnalyzedHabitPersonalRecord(ws,habit,last,'lunar',date=>({key:d.calendarMonthKey(date,'lunar',context),label:d.formatCalendarMonthValue(date,'lunar',context)}),now);
 assert.equal(record.totalCompletions,1);assert.equal(record.bestMonthCompletions,1);
 const exported=await backup.createHabitBackup(ws,year.end+'T12:00:00Z'),parsed=await backup.parseHabitBackup(JSON.stringify(exported));
 assert.equal(parsed.data.habitCompletions[0].date,last);assert.equal(parsed.data.habitCompletions[0].id,completion.id);
 const csv=backup.buildHabitHistoryCsv(ws);assert.ok(csv.includes(last));
 assert.equal(JSON.stringify(ws),before);
});

test('switching every display context cannot change a saved rule, goal, canonical dates or reward receipts',async()=>{
 const ruleContext=c.calendarContext({timeZone:'America/New_York',gregorianYearStart:'march'});
 const config={...recurrence.DEFAULT_RECURRENCE_CONFIG,enabled:true,mode:'classic',pattern:'monthly',days:[29],months:[],rangeStart:'2024-02-29',rangeEnd:'2024-05-31',calendarContext:ruleContext};
 const [task]=schedule.buildTaskSeries({id:'stable-series',title:'User title',dueDate:'2024-02-29',endDate:'2024-02-29',calendarMode:'profane'},config);
 const dates=recurrence.recurrenceDatesForTask(task);assert.ok(dates.includes('2024-02-29'));
 const habit={...h.defaultHabit('2024-02-01','profane'),id:'saved-goal',periodGoal:{version:1,period:'month',metric:'days',target:1,calendar:'sacred',context:ruleContext}};
 const ws={...structuredClone(h.EMPTY_HABIT_WORKSPACE),habits:[habit],rewardTransactions:[{id:'saved-receipt',sourceId:'historical-opportunity',amount:5,createdAt:'2024-03-20T03:00:00Z'}]};
 const before=JSON.stringify({task,ws}),goalPeriod=goals.habitGoalPeriod(habit.periodGoal,'2024-03-19');
 for(const [mode,gregorianYearStart]of configurations)for(const timeZone of zones){
  const context=c.calendarContext({timeZone,gregorianYearStart});
  d.formatCalendarDateValue(task.dueDate,mode,true,context);d.calendarYearRange(task.dueDate,mode,context);
  reports.buildWeeklyHabitSummary(ws,'2024-03-20',mode,context);
  assert.deepEqual(recurrence.recurrenceDatesForTask({...task,calendarMode:mode}),dates);
  assert.deepEqual(goals.habitGoalPeriod(habit.periodGoal,'2024-03-19'),goalPeriod);
 }
 assert.equal(JSON.stringify({task,ws}),before);
});

test('Today is the actual civil day at midnight in its context, independently of a historical selection',()=>{
 const now=new Date('2026-01-01T00:30:00Z');
 for(const [zone,date]of [['America/New_York','2025-12-31'],['Europe/Moscow','2026-01-01'],['Pacific/Auckland','2026-01-01']]){
  const context=c.calendarContext({timeZone:zone});
  for(const [mode,gregorianYearStart]of configurations){d.calendarYearRange('2024-02-29',mode,{...context,gregorianYearStart});assert.equal(c.todayCivilDate(context,now),date);}
 }
});
