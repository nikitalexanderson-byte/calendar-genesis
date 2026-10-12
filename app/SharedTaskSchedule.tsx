"use client";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { TimeClockPicker } from "./TimeClockPicker";
import type { CalendarMode } from "./calendar-data";
import type { SharedTask } from "./cloud-sync";
import type { TimeFormat } from "./time-format";
export type SharedPlan = {startDate:string;startTime:string;endTime:string;dependsOnIds:string[]};
export const emptySharedPlan = ():SharedPlan=>({startDate:"",startTime:"",endTime:"",dependsOnIds:[]});
export const taskSharedPlan = (task:SharedTask):SharedPlan=>({startDate:task.startDate||"",startTime:task.startTime||"",endTime:task.endTime||"",dependsOnIds:task.dependsOnIds||[]});
export function SharedTaskSchedule({plan,onChange,dueDate,onDueDate,mode,timeFormat,english,tasks,taskId}:{plan:SharedPlan;onChange:(value:SharedPlan)=>void;dueDate:string;onDueDate:(value:string)=>void;mode:CalendarMode;timeFormat:TimeFormat;english:boolean;tasks:SharedTask[];taskId?:string}) {
  const today=new Date();const key=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const invalid = plan.startDate && dueDate && plan.startDate>dueDate || plan.startTime && plan.endTime && (!plan.startDate || !dueDate || plan.startDate===dueDate) && plan.startTime>=plan.endTime;
  return <fieldset className="shared-task-schedule"><legend>{english ? "Schedule and dependencies" : "Сроки и зависимости"}</legend>
    <div className="shared-task-date-pair">{([{title:english ? "Start date" : "Начало",value:plan.startDate,set:(value:string)=>onChange({...plan,startDate:value,...(!value&&!dueDate ? {startTime:"",endTime:""} : {})})},{title:english ? "Due date" : "Окончание",value:dueDate,set:(value:string)=>{onDueDate(value);if(!value&&!plan.startDate)onChange({...plan,startTime:"",endTime:""});}}]).map(field=><div className="shared-projects-date-field" key={field.title}><span>{field.title}</span><CalendarDatePicker mode={mode} value={field.value} onChange={field.set} ariaLabel={field.title}/><button type="button" onClick={()=>field.set(field.value ? "" : key)}>{field.value ? (english ? "Clear" : "Убрать дату") : (english ? "Set date" : "Задать дату")}</button></div>)}</div>
    <label className="shared-projects-checkbox"><input type="checkbox" checked={Boolean(plan.startTime||plan.endTime)} disabled={!plan.startDate&&!dueDate} onChange={event=>onChange({...plan,startTime:event.target.checked ? "09:00" : "",endTime:event.target.checked ? "10:00" : ""})}/>{english ? "Set hours for the daily timeline" : "Задать часы для таймлайна дня"}</label>
    {plan.startTime||plan.endTime ? <div className="shared-task-date-pair"><label>{english ? "Start time" : "Время начала"}<TimeClockPicker value={plan.startTime} onChange={value=>onChange({...plan,startTime:value})} timeFormat={timeFormat}/></label><label>{english ? "End time" : "Время окончания"}<TimeClockPicker value={plan.endTime} onChange={value=>onChange({...plan,endTime:value})} timeFormat={timeFormat}/></label></div> : null}
    {invalid ? <p role="alert">{english ? "The end must be later than the start." : "Окончание должно быть позже начала."}</p> : null}
    <details><summary>{english ? "Predecessor tasks" : "Предшествующие задачи"} · {plan.dependsOnIds.length}</summary><p>{english ? "Finish these tasks first. Dependencies are shown on the chart." : "Эти задачи должны быть выполнены первыми. Связи отображаются на диаграмме."}</p>
      <div className="shared-dependency-picker">{tasks.filter(task=>task.id!==taskId).map(task=><label key={task.id}><input type="checkbox" checked={plan.dependsOnIds.includes(task.id)} onChange={event=>onChange({...plan,dependsOnIds:event.target.checked ? [...plan.dependsOnIds,task.id] : plan.dependsOnIds.filter(id=>id!==task.id)})}/><span data-no-translate>{task.title}</span></label>)}</div>
      {!tasks.some(task=>task.id!==taskId) ? <p>{english ? "No other tasks yet." : "Других задач пока нет."}</p> : null}
    </details>
  </fieldset>;
}
