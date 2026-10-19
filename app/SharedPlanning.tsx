"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GenesisApiError, querySharedTasks, type SharedProjectSnapshot, type SharedTask } from './cloud-sync';
import { calendarContext, todayCivilDate } from './calendar-context';
import { formatCalendarDateValue, type CalendarMode } from './calendar-data';
import { translateText, type Language } from './i18n';
import { CalendarDatePicker } from './CalendarDatePicker';
import { RecordCalendarChoice } from './RecordCalendarChoice';
import { DialogCloseButton } from './DialogCloseButton';
import { SharedEstimateInputs, SharedEstimateValues } from './SharedTaskEstimates';
import { SharedTaskPageControls } from './SharedTaskPageControls';
import { useSharedTaskPage } from './use-shared-task-page';
import { estimateDraft, estimateInput, loadPlanning, planningAccessLost, planningError, planningText, savePlanning, savePlanningTask, saveSprint, transitionSprint, type PlanningCopyKey, type PlanningTotals, type ProjectPlanning, type SharedSprint, type SprintDraft } from './shared-planning';
import './shared-templates.css';
import './shared-planning.css';
import { SharedWorkflow } from './SharedWorkflow';

type PlanningValues={sprintId?:string|null;storyPoints?:number|null;estimateHours?:number|null};
type Job={invoke:(id:string)=>Promise<unknown>;id:string;after?:(value:unknown)=>void};
type Completion={sprint:SharedSprint;fingerprint:string;tasks:SharedTask[];choices:Record<string,string>};
const stateCopy={planning:'planned',active:'active',completed:'completed'} as const;
function SprintForm({initial,mode,language,disabled,onSave,onCancel}:{initial?:SharedSprint;mode:CalendarMode;language:Language;disabled:boolean;onSave:(draft:SprintDraft)=>void;onCancel:()=>void}){
 const t=(key:PlanningCopyKey)=>planningText(key,language),g=(value:string)=>translateText(value,language);
 const [draft,setDraft]=useState<SprintDraft>(()=>{if(initial)return {title:initial.title,goal:initial.goal,startDate:initial.startDate,endDate:initial.endDate,calendarMode:initial.calendarMode,calendarContext:initial.calendarContext};
  const from=todayCivilDate(),end=new Date(`${from}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+13);return {title:'',goal:'',startDate:from,endDate:end.toISOString().slice(0,10),calendarMode:mode,calendarContext:calendarContext()};});
 return <form className="shared-planning-form" onSubmit={event=>{event.preventDefault();onSave(draft);}}><fieldset className="shared-planning-form-fields" disabled={disabled}>
  <label className="shared-planning-form-wide">{g('Название')}<input value={draft.title} maxLength={160} required disabled={disabled} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
  <label className="shared-planning-form-wide">{t('goal')}<textarea value={draft.goal} maxLength={5000} disabled={disabled} onChange={event=>setDraft({...draft,goal:event.target.value})}/></label>
  <div className="shared-planning-form-wide"><RecordCalendarChoice value={draft.calendarMode} onChange={calendarMode=>setDraft({...draft,calendarMode})} language={language}/></div>
  <label>{g('Начало')}<CalendarDatePicker value={draft.startDate} mode={draft.calendarMode} calculationContext={draft.calendarContext} required onChange={startDate=>setDraft({...draft,startDate})} ariaLabel={g('Начало')}/></label>
  <label>{g('Окончание')}<CalendarDatePicker value={draft.endDate} mode={draft.calendarMode} calculationContext={draft.calendarContext} min={draft.startDate} required onChange={endDate=>setDraft({...draft,endDate})} ariaLabel={g('Окончание')}/></label>
  <p className="shared-planning-form-wide">{draft.calendarContext.timeZone}</p>
  <div className="shared-planning-actions"><button type="submit" className="primary-button" disabled={disabled}>{g('Сохранить')}</button><button type="button" className="secondary-button" disabled={disabled} onClick={onCancel}>{g('Отмена')}</button></div>
 </fieldset></form>;
}
function Totals({totals,language}:{totals:PlanningTotals;language:Language}){
 const t=(key:PlanningCopyKey)=>planningText(key,language),number=new Intl.NumberFormat(language,{maximumFractionDigits:2});
 return <dl className="shared-planning-totals"><div><dt>{t('count')}</dt><dd>{number.format(totals.count)} · {translateText('Завершено',language)}: {number.format(totals.completed)}</dd></div>
  {(['points','hours'] as const).map(unit=><div key={unit}><dt>{t(unit)}</dt><dd>{number.format(totals[unit].value)} · {t('unestimated')}: {number.format(totals[unit].unestimated)}</dd></div>)}
 </dl>;
}
function PlanningTaskRow({task,sprints,language,canEdit,canOrganize,disabled,onOpen,onSave}:{task:SharedTask;sprints:SharedSprint[];language:Language;canEdit:boolean;canOrganize:boolean;disabled:boolean;onOpen:(task:SharedTask)=>void;onSave:(task:SharedTask,values:PlanningValues)=>Promise<boolean>}){
 const g=(value:string)=>translateText(value,language),t=(key:PlanningCopyKey)=>planningText(key,language),[editing,setEditing]=useState(false),[draft,setDraft]=useState(()=>estimateDraft(task)),[destination,setDestination]=useState(task.sprintId??'backlog'),[base,setBase]=useState(task);
 const stale=editing&&base.revision!==task.revision;
 const submit=(event:FormEvent)=>{event.preventDefault();if(stale)return;void onSave(base,{...estimateInput(draft),...(canOrganize&&destination!==(base.sprintId??'backlog')?{sprintId:destination==='backlog'?null:destination}:{})}).then(saved=>{if(saved)setEditing(false);});};
 return <li className="shared-planning-row"><div><button className="shared-planning-task-title" type="button" disabled={disabled} onClick={()=>onOpen(task)}><strong>{task.title}</strong><small>{task.completedAt?g('Завершено'):g('Задача')}</small></button><SharedEstimateValues task={task} language={language}/></div>
  {canEdit?<button type="button" className="secondary-button" disabled={disabled||editing} onClick={()=>{setBase(task);setDraft(estimateDraft(task));setDestination(task.sprintId??'backlog');setEditing(true);}}>{g('Редактировать')}</button>:null}
  {editing?<form onSubmit={submit}><SharedEstimateInputs value={draft} onChange={setDraft} language={language} disabled={disabled}/>
   {canOrganize?<label>{t('assignTo')}<select value={destination} disabled={disabled} onChange={event=>setDestination(event.target.value)}><option value="backlog">{t('backlog')}</option>{sprints.filter(sprint=>sprint.state!=='completed'||sprint.id===task.sprintId).map(sprint=><option key={sprint.id} value={sprint.id} disabled={sprint.state==='completed'}>{sprint.title}</option>)}</select></label>:null}
   {stale?<p role="status">{t('conflict')}</p>:null}
   <div className="shared-planning-actions"><button className="primary-button" type="submit" disabled={disabled||stale}>{g('Сохранить')}</button>{stale?<button type="button" className="secondary-button" disabled={disabled} onClick={()=>setBase(task)}>{g('Обновить')}</button>:null}<button type="button" className="secondary-button" disabled={disabled} onClick={()=>setEditing(false)}>{g('Отмена')}</button></div>
  </form>:null}
 </li>;
}
export function SharedPlanning({context,language,mode,onClose,onAccessLost,onChanged,onOpenTask}:{context:SharedProjectSnapshot;language:Language;mode:CalendarMode;onClose:()=>void;onAccessLost:()=>void;onChanged:()=>Promise<void>;onOpenTask:(task:SharedTask)=>Promise<void>}){
 const projectId=context.project.id,dialog=useRef<HTMLDialogElement>(null),live=useRef(true),job=useRef<Job|null>(null),lock=useRef(false);
 const t=(key:PlanningCopyKey)=>planningText(key,language),g=(value:string)=>translateText(value,language),number=new Intl.NumberFormat(language,{maximumFractionDigits:2});
 const [data,setData]=useState<ProjectPlanning|null>(null),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[retry,setRetry]=useState(false),[lost,setLost]=useState(false),[online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
 const [failureMode,setFailureMode]=useState<'load'|'save'>('load');
 const [bucket,setBucket]=useState('backlog'),[form,setForm]=useState<SharedSprint|'new'|null>(null),[completion,setCompletion]=useState<Completion|null>(null),[message,setMessage]=useState(false),[reload,setReload]=useState(0);
 const canEdit=context.project.permissions?.editTasks??['owner','manager','member'].includes(context.project.role),canOrganize=Boolean(context.project.permissions?.organizeTasks??context.project.canOrganizeTasks),canManage=context.project.permissions?.manageProjects??['owner','manager'].includes(context.project.role);
 const tasks=useSharedTaskPage(data?.config.enabled&&!lost?{projectIds:[projectId],...(bucket==='backlog'?{backlog:true}:{sprintId:bucket})}:null,'position',reload);
 const selected=data?.sprints.find(sprint=>sprint.id===bucket),blocked=busy||retry||!online||lost;
 useEffect(()=>{live.current=true;const element=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';element?.showModal();const connection=()=>setOnline(navigator.onLine);window.addEventListener('online',connection);window.addEventListener('offline',connection);
  return()=>{live.current=false;element?.close();document.body.style.overflow=overflow;window.removeEventListener('online',connection);window.removeEventListener('offline',connection);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{const controller=new AbortController();const load=()=>{if(lock.current)return;void loadPlanning(projectId,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(reason=>{if(controller.signal.aborted)return;if(planningAccessLost(reason))setLost(true);setError(reason);});};load();const timer=window.setInterval(()=>{if(navigator.onLine&&document.visibilityState==='visible')load();},5000);return()=>{controller.abort();window.clearInterval(timer);};},[projectId]);
 useEffect(()=>{if(lost)onAccessLost();},[lost,onAccessLost]);
 const refresh=async()=>{const result=await loadPlanning(projectId);if(live.current){setData(result);setReload(value=>value+1);}return result;};
 const attempt=async(current:Job):Promise<boolean>=>{
  if(lock.current)return false;lock.current=true;setBusy(true);setError(null);setMessage(false);setFailureMode('save');
  try {const result=await current.invoke(current.id);if(!live.current)return true;job.current=null;setRetry(false);current.after?.(result);setMessage(true);setFailureMode('load');await refresh();await onChanged();return true;}
  catch(reason){if(!live.current)return false;if(planningAccessLost(reason)){job.current=null;setRetry(false);setLost(true);}else if(reason instanceof GenesisApiError&&reason.status>=400&&reason.status<500){job.current=null;setRetry(false);}else setRetry(job.current!==null);setError(reason);return false;}
  finally{lock.current=false;if(live.current)setBusy(false);}
 };
 const run=async(invoke:Job['invoke'],after?:Job['after'])=>{if(blocked||job.current)return false;const current={invoke,after,id:crypto.randomUUID()};job.current=current;return attempt(current);};
 const openTask=async(task:SharedTask)=>{if(blocked||lock.current)return;lock.current=true;setBusy(true);setFailureMode('load');setError(null);try{await onOpenTask(task);}catch(reason){if(live.current){setError(reason);if(planningAccessLost(reason))setLost(true);}}finally{lock.current=false;if(live.current)setBusy(false);}};
 const prepareComplete=async()=>{
  if(!selected||blocked||lock.current)return;lock.current=true;setBusy(true);setError(null);setFailureMode('load');
  try {const fresh=await loadPlanning(projectId),sprint=fresh.sprints.find(row=>row.id===selected.id);if(!sprint||sprint.state!=='active')throw new Error('SPRINT_STATE_INVALID');
   const remaining:SharedTask[]=[];let cursor:string|null=null,total=0;do{const page=await querySharedTasks({projectIds:[projectId],sprintId:sprint.id,completion:'open'},cursor);remaining.push(...page.tasks);total=page.total;cursor=page.nextCursor;}while(cursor);
   if(remaining.length!==total||new Set(remaining.map(task=>task.id)).size!==total)throw new Error('PLANNING_CONFLICT');
   if(live.current){setData(fresh);setCompletion(old=>({sprint,fingerprint:fresh.fingerprint,tasks:remaining,choices:old?.sprint.id===sprint.id?old.choices:{}}));}
  }catch(reason){if(live.current){setError(reason);if(planningAccessLost(reason))setLost(true);}}
  finally{lock.current=false;if(live.current)setBusy(false);}
 };
 const finish=()=>{if(!completion)return;const outcomes=completion.tasks.map(task=>({taskId:task.id,expectedRevision:task.revision,destinationSprintId:completion.choices[task.id]==='backlog'?null:completion.choices[task.id]}));void run(id=>transitionSprint(projectId,completion.sprint,completion.fingerprint,'complete',id,outcomes),()=>{setCompletion(null);setBucket('backlog');});};
 const totals=data?.totals[bucket],byAssignee=data?.byAssignee[bucket]??{},completionStale=Boolean(completion&&data&&completion.fingerprint!==data.fingerprint);
 return <dialog ref={dialog} className="shared-templates-dialog shared-planning-dialog" aria-labelledby="shared-planning-title" data-no-translate onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <header><div><h2 id="shared-planning-title">{t('heading')}</h2><p>{context.project.title}</p></div><DialogCloseButton onClick={onClose} disabled={busy}/></header>
  {error?<div className="shared-planning-error" role="alert"><p>{failureMode==='load'&&planningError(error,language)===t('error')?g('Не удалось загрузить данные'):planningError(error,language)}</p>{retry?<button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>{if(job.current)void attempt(job.current);}}>{g('Повторить')}</button>:<button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>{setError(null);setFailureMode('load');void refresh().then(fresh=>{if(form&&form!=='new'){const updated=fresh.sprints.find(row=>row.id===form.id);if(updated)setForm(updated);}}).catch(setError);}}>{g('Обновить')}</button>}</div>:null}
  {message?<p role="status">{t('saved')}</p>:null}
  {!data?<p role="status">{g('Загрузка…')}</p>:!data.config.enabled?<section><p>{t('disabled')}</p>{canManage?<button type="button" className="primary-button" disabled={blocked} onClick={()=>void run(id=>savePlanning(projectId,{enabled:true,estimateUnit:data.config.estimateUnit},data.config.revision,id))}>{t('enable')}</button>:null}</section>:<>
   {canManage?<details><summary>{g('Настройки')}</summary><div className="shared-planning-actions"><label>{t('unit')}<select value={data.config.estimateUnit} disabled={blocked} onChange={event=>{const estimateUnit=event.target.value as 'points'|'hours';void run(id=>savePlanning(projectId,{enabled:true,estimateUnit},data.config.revision,id));}}><option value="points">{t('points')}</option><option value="hours">{t('hours')}</option></select></label><button type="button" className="secondary-button" disabled={blocked||data.sprints.some(sprint=>sprint.state==='active')} onClick={()=>void run(id=>savePlanning(projectId,{enabled:false,estimateUnit:data.config.estimateUnit},data.config.revision,id))}>{t('disable')}</button></div><p>{t('independent')}</p></details>:null}
   <div className="shared-planning-choice"><label>{t('sprint')}<select value={bucket} disabled={busy||retry||Boolean(completion)} onChange={event=>{setBucket(event.target.value);setForm(null);}}><option value="backlog">{t('backlog')}</option>{data.sprints.map(sprint=><option value={sprint.id} key={sprint.id}>{sprint.title} · {t(stateCopy[sprint.state])}</option>)}</select></label>{canOrganize?<button type="button" className="secondary-button" disabled={blocked||Boolean(completion)} onClick={()=>setForm('new')}>{t('newSprint')}</button>:null}</div>
   {form?<section><h3>{form==='new'?t('newSprint'):g('Редактировать')}</h3><SprintForm key={form==='new'?'new':form.id} initial={form==='new'?undefined:form} mode={mode} language={language} disabled={blocked} onCancel={()=>setForm(null)} onSave={draft=>{const previous=form==='new'?undefined:form;void run(id=>saveSprint(projectId,draft,previous?.revision??0,id,previous?.id),value=>{const result=value as {sprint:SharedSprint};setBucket(result.sprint.id);setForm(null);});}}/></section>:null}
   {selected?<section aria-label={t('sprint')}><h3>{selected.title}</h3><p>{t(stateCopy[selected.state])}</p>{selected.goal?<p>{selected.goal}</p>:null}<p className="shared-planning-period"><span>{formatCalendarDateValue(selected.startDate,selected.calendarMode,false,selected.calendarContext)} — {formatCalendarDateValue(selected.endDate,selected.calendarMode,false,selected.calendarContext)}</span><span>{selected.calendarContext.timeZone}</span></p>
    {canOrganize&&selected.state!=='completed'?<div className="shared-planning-actions"><button type="button" className="secondary-button" disabled={blocked||Boolean(completion)} onClick={()=>setForm(selected)}>{g('Редактировать')}</button>{selected.state==='planning'?<button type="button" className="primary-button" disabled={blocked||data.sprints.some(sprint=>sprint.state==='active')} onClick={()=>void run(id=>transitionSprint(projectId,selected,data.fingerprint,'start',id))}>{t('startSprint')}</button>:<button type="button" className="primary-button" disabled={blocked||Boolean(completion)} onClick={()=>void prepareComplete()}>{t('finishSprint')}</button>}</div>:null}
   </section>:null}
   {totals?<Totals totals={totals} language={language}/>:null}
   {completion?<section aria-labelledby="planning-outcomes-title"><h3 id="planning-outcomes-title">{t('remaining')}: {number.format(completion.tasks.length)}</h3><p>{t('chooseOutcome')}</p>{completionStale?<p role="status">{t('conflict')}</p>:null}
    <ul>{completion.tasks.map(task=><li className="shared-planning-row" key={task.id}><span>{task.title}</span><label>{t('assignTo')}<select value={completion.choices[task.id]??''} disabled={blocked} required onChange={event=>setCompletion({...completion,choices:{...completion.choices,[task.id]:event.target.value}})}><option value="">{g('Выберите')}</option><option value="backlog">{t('backlog')}</option>{data.sprints.filter(sprint=>sprint.state!=='completed'&&sprint.id!==completion.sprint.id).map(sprint=><option value={sprint.id} key={sprint.id}>{sprint.title}</option>)}</select></label></li>)}</ul>
    <div className="shared-planning-actions"><button className="primary-button" type="button" disabled={blocked||completionStale||completion.tasks.some(task=>!completion.choices[task.id])} onClick={finish}>{t('finishSprint')}</button>{completionStale?<button type="button" className="secondary-button" disabled={blocked} onClick={()=>void prepareComplete()}>{g('Обновить')}</button>:null}<button type="button" className="secondary-button" disabled={busy} onClick={()=>setCompletion(null)}>{g('Отмена')}</button></div>
   </section>:<section aria-label={bucket==='backlog'?t('backlog'):t('sprint')}><h3>{bucket==='backlog'?t('backlog'):g('Задачи')}</h3><ul>{tasks.page?.tasks.map(task=><PlanningTaskRow key={task.id} task={task} sprints={data.sprints} language={language} canEdit={canEdit} canOrganize={canOrganize} disabled={blocked} onOpen={task=>void openTask(task)} onSave={(task,values)=>run(id=>savePlanningTask(task,values,id))}/>)}</ul>{tasks.page&&!tasks.page.total?<p>{g('Задач нет.')}</p>:null}<SharedTaskPageControls page={tasks.page} loaded={tasks.page?.tasks.length??0} busy={tasks.busy||busy} onMore={()=>void tasks.more()} onRefresh={()=>void tasks.refresh()} error={tasks.error}/></section>}
   {Object.keys(byAssignee).length?<section><h3>{t('byAssignee')}</h3><table className="shared-planning-members"><thead><tr><th scope="col">{g('Исполнитель')}</th><th scope="col">{t('count')}</th><th scope="col">{t(data.config.estimateUnit)}</th><th scope="col">{t('unestimated')}</th></tr></thead><tbody>{Object.entries(byAssignee).map(([id,values])=><tr key={id}><th scope="row">{context.members.find(member=>member.userId===id)?.displayName??g(id==='unassigned'?'Не назначен':'Участник')}</th><td>{number.format(values.count)}</td><td>{number.format(values[data.config.estimateUnit].value)}</td><td>{number.format(values[data.config.estimateUnit].unestimated)}</td></tr>)}</tbody></table></section>:null}
  </>}
  <SharedWorkflow context={context} language={language} disabled={blocked} onChanged={onChanged} onAccessLost={onAccessLost}/>
  {busy?<p role="status">{g('Загрузка…')}</p>:null}
 </dialog>;
}
