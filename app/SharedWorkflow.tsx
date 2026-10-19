"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { GenesisApiError } from './cloud-sync';
import { translateText, type Language } from './i18n';
import { planningAccessLost, planningText } from './shared-planning';
import { loadWorkflow, saveWorkflow, workflowDraft, workflowHistory, workflowRoles, workflowStatusesKey, type WorkflowSnapshot, type WorkflowCommand, type WorkflowConfig, type WorkflowRole, type WorkflowVersion } from './shared-workflows';
import { workflowError, workflowText } from './workflow-copy';
import './shared-workflows.css';

type State=WorkflowSnapshot;
type Draft={config:WorkflowConfig;statusesKey:string};
const roleLabels:Record<WorkflowRole,string>={owner:'Владелец',manager:'Менеджер',member:'Участник',commenter:'Комментатор',viewer:'Читатель'};

export function SharedWorkflow({projectId,language,disabled,onChanged,onAccessLost,initiallyExpanded=false}:{projectId:string;language:Language;disabled:boolean;onChanged:()=>Promise<void>;onAccessLost:()=>void;initiallyExpanded?:boolean}) {
 const g=(text:string)=>translateText(text,language),t=(key:Parameters<typeof workflowText>[0])=>workflowText(key,language);
 const [data,setData]=useState<State|null>(null),[draft,setDraft]=useState<Draft|null>(null),[from,setFrom]=useState(''),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[retry,setRetry]=useState(false),[saved,setSaved]=useState(false);
 const [history,setHistory]=useState<{versions:WorkflowVersion[];nextCursor:number|null}|null>(null),[expanded,setExpanded]=useState(initiallyExpanded);
 const live=useRef(true),lock=useRef(false),reads=useRef(0),pending=useRef<WorkflowCommand|null>(null),lost=useRef(onAccessLost);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{lost.current=onAccessLost;},[onAccessLost]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const generation=++reads.current;
  const value=await loadWorkflow(projectId,signal);if(live.current&&!signal?.aborted&&generation===reads.current)setData(value);return value;
 },[projectId]);
 const fail=useCallback((reason:unknown)=>{if(!live.current)return;setError(reason);if(planningAccessLost(reason)){setData(null);setDraft(null);setHistory(null);lost.current();}},[]);
 useEffect(()=>{
  if(!expanded)return;const controller=new AbortController();
  const refresh=()=>{if(!lock.current)void load(controller.signal).catch(reason=>{if(!controller.signal.aborted)fail(reason);});};refresh();
  const timer=window.setInterval(()=>{if(navigator.onLine&&document.visibilityState==='visible')refresh();},15000);
  return()=>{controller.abort();window.clearInterval(timer);};
 },[load,fail,expanded]);
 const canManage=Boolean(data?.context.project.permissions?.manageProjects);
 const blocked=disabled||busy||retry||!canManage;
 const stale=Boolean(draft&&data&&(draft.config.revision!==data.config.revision||draft.statusesKey!==workflowStatusesKey(data.context.statuses)));
 const fields=[['description',t('description')],['assigneeId',g('Исполнитель')],['dueDate',t('dueDate')],['startDate',t('startDate')],['categoryId',t('category')],['labels',g('Метки')],['storyPoints',planningText('points',language)],['estimateHours',planningText('hours',language)],
  ...(data?.context.customFieldDefinitions??[]).filter(field=>!field.archived).map(field=>['custom:'+field.id,field.title])];
 const attempt=async(command:WorkflowCommand)=>{
  if(lock.current)return;lock.current=true;reads.current++;setBusy(true);setError(null);setSaved(false);
  try {
   const result=await saveWorkflow(projectId,command);pending.current=null;if(!live.current)return;
   setData(current=>current?{...current,...result}:current);setDraft(null);setRetry(false);setHistory(null);setSaved(true);
   await load();await onChanged();
  }catch(reason){if(live.current){const uncertain=pending.current!==null&&!(reason instanceof GenesisApiError&&reason.status>=400&&reason.status<500);if(!uncertain)pending.current=null;setRetry(uncertain);fail(reason);}}
  finally{lock.current=false;if(live.current)setBusy(false);}
 };
 const run=(values:Omit<WorkflowCommand,'requestId'>)=>{if(blocked||pending.current)return;const command={...values,requestId:crypto.randomUUID()};pending.current=command;void attempt(command);};
 const start=()=>{if(!data)return;setDraft({config:workflowDraft(data.config,data.context.statuses),statusesKey:workflowStatusesKey(data.context.statuses)});setError(null);setSaved(false);setFrom('');};
 const submit=(event:FormEvent)=>{event.preventDefault();if(!draft||stale||!draft.config.transitions.every(edge=>edge.roles.length>0))return;run({enabled:true,expectedRevision:draft.config.revision,statuses:draft.config.statuses,transitions:draft.config.transitions});};
 const rebase=async()=>{if(lock.current||!draft)return;lock.current=true;setBusy(true);try{const fresh=await load();if(live.current)setDraft({config:workflowDraft({...draft.config,revision:fresh.config.revision},fresh.context.statuses),statusesKey:workflowStatusesKey(fresh.context.statuses)});}catch(reason){fail(reason);}finally{lock.current=false;if(live.current)setBusy(false);}};
 const moreHistory=async()=>{if(lock.current||history&&history.nextCursor===null)return;lock.current=true;setBusy(true);try{const next=await workflowHistory(projectId,history?.nextCursor??undefined);if(live.current)setHistory(current=>({versions:[...(current?.versions??[]),...next.versions],nextCursor:next.nextCursor}));}catch(reason){fail(reason);}finally{lock.current=false;if(live.current)setBusy(false);}};
 return <details className="shared-workflow" data-workflow-panel open={expanded} onToggle={event=>{if(event.target===event.currentTarget)setExpanded(event.currentTarget.open);}}>
  <summary>{t('heading')}</summary>
  <p>{t('hint')}</p>
  {error?<div role="alert"><p>{workflowError(error,language)??g('Не удалось получить ответ. Обновите отчёт или повторите запрос.')}</p>{retry?<button type="button" className="secondary-button" disabled={busy||disabled} onClick={()=>{if(pending.current)void attempt(pending.current);}}>{g('Повторить')}</button>:<button type="button" className="secondary-button" disabled={busy||disabled} onClick={()=>{setError(null);void load().catch(fail);}}>{g('Обновить')}</button>}</div>:null}
  {saved?<p role="status">{t('saved')}</p>:null}
  {!data?<p role="status">{g('Загрузка…')}</p>:<>
   <p>{t(data.config.enabled?'enabled':'disabled')} · {t('revision')}: {new Intl.NumberFormat(language).format(data.config.revision)}</p>
   {!draft&&canManage?<div className="shared-planning-actions"><button type="button" className="secondary-button" disabled={blocked} onClick={start}>{t('configure')}</button>{data.config.enabled?<button type="button" className="secondary-button" disabled={blocked} onClick={()=>run({enabled:false,expectedRevision:data.config.revision})}>{t('disable')}</button>:null}</div>:null}
   {!draft&&data.config.enabled?<dl className="shared-workflow-counts">{data.config.statuses.map(rule=><div key={rule.statusId}><dt>{data.context.statuses.find(status=>status.id===rule.statusId)?.title??g('Недоступно')}</dt><dd>{new Intl.NumberFormat(language).format(data.counts[rule.statusId]??0)}{rule.wipLimit!==null?` / ${new Intl.NumberFormat(language).format(rule.wipLimit)}`:''}</dd></div>)}</dl>:null}
   {draft?<form onSubmit={submit} aria-label={t('heading')}>
    <fieldset disabled={blocked}><legend>{g('Настройки')}</legend>
     <div className="shared-workflow-statuses">{draft.config.statuses.map((rule,index)=>{
      const status=data.context.statuses.find(status=>status.id===rule.statusId),options=[...fields,...rule.requiredFields.filter(key=>!fields.some(([id])=>id===key)).map(key=>[key,g('Недоступно')])];
      return <details key={rule.statusId} className="shared-workflow-status" data-workflow-status={rule.statusId} open={index===0?true:undefined}><summary>{status?.title??g('Недоступно')} · {g('Задачи')}: {data.counts[rule.statusId]??0}</summary>
       {!status?.isDone?<label>{t('limit')}<input type="number" min="0" max="1000000" step="1" inputMode="numeric" value={rule.wipLimit??''} placeholder={t('noLimit')} onChange={event=>{const limit=event.target.value===''?null:event.target.valueAsNumber;setDraft({...draft,config:{...draft.config,statuses:draft.config.statuses.map(row=>row.statusId===rule.statusId?{...row,wipLimit:limit}:row)}});}}/></label>:null}
       <fieldset className="shared-workflow-checks"><legend>{t('required')}</legend>{options.map(([id,label])=><label key={id}><input type="checkbox" checked={rule.requiredFields.includes(id)} onChange={event=>setDraft({...draft,config:{...draft.config,statuses:draft.config.statuses.map(row=>row.statusId===rule.statusId?{...row,requiredFields:event.target.checked?[...row.requiredFields,id]:row.requiredFields.filter(key=>key!==id)}:row)}})}/><span>{label}</span></label>)}</fieldset>
      </details>;
     })}</div>
     <details className="shared-workflow-transitions"><summary>{t('transitions')}</summary><p>{t('accessHint')}</p>
      <label>{g('Статус')}<select value={from} onChange={event=>setFrom(event.target.value)}><option value="">{t('entry')}</option>{data.context.statuses.map(status=><option value={status.id} key={status.id}>{status.title}</option>)}</select></label>
      {data.context.statuses.filter(status=>status.id!==from).map(status=>{
       const source=from||null,edge=draft.config.transitions.find(edge=>edge.fromStatusId===source&&edge.toStatusId===status.id);
       const replace=(roles:WorkflowRole[]|null)=>setDraft({...draft,config:{...draft.config,transitions:[...draft.config.transitions.filter(edge=>edge.fromStatusId!==source||edge.toStatusId!==status.id),...(roles?[{fromStatusId:source,toStatusId:status.id,roles}]:[])]}});
       return <fieldset key={status.id} className="shared-workflow-edge" data-workflow-target={status.id}><legend><label><input type="checkbox" checked={Boolean(edge)} onChange={event=>replace(event.target.checked?[...workflowRoles]:null)}/><span>{status.title}</span></label></legend>
        {edge?<fieldset className="shared-workflow-checks"><legend>{t('roles')}</legend>{workflowRoles.map(role=><label key={role}><input type="checkbox" checked={edge.roles.includes(role)} onChange={event=>replace(event.target.checked?[...edge.roles,role]:edge.roles.filter(value=>value!==role))}/><span>{g(roleLabels[role])}</span></label>)}</fieldset>:null}
       </fieldset>;
      })}
     </details>
     <p>{t('safety')}</p>
     {stale?<div role="status"><p>{t('conflict')}</p><button type="button" className="secondary-button" onClick={()=>void rebase()}>{t('rebase')}</button></div>:null}
     {draft.config.transitions.some(edge=>!edge.roles.length)?<p role="status">{t('invalidError')}</p>:null}
     <div className="shared-planning-actions"><button type="submit" className="primary-button" disabled={stale||draft.config.transitions.some(edge=>!edge.roles.length)}>{data.config.enabled?g('Сохранить'):t('enable')}</button><button type="button" className="secondary-button" onClick={()=>{setDraft(null);setError(null);}}>{t('cancel')}</button></div>
    </fieldset>
   </form>:null}
   <details className="shared-workflow-history"><summary>{g('История')}</summary>{history?.versions.map(version=><details key={version.revision}><summary>{t('revision')} {new Intl.NumberFormat(language).format(version.revision)} · {new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(version.createdAt))} · {t(version.enabled?'enabled':'disabled')}</summary>
    <dl className="shared-workflow-counts">{version.statuses.map(rule=><div key={rule.statusId}><dt>{data.context.statuses.find(status=>status.id===rule.statusId)?.title??g('Недоступно')}</dt><dd>{t('limit')}: {rule.wipLimit??'—'} · {t('required')}: {rule.requiredFields.map(id=>fields.find(([key])=>key===id)?.[1]??g('Недоступно')).join(', ')||'—'}</dd></div>)}</dl>
   </details>)}{!history||history.nextCursor!==null?<button type="button" className="secondary-button" disabled={busy||disabled} onClick={()=>void moreHistory()}>{t(history?'more':'load')}</button>:null}</details>
  </>}
 </details>;
}
