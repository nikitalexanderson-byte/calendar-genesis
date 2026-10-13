"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Mindmaps, { type MindmapTaskRequest } from "./Mindmaps";
import { SharedTaskCreate } from "./SharedTaskCreate";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import { loadSharedProject, approveSharedTask, updateSharedTask, captureAccountSessionGuard,
  type GenesisProject, type GenesisTask, type SharedProject, type SharedProjectSnapshot, type SharedSpace, type SharedTask } from "./cloud-sync";
import type { CalendarMode } from "./calendar-data";
import type { TimeFormat } from "./time-format";

type Props = {userId:string;space:SharedSpace;projects:SharedProject[];projectId:string;language:string;enabledCalendars:CalendarMode[];timeFormat:TimeFormat;
  onClose:()=>void;onTask:(task:SharedTask,snapshot:SharedProjectSnapshot)=>void;onProject:(id:string,calendar?:boolean)=>void};

function mapTask(task:SharedTask, snapshot:SharedProjectSnapshot):GenesisTask {
  return {id:task.id,title:task.title,description:task.description,projectId:task.projectId,project:snapshot.project.title,
    sacredYear:1,monthIndex:0,day:1,dueDate:task.dueDate??"",endDate:"",time:task.startTime??"",endTime:task.endTime??"",
    entryType:task.entryType,categoryId:task.categoryId,tags:task.tags??[],dependsOnIds:task.dependsOnIds??[],priority:0,
    done:Boolean(task.completedAt || snapshot.statuses.find(status=>status.id===task.statusId)?.isDone),completedAt:task.completedAt??null,
    reminders:[],reminderMinutes:null,recurrence:"none",recurrenceMode:"none",recurrencePattern:"none",recurrenceInterval:1,
    recurrenceDays:[],recurrenceStartDate:null,recurrenceEndDate:null,recurrenceMonths:[],recurrencePyatas:[],recurrenceExcludedDates:[],recurrenceSeriesId:null,
    calendarMode:"profane",calendarNote:"",syncToGoogle:false,syncAccountIds:[],googleLinks:{},googleAccountId:null,googleAccountEmail:"",
    createdIn:"genesis",googleEventId:null,googleTaskId:null,googleTaskListId:null,googleTaskListTitle:"",
    googleReadOnly:false,updatedAt:Date.parse(task.updatedAt)};
}
function ConversionDialog({request,language,enabledCalendars,timeFormat,space,projectId,onClose,onSaved}:Props & {request:MindmapTaskRequest;onSaved:(task:SharedTask)=>Promise<void>}) {
  const ref=useDialogAccessibility<HTMLDivElement>(onClose);
  return <div className="modal-backdrop"><div className="editor-modal task-composer-modal" role="dialog" aria-modal="true" aria-label="Создать общую задачу" ref={ref} tabIndex={-1}>
    <header><h2>Создать общую задачу</h2><button type="button" aria-label="Закрыть" onClick={onClose}><ExperimentalIcon name="close"/></button></header>
    <SharedTaskCreate language={language} enabledCalendars={enabledCalendars} timeFormat={timeFormat}
      initialSpaceId={space.id} fixedSpaceId={space.id} initialProjectId={request.projectId??projectId}
      initialTitle={request.title} mindmapSource={{mapId:request.mapId,nodeId:request.nodeId}} onSaved={onSaved}/>
  </div></div>;
}
export default function SharedMindmaps(props:Props) {
  const [snapshots,setSnapshots]=useState<SharedProjectSnapshot[]>([]);
  const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [conversion,setConversion]=useState<MindmapTaskRequest|null>(null);
  const live=useRef(true);const guard=useRef(captureAccountSessionGuard());
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const refresh=useCallback(async()=>{
    guard.current();const rows=await Promise.all(props.projects.map(project=>loadSharedProject(project.id)));guard.current();
    if(live.current){setSnapshots(rows);setError("");setLoading(false);}
  },[props.projects]);
  useEffect(()=>{let active=true;void refresh().catch(e=>{if(active&&live.current){setError(e instanceof Error?e.message:String(e));setLoading(false);}});return()=>{active=false;};},[refresh]);
  useEffect(()=>{const update=()=>{void refresh().catch(e=>{if(live.current)setError(String(e));});};window.addEventListener("genesis:shared-updates",update);return()=>window.removeEventListener("genesis:shared-updates",update);},[refresh]);
  const projects:GenesisProject[]=snapshots.filter(row=>!row.project.isInbox).map(({project},position)=>({id:project.id,parentId:project.parentId,
    categoryId:project.categoryId??null,title:project.title,description:project.description,tags:project.tags??[],status:"active",position}));
  const tasks=snapshots.flatMap(row=>row.tasks.filter(task=>!task.pending).map(task=>mapTask(task,row)));
  const find=(task:GenesisTask)=>{const snapshot=snapshots.find(row=>row.project.id===task.projectId);return {snapshot,source:snapshot?.tasks.find(value=>value.id===task.id)};};
  if(loading)return <section><button type="button" onClick={props.onClose}>К общим делам</button><p role="status">Открываем зашифрованные карты…</p></section>;
  if(error && !snapshots.length)return <section><button type="button" onClick={props.onClose}>К общим делам</button><p role="alert">{error}</p><button type="button" onClick={()=>void refresh().catch(e=>setError(String(e)))}>Обновить</button></section>;
  return <div className="shared-mindmaps-workspace" data-space-id={props.space.id}>
    {error ? <p role="alert">{error}</p> : null}
    <Mindmaps key={props.space.id} userId={props.userId} spaceId={props.space.id} readOnly={!(props.space.permissions?.editTasks??props.space.role!=="guest")}
      tasks={tasks} projects={projects} projectId={null} projectForTask={task=>snapshots.find(row=>row.project.id===task.projectId)?.project.isInbox ? null : task.projectId}
      taskCanEdit={task=>{const project=snapshots.find(row=>row.project.id===task.projectId)?.project;return Boolean(project&&(project.permissions?.editTasks ?? ["owner","manager","member"].includes(project.role)));}}
      onClose={props.onClose} onCreateTask={setConversion}
      onEditTask={task=>{const {snapshot,source}=find(task);if(snapshot&&source)props.onTask(source,snapshot);}}
      onToggleTask={task=>{const {snapshot,source}=find(task);if(!snapshot||!source)return;void (async()=>{
        if(task.done){const status=snapshot.statuses.find(value=>!value.isDone);if(!status)return;await updateSharedTask(source.projectId,source.id,{statusId:status.id,expectedRevision:source.revision});}
        else if(source.approvalRequired) await approveSharedTask(source.projectId,source.id);
        else {const status=snapshot.statuses.find(value=>value.isDone);if(!status)return;await updateSharedTask(source.projectId,source.id,{statusId:status.id,expectedRevision:source.revision});}
        await refresh();
      })().catch(e=>setError(e instanceof Error?e.message:String(e)));}}
      onCalendar={task=>{if(task.projectId)props.onProject(task.projectId,true);}} onProject={id=>props.onProject(id)}/>
    {conversion ? <ConversionDialog {...props} request={conversion} onClose={()=>setConversion(null)} onSaved={async task=>{
      guard.current();await conversion.repository.journal({mapId:conversion.mapId,nodeId:conversion.nodeId,taskId:task.id});
      guard.current();await refresh();if(live.current)setConversion(null);
    }}/> : null}
  </div>;
}
