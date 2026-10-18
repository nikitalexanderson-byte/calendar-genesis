"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GenesisApiError, listSharedTemplates, loadSharedTemplate, saveSharedTemplate } from "./cloud-sync";
import { calendarContext, todayCivilDate } from "./calendar-context";
import type { CalendarMode } from "./calendar-data";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { RecordCalendarChoice } from "./RecordCalendarChoice";
import { DialogCloseButton } from "./DialogCloseButton";
import { translateText, type Language } from "./i18n";
import { SharedTemplateApply, SharedTemplateIssues } from "./SharedTemplateApply";
import { SharedTemplateStructure } from "./SharedTemplateStructure";
import { templateError, type SharedTemplate, type SharedTemplateSummary, type TemplateManifest, type TemplateReceipt, type TemplateSave, type TemplateDestinationProject } from "./shared-templates";
import type { TimeFormat } from "./time-format";
import "./shared-templates.css";

export function SharedTemplates({spaceId,projectId,language,mode,timeFormat,canWrite,canCreateProjects,canCaptureProject,source,projects,members,onClose,onAccessLost,onApplied}:{spaceId:string;projectId:string;language:Language;mode:CalendarMode;timeFormat:TimeFormat;canWrite:boolean;canCreateProjects:boolean;canCaptureProject:boolean;
 source?:{taskId?:string;title:string};projects:TemplateDestinationProject[];members:{id:string;title:string}[];onClose:()=>void;onAccessLost:()=>void;onApplied:(receipt:TemplateReceipt)=>Promise<void>}){
 const t=(s:string)=>translateText(s,language),dialog=useRef<HTMLDialogElement>(null);
 const [items,setItems]=useState<SharedTemplateSummary[]>([]),[systems,setSystems]=useState<SharedTemplateSummary[]>([]),[deleted,setDeleted]=useState(false),[cursor,setCursor]=useState<string|null>(null),[hasMore,setHasMore]=useState(false),[loaded,setLoaded]=useState(false);
 const [record,setRecord]=useState<SharedTemplate|null>(null),[draft,setDraft]=useState<{id?:string;cloneTemplateId?:string;projectId:string;title:string;manifest:TemplateManifest;revision:number}|null>(null);
 const captureSource=source??{title:projects.find(project=>project.id===projectId)?.title??""};
 const [capture,setCapture]=useState(Boolean(source)),[captureTitle,setCaptureTitle]=useState(captureSource.title),[captureMode,setCaptureMode]=useState(mode),[captureAnchor,setCaptureAnchor]=useState(()=>todayCivilDate()),[captureContext,setCaptureContext]=useState(()=>calendarContext());
 const [applyOpen,setApplyOpen]=useState(false),[applyDirty,setApplyDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState(""),[conflict,setConflict]=useState(false);
 const lock=useRef(false),live=useRef(true),pending=useRef<{id?:string;command:TemplateSave}|null>(null),dirty=Boolean(draft)||capture&&captureTitle.trim()!==""||applyDirty;
 const libraryWrite=record?.projectId===projectId?record.libraryPermissions?.editTasks??canWrite:canWrite;
 const writableDestination=projects.some(project=>project.canWrite&&!project.archivedAt);
 const refresh=useCallback(async(more=false)=>{
  const response=await listSharedTemplates(spaceId,language,{deleted,cursor:more?cursor:null});if(!live.current)return;
  setItems(old=>more?[...old,...response.templates]:response.templates);if(!more)setSystems(response.systemTemplates);setCursor(response.nextCursor);setHasMore(response.hasMore);setLoaded(true);
 },[spaceId,language,deleted,cursor]);
 useEffect(()=>{live.current=true;const el=dialog.current,previousOverflow=document.body.style.overflow,previousFocus=document.activeElement;
  document.body.style.overflow='hidden';if(el&&!el.open)el.showModal();
  return()=>{live.current=false;if(el?.open)el.close();document.body.style.overflow=previousOverflow;
   if(previousFocus instanceof HTMLElement&&previousFocus.isConnected&&previousFocus!==document.body)previousFocus.focus();else document.querySelector<HTMLButtonElement>('[data-template-trigger]')?.focus();};},[]);
 const selectedSystemId=record?.system?record.id:null,editing=Boolean(draft);
 useEffect(()=>{if(!selectedSystemId||editing)return;const controller=new AbortController();void loadSharedTemplate(selectedSystemId,language,controller.signal).then(value=>{if(!controller.signal.aborted)setRecord(value);}).catch(reason=>{if(!controller.signal.aborted)setError(templateError(reason,language));});return()=>controller.abort();},[selectedSystemId,editing,language]);
 const selectedId=record?.id??null,selectedDeleted=record?.deleted??false,editingExisting=Boolean(draft?.id);
 useEffect(()=>{
  if(!selectedId||selectedId.startsWith('system:'))return;const controller=new AbortController();let checking=false;
  const verify=async()=>{if(checking||lock.current||document.visibilityState==='hidden')return;checking=true;
   try{const value=await loadSharedTemplate(selectedId,language,controller.signal,selectedDeleted);if(!controller.signal.aborted){setRecord(current=>current?.id===selectedId?(editing?{...current,canEdit:value.canEdit,libraryPermissions:value.libraryPermissions}:value):current);if(editingExisting&&value.canEdit===false)setError(translateText('Нет доступа',language));}}
   catch(reason){if(controller.signal.aborted)return;if(reason instanceof GenesisApiError&&(reason.status===403||reason.status===404)){
     setRecord(null);setDraft(null);setApplyOpen(false);setApplyDirty(false);pending.current=null;setError(templateError(reason,language));
     if(reason.status===403||reason.payload?.error==='SHARED_PROJECT_NOT_FOUND')onAccessLost();
   }}finally{checking=false;}};
  const check=()=>{void verify();};window.addEventListener('focus',check);window.addEventListener('genesis:shared-updates',check);const timer=window.setInterval(check,30000);
  return()=>{controller.abort();window.removeEventListener('focus',check);window.removeEventListener('genesis:shared-updates',check);window.clearInterval(timer);};
 },[selectedId,selectedDeleted,editing,editingExisting,language,onAccessLost]);
 useEffect(()=>{const controller=new AbortController();void listSharedTemplates(spaceId,language,{deleted},controller.signal).then(response=>{
  if(!controller.signal.aborted){setItems(response.templates);setSystems(response.systemTemplates);setCursor(response.nextCursor);setHasMore(response.hasMore);setLoaded(true);}
 }).catch(reason=>{if(!controller.signal.aborted)setError(templateError(reason,language));});return()=>controller.abort();},[spaceId,language,deleted]);
 useEffect(()=>{if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 const discard=()=>!dirty||window.confirm(t("Отменить несохранённые изменения шаблона?"));
 const close=()=>{if(busy||!discard())return;onClose();};
 const run=async(work:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError("");setStatus("");try{await work();}catch(reason){if(live.current){setError(templateError(reason,language));if(reason instanceof GenesisApiError&&reason.status===409){setConflict(true);pending.current=null;}}}finally{lock.current=false;if(live.current)setBusy(false);}};
 const choose=(summary:SharedTemplateSummary)=>{if(!discard())return;void run(async()=>{const value=await loadSharedTemplate(summary.id,language,undefined,summary.deleted);if(live.current){setRecord(value);setDraft(null);setCapture(false);setApplyOpen(false);setApplyDirty(false);setConflict(false);pending.current=null;}});};
 const edit=(copy=false)=>{if(!record||!libraryWrite&&copy||!copy&&!record.canEdit||!discard())return;setDraft({...(copy?{cloneTemplateId:record.id}:{id:record.id}),projectId:copy?projectId:record.projectId!,title:record.title,manifest:structuredClone(record.manifest),revision:copy?0:record.revision});setApplyOpen(false);setApplyDirty(false);pending.current=null;setConflict(false);};
 const save=()=>run(async()=>{
  if(!draft)return;const request=pending.current??{id:draft.id,command:{operationId:crypto.randomUUID(),projectId:draft.projectId,title:draft.title,manifest:draft.manifest,expectedRevision:draft.revision,...(draft.cloneTemplateId?{cloneTemplateId:draft.cloneTemplateId}:{})}};pending.current=request;
  const receipt=await saveSharedTemplate(spaceId,request.command,request.id);const value=await loadSharedTemplate(receipt.id,language);await refresh();if(live.current){setRecord(value);setDraft(null);pending.current=null;setConflict(false);setStatus(t("Шаблон сохранён."));}
 });
 const captureNow=()=>run(async()=>{
  const request=pending.current??{command:{operationId:crypto.randomUUID(),projectId,title:captureTitle,sourceProjectId:projectId,...(captureSource.taskId?{sourceTaskId:captureSource.taskId}:{}),capture:{calendarMode:captureMode,calendarContext:captureContext,anchorDate:captureAnchor}}};pending.current=request;
  const receipt=await saveSharedTemplate(spaceId,request.command);const value=await loadSharedTemplate(receipt.id,language);await refresh();if(live.current){setRecord(value);setCapture(false);setDraft(null);pending.current=null;setStatus(t("Шаблон сохранён."));}
 });
 const toggleDeleted=()=>{if(!discard())return;setDeleted(!deleted);setRecord(null);setDraft(null);setCapture(false);setApplyOpen(false);setApplyDirty(false);setLoaded(false);pending.current=null;};
 const markDeleted=()=>run(async()=>{if(!record?.canEdit||record.system)return;if(!record.deleted&&!window.confirm(t("Удалить шаблон? Созданные задачи сохранятся.")))return;
  const request=pending.current??{id:record.id,command:{operationId:crypto.randomUUID(),projectId:record.projectId!,title:record.title,expectedRevision:record.revision,deleted:!record.deleted}};pending.current=request;
  await saveSharedTemplate(spaceId,request.command,record.id);await refresh();if(live.current){setRecord(null);pending.current=null;setStatus(t(record.deleted?"Шаблон восстановлен.":"Шаблон удалён."));}
 });
 return <dialog ref={dialog} className="shared-templates-dialog" aria-labelledby="shared-templates-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{if(live.current)close();}}>
  <header className="template-dialog-heading"><h2 id="shared-templates-title">{t("Шаблоны")}</h2><DialogCloseButton className="template-close" onClick={close}/></header>
  <div className="template-library-layout"><aside className="template-library"><div className="template-actions"><button type="button" disabled={busy} aria-pressed={deleted} onClick={toggleDeleted}>{t(deleted?"Действующие шаблоны":"Удалённые шаблоны")}</button><button type="button" disabled={busy} onClick={()=>void run(()=>refresh())}>{t("Обновить")}</button>
   {canWrite&&canCaptureProject?<button type="button" disabled={busy} onClick={()=>{if(discard()){setCapture(true);setRecord(null);setDraft(null);setApplyOpen(false);setApplyDirty(false);pending.current=null;}}}>{t("Сохранить проект как шаблон")}</button>:null}</div>
   {!deleted&&systems.length?<section><h3>{t("Стартовые шаблоны")}</h3><ul>{systems.map(item=><li key={item.id}><button type="button" disabled={busy} aria-current={record?.id===item.id?'true':undefined} onClick={()=>choose(item)}><strong data-no-translate>{item.title}</strong><small>{t("Системный шаблон")}</small></button></li>)}</ul></section>:null}
   <section><h3>{t(deleted?"Удалённые шаблоны":"Шаблоны пространства")}</h3>{!loaded?<p role="status">{t("Загрузка…")}</p>:!items.length?<p>{t("Сохраните задачу или проект как шаблон, чтобы использовать структуру снова.")}</p>:<ul>{items.map(item=><li key={item.id}><button type="button" disabled={busy} aria-current={record?.id===item.id?'true':undefined} onClick={()=>choose(item)}><strong data-no-translate>{item.title}</strong><small>{t(item.kind==='project'?"Проект":"Задача")} · {new Intl.NumberFormat(language).format(item.taskCount)}</small></button></li>)}</ul>}
   {hasMore?<button type="button" disabled={busy} onClick={()=>void run(()=>refresh(true))}>{t("Показать ещё")}</button>:null}</section>
  </aside>
  <div className="template-library-content">
   {capture?<form onSubmit={event=>{event.preventDefault();void captureNow();}}><fieldset disabled={busy}><legend>{t("Сохранить как шаблон")}</legend><p data-no-translate>{captureSource.title}</p><label>{t("Название шаблона")}<input value={captureTitle} required maxLength={160} onChange={event=>{setCaptureTitle(event.target.value);pending.current=null;}}/></label>
    <RecordCalendarChoice value={captureMode} language={language} onChange={value=>{setCaptureMode(value);pending.current=null;}}/>
    <div className="template-grid"><label>{t("Начало года")}<select value={captureContext.gregorianYearStart} onChange={event=>{setCaptureContext({...captureContext,gregorianYearStart:event.target.value as 'january'|'march'});pending.current=null;}}><option value="january">{t("С января")}</option><option value="march">{t("С марта")}</option></select></label><label>{t("Часовой пояс")}<input value={captureContext.timeZone} required onChange={event=>{setCaptureContext({...captureContext,timeZone:event.target.value});pending.current=null;}}/></label></div>
    <div><span className="template-field-label">{t("Базовая дата")}</span><CalendarDatePicker mode={captureMode} calculationContext={captureContext} value={captureAnchor} required ariaLabel={t("Базовая дата")} onChange={value=>{setCaptureAnchor(value);pending.current=null;}}/></div>
    <p>{t("Сроки сохранятся как сдвиг в днях от базовой даты. В редакторе можно выбрать месяцы и годы.")}</p><p>{t("Файлы, изображения и обсуждения не переносятся.")}</p><button type="submit" className="primary-button">{t("Сохранить шаблон")}</button></fieldset></form>:null}
   {draft?<form onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy||(draft.id?record?.canEdit===false:!libraryWrite)}><legend>{t("Редактор шаблона")}</legend><label>{t("Название шаблона")}<input value={draft.title} required maxLength={160} onChange={event=>{setDraft({...draft,title:event.target.value});pending.current=null;}}/></label>
    <SharedTemplateStructure manifest={draft.manifest} language={language} members={members} timeFormat={timeFormat} onChange={manifest=>{setDraft({...draft,manifest});pending.current=null;}}/>
    <p>{t("Изменения шаблона не меняют ранее созданные задачи.")}</p><div className="template-actions"><button type="submit" className="primary-button">{t("Сохранить шаблон")}</button><button type="button" onClick={()=>{if(discard()){setDraft(null);pending.current=null;setConflict(false);}}}>{t("Отмена")}</button>
    {conflict?<button type="button" onClick={()=>{setDraft({...draft,id:undefined,projectId,revision:0,cloneTemplateId:draft.cloneTemplateId??draft.id});pending.current=null;setConflict(false);}}>{t("Сохранить копию")}</button>:null}</div></fieldset></form>:record?<>
    <h3 data-no-translate>{record.title}</h3><p>{t(record.system?"Системный шаблон":"Пользовательский шаблон")} · {t(record.kind==='project'?"Проект":"Задача")}</p>
    <div className="template-actions">{!record.deleted?<><button type="button" disabled={busy||!(record.kind==='project'?canCreateProjects:writableDestination)} onClick={()=>{if(!discard())return;setApplyOpen(!applyOpen);setApplyDirty(false);}}>{t("Применить шаблон")}</button><button type="button" disabled={busy||!libraryWrite} onClick={()=>edit(true)}>{t("Создать копию для редактирования")}</button>{record.canEdit?<button type="button" disabled={busy} onClick={()=>edit()}>{t("Редактировать")}</button>:null}</>:null}
     {record.canEdit?<button type="button" className={record.deleted?'secondary-button':'danger-button'} disabled={busy} onClick={()=>void markDeleted()}>{t(record.deleted?"Восстановить":"Удалить шаблон")}</button>:null}</div>
    {record.notices.length?<details><summary>{t("Изменения и пропуски")}</summary><SharedTemplateIssues issues={record.notices} language={language} record={record}/></details>:null}
    {applyOpen&&!record.deleted?<SharedTemplateApply key={record.id} record={record} spaceId={spaceId} projectId={projectId} projects={projects} language={language} onDirtyChange={setApplyDirty} onApplied={async receipt=>{setApplyDirty(false);await onApplied(receipt);}}/>:<div className="template-overview"><p data-no-translate>{record.manifest.projects[0].description}</p><ul>{record.manifest.projects.map(project=><li key={project.key}><strong data-no-translate>{project.title}</strong><ul>{record.manifest.tasks.filter(task=>task.projectKey===project.key).map(task=><li key={task.key} data-no-translate>{task.title}</li>)}</ul></li>)}</ul></div>}
   </>:!capture?<p>{t("Выберите шаблон, чтобы посмотреть структуру и применить его.")}</p>:null}
   {conflict&&record&&!draft?<button type="button" onClick={()=>choose(record)}>{t("Загрузить актуальную версию")}</button>:null}
   {busy?<p role="status">{t("Загрузка…")}</p>:null}{error?<p role="alert">{error}</p>:null}{status?<p role="status">{status}</p>:null}
  </div></div>
 </dialog>;
}
