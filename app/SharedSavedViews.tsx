"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { calendarContext, type CalendarContext } from "./calendar-context";
import { type CalendarMode } from "./calendar-data";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { SharedBulkActions } from "./SharedBulkActions";
import { useSharedTaskPage } from "./use-shared-task-page";
import { sharedPriorityLabel, sharedTaskDetailsError } from "./shared-task-details";
import { editableSharedViewDefinition, repairSharedViewContext } from "./shared-saved-view-model";
import { translateText as t } from "./i18n";
import { GenesisNetworkTimeoutError, deleteSharedSavedView, listSharedSavedViews, loadSharedSavedView, loadSharedViewOptions, saveSharedSavedView,
  type SharedSavedView, type SharedSavedViewDefinition, type SharedSavedViewPage, type SharedSpace, type SharedTask,
  type SharedTaskCriteria, type SharedTaskFilter, type SharedViewOptionKind, type SharedViewOptionsPage } from "./cloud-sync";
import "./shared-saved-views.css";

type Draft = { definition:SharedSavedViewDefinition|null; damagedDefinition?:unknown; id?:string; revision?:number; spaceId:string|null; visibility:"personal"|"shared"; dirty:boolean; tagsInput?:string };
const fresh=(mode:CalendarMode):Draft=>({definition:{version:1,title:"",filter:{},sort:"position",relative:"none",calendarMode:mode,calendarContext:calendarContext()},spaceId:null,visibility:"personal",dirty:false});
function restoreDraft(key:string,mode:CalendarMode):Draft {
  try {
    const saved=typeof window!=="undefined"?JSON.parse(localStorage.getItem(key)||"null"):null;
    if(saved===null)return fresh(mode);
    if((saved?.spaceId===null||typeof saved?.spaceId==="string")
      && ["personal","shared"].includes(saved?.visibility) && typeof saved?.dirty==="boolean"
      && (saved.id===undefined||(typeof saved.id==="string"&&Number.isSafeInteger(saved.revision)&&saved.revision>0))
      && (saved.tagsInput===undefined||typeof saved.tagsInput==="string")){
      if(editableSharedViewDefinition(saved.definition))return saved;
      return {...saved,definition:null,damagedDefinition:saved.definition,dirty:true};
    }
  } catch { /* Preserve the damaged stored draft until the user explicitly replaces it. */ }
  return {definition:null,spaceId:null,visibility:"personal",dirty:true};
}
const message=(error:unknown,fallback="Не удалось загрузить данные")=>error instanceof TypeError||error instanceof GenesisNetworkTimeoutError?t(fallback):sharedTaskDetailsError(error)??t(error instanceof Error?error.message:fallback);
const strings=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];
const subscribeOnline=(callback:()=>void)=>{window.addEventListener("online",callback);window.addEventListener("offline",callback);return()=>{window.removeEventListener("online",callback);window.removeEventListener("offline",callback);};};
const onlineSnapshot=()=>navigator.onLine;
const serverOnline=()=>true;
function payload(draft:Draft):SharedSavedViewDefinition {
  const definition=draft.definition;
  if(!definition)throw new Error("VIEW_INVALID");
  const filter={...definition.filter};
  if(draft.spaceId)filter.spaceId=draft.spaceId;else delete filter.spaceId;
  if(definition.relative!=="none"){delete filter.dueFrom;delete filter.dueTo;}
  return {...definition,title:definition.title.trim()||t("Представление"),filter};
}

function ViewChoice({kind,label,filter,value,onChange,online}:{kind:SharedViewOptionKind;label:string;filter:Pick<SharedTaskCriteria,"spaceId"|"projectIds">;value:string[];onChange:(value:string[])=>void;online:boolean}) {
  const key=JSON.stringify(filter),[state,setState]=useState<{key:string;page:SharedViewOptionsPage}|null>(null),[failure,setFailure]=useState<{key:string;text:string}|null>(null),[pending,setPending]=useState<{key:string;id:number}|null>(null);
  const generation=useRef(0),moreController=useRef<AbortController|null>(null);
  useEffect(()=>{
    if(!online)return;
    const controller=new AbortController(),current=++generation.current;
    void loadSharedViewOptions(kind,JSON.parse(key),null,controller.signal).then(page=>{
      if(!controller.signal.aborted&&current===generation.current){setState({key,page});setFailure(null);}
    }).catch(error=>{if(!controller.signal.aborted&&current===generation.current)setFailure({key,text:message(error)});});
    const invalidate=()=>{++generation.current;moreController.current?.abort();};
    return()=>{invalidate();controller.abort();};
  },[kind,key,online]);
  const page=state?.key===key?state.page:null,error=failure?.key===key?failure.text:"",busy=pending?.key===key;
  const base=kind==="assignees"?[{id:"me",title:t("Назначено мне")},{id:"unassigned",title:t("Без исполнителя")}]:[];
  const options=[...base,...(page?.options??[])],missing=value.filter(id=>!options.some(option=>option.id===id));
  const more=async()=>{
    if(!page?.nextCursor||busy||!online)return;
    const current=generation.current,controller=new AbortController();moreController.current=controller;setPending({key,id:current});
    try{
      const next=await loadSharedViewOptions(kind,JSON.parse(key),page.nextCursor,controller.signal);
      if(current===generation.current){setState({key,page:{...next,options:[...new Map([...page.options,...next.options].map(option=>[option.id,option])).values()]}});setFailure(null);}
    }catch(error){if(current===generation.current&&!controller.signal.aborted)setFailure({key,text:message(error)});}
    finally{setPending(previous=>previous?.id===current?null:previous);}
  };
  return <div className="saved-view-choice"><label>{label}<select multiple size={4} value={value} onChange={event=>onChange(Array.from(event.target.selectedOptions,option=>option.value))}>
    {missing.map(id=><option key={id} value={id} data-no-translate>{t("Выбрано")} · {id.slice(0,8)}</option>)}{options.map(option=><option key={option.id} value={option.id} data-no-translate>{option.title}</option>)}
  </select></label>{!page&&!error&&online?<small role="status">{t("Загружаем данные…")}</small>:null}{error?<p role="alert">{error}</p>:null}
    {page?.hasMore?<button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>void more()}>{t("Показать ещё")}</button>:null}
  </div>;
}

export function SharedSavedViews({userId,spaces,mode,onOpen}:{userId:string;spaces:SharedSpace[];mode:CalendarMode;onOpen:(task:SharedTask)=>void}) {
  const storageKey=`genesis.shared-views.draft.${userId}`;
  const [draft,setDraft]=useState<Draft>(()=>restoreDraft(storageKey,mode));
  const [opened,setOpened]=useState(false),[editor,setEditor]=useState(draft.dirty),[list,setList]=useState<SharedSavedViewPage|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[listLoading,setListLoading]=useState(false),[listError,setListError]=useState("");
  const [metadata,setMetadata]=useState<SharedSavedView|null>(null),[filter,setFilter]=useState<SharedTaskFilter|null>(null),[optionsVersion,setOptionsVersion]=useState(0);
  const rolesKey=spaces.map(space=>`${space.id}:${space.role}`).sort().join("|");
  const requestKey=`${storageKey}.request`;
  const online=useSyncExternalStore(subscribeOnline,onlineSnapshot,serverOnline),operation=useRef(false),listGeneration=useRef(0);
  const request=useRef<{body:string;id:string}|null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const mutationId=(body:string)=>{
    if(!request.current){try{const saved=JSON.parse(localStorage.getItem(requestKey)||"null");if(typeof saved?.body==="string"&&typeof saved?.id==="string")request.current=saved;}catch{/* Memory retry remains available. */}}
    if(request.current?.body!==body)request.current={body,id:crypto.randomUUID()};
    try{localStorage.setItem(requestKey,JSON.stringify(request.current));}catch{/* Preserve the in-memory request. */}
    return request.current.id;
  };
  const clearRequest=()=>{request.current=null;try{localStorage.removeItem(requestKey);}catch{/* No persistent retry to clear. */}};
  const persistResult=(next:Draft)=>{
    setDraft(next);
    try{localStorage.setItem(storageKey,JSON.stringify(next));clearRequest();}
    catch{/* Keep the receipt ID when the completed result cannot yet be persisted. */}
  };
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const generation=++listGeneration.current;setListLoading(true);
    try{const result=await listSharedSavedViews(null,signal);if(!signal?.aborted&&generation===listGeneration.current){setList(result);setListError("");}}
    catch(error){if(!signal?.aborted&&generation===listGeneration.current){setList(null);setListError(message(error));}}
    finally{if(generation===listGeneration.current)setListLoading(false);}
  },[]);
  useEffect(()=>{if(!draft.definition)return;try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{/* Keep the in-memory draft when device storage is unavailable. */}},[draft,storageKey]);
  useEffect(()=>{if(!opened||!online)return;const controller=new AbortController();const initial=window.setTimeout(()=>void refresh(controller.signal),0),changed=()=>void refresh(controller.signal),invalidate=()=>{++listGeneration.current;};window.addEventListener("genesis:shared-updates",changed);return()=>{invalidate();controller.abort();window.clearTimeout(initial);window.removeEventListener("genesis:shared-updates",changed);};},[opened,refresh,online]);
  useEffect(()=>{
    if(!draft.id||!online)return;
    const controller=new AbortController();let generation=0;
    const refreshMetadata=()=>{
      if(document.visibilityState!=="visible")return;
      const current=++generation;
      void loadSharedSavedView(draft.id!,controller.signal).then(view=>{if(!controller.signal.aborted&&generation===current)setMetadata(view);})
        .catch(error=>{if(!controller.signal.aborted&&generation===current){setMetadata(null);setError(message(error));}});
    };
    refreshMetadata();window.addEventListener("genesis:shared-updates",refreshMetadata);window.addEventListener("focus",refreshMetadata);
    document.addEventListener("visibilitychange",refreshMetadata);
    return()=>{controller.abort();window.removeEventListener("genesis:shared-updates",refreshMetadata);window.removeEventListener("focus",refreshMetadata);document.removeEventListener("visibilitychange",refreshMetadata);};
  },[draft.id,online,rolesKey]);
  const tasks=useSharedTaskPage(opened?filter:null);
  const definition=draft.definition;
  const editDraft=(edit:(previous:Draft)=>Draft)=>{setFilter(null);setDraft(edit);};
  const update=(patch:Partial<SharedSavedViewDefinition>)=>editDraft(previous=>previous.definition?({...previous,dirty:true,definition:{...previous.definition,...patch}}):previous);
  const criteria=(patch:Partial<SharedTaskCriteria>)=>{if(definition)update({filter:{...definition.filter,...patch}});};
  const ids=(name:"projectIds"|"statusIds"|"assigneeIds"|"labelIds",value:string[])=>{if(!definition)return;const next={...definition.filter};if(value.length)next[name]=value;else delete next[name];update({filter:next});};
  const replace=()=>!operation.current&&(!draft.dirty||window.confirm(t("Заменить несохранённые условия представления?")));
  const openView=(view:SharedSavedView)=>{
    if(!replace())return;
    const editable=editableSharedViewDefinition(view.definition),invalid=view.invalid||!editable;
    setMetadata(view);setDraft({definition:editable?view.definition:null,damagedDefinition:editable?undefined:view.definition,id:view.id,revision:view.revision,spaceId:view.spaceId,visibility:view.visibility,dirty:false});
    setEditor(Boolean(invalid));setOptionsVersion(previous=>previous+1);setFilter(invalid?null:{savedViewId:view.id});setError(invalid?t("Часть условий больше недоступна. Исправьте представление перед открытием."):"");
  };
  const preset=(name:string,criteria:SharedTaskCriteria,relative:SharedSavedViewDefinition["relative"]="none")=>{
    if(!replace())return;const next=fresh(mode);next.definition={...next.definition!,title:t(name),filter:criteria,relative};
    setDraft(next);setMetadata(null);setEditor(false);setOptionsVersion(previous=>previous+1);setFilter({viewDefinition:payload(next)});setError("");
  };
  const save=async(copy=false)=>{
    if(operation.current)return;operation.current=true;setBusy(true);
    try{if(!draft.definition?.title.trim())throw new Error("VIEW_INVALID");const definition=payload(draft),id=copy?undefined:draft.id,visibility=copy&&!canShare?"personal":draft.visibility;
      const body=JSON.stringify({spaceId:draft.spaceId,visibility,definition,expectedRevision:id?draft.revision:undefined,id});
      const view=await saveSharedSavedView({requestId:mutationId(body),spaceId:draft.spaceId,visibility,definition,expectedRevision:id?draft.revision:undefined},id);
      if(!mounted.current)return;
      if(!editableSharedViewDefinition(view.definition)||view.invalid)throw new Error("VIEW_FILTER_UNAVAILABLE");
      setMetadata(view);persistResult({definition:view.definition,id:view.id,revision:view.revision,spaceId:view.spaceId,visibility:view.visibility,dirty:false});setFilter({savedViewId:view.id});setEditor(false);setError("");await refresh();
    }catch(error){setError(message(error,"Ответ о сохранении не получен. Черновик сохранён; повторите попытку."));}finally{operation.current=false;setBusy(false);}
  };
  const remove=async()=>{
    if(operation.current||!metadata||metadata.id!==draft.id||!window.confirm(t("Удалить представление? Задачи сохранятся.")))return;
    operation.current=true;setBusy(true);
    try{
      const revision=draft.revision??metadata.revision,requestId=mutationId(JSON.stringify({action:"delete",id:metadata.id,revision}));
      await deleteSharedSavedView({...metadata,revision},requestId);if(!mounted.current)return;setFilter(null);setMetadata(null);
      persistResult({...draft,id:undefined,revision:undefined,dirty:true,visibility:"personal"});setError("");await refresh();
    }catch(error){setError(message(error,"Ответ об удалении не получен. Повторите попытку."));}finally{operation.current=false;setBusy(false);}
  };
  const moreViews=async()=>{
    if(operation.current||!list?.nextCursor||listLoading)return;
    const generation=listGeneration.current;setListLoading(true);
    try{const next=await listSharedSavedViews(list.nextCursor);if(generation===listGeneration.current){setList({...next,views:[...new Map([...list.views,...next.views].map(view=>[view.id,view])).values()]});setListError("");}}
    catch(error){if(generation===listGeneration.current)setListError(message(error));}
    finally{if(generation===listGeneration.current)setListLoading(false);}
  };
  let context:CalendarContext|undefined,zoneError="";
  if(definition){try{context=calendarContext(definition.calendarContext);}catch{zoneError=t("Введите действительный часовой пояс IANA, например Europe/Moscow. Черновик сохранён.");}}
  const optionFilter={...(draft.spaceId?{spaceId:draft.spaceId}:{}),...(strings(definition?.filter.projectIds).length?{projectIds:strings(definition?.filter.projectIds)}:{})};
  const canShare=spaces.some(space=>space.id===draft.spaceId&&["owner","admin"].includes(space.role)),canEdit=!draft.id||(metadata?.id===draft.id&&metadata.canEdit);
  const scopeChanged=Boolean(draft.id&&metadata?.id===draft.id&&(metadata.spaceId!==draft.spaceId||metadata.visibility!==draft.visibility));
  const repairedContext=!definition?repairSharedViewContext(draft.damagedDefinition,calendarContext()):null;
  const sortOptions=[["position","Порядок на доске"],["priority","Приоритет"],["dueDate","Срок"],["title","Название"],["updatedAt","Последнее изменение"]]as const;
  return <details className="shared-saved-views" open={opened} onToggle={event=>setOpened(event.currentTarget.open)}><summary><ExperimentalIcon name="list"/>{t("Сохранённые представления")}<span className="saved-view-disclosure"><ExperimentalIcon name="chevron"/></span></summary>
    {opened?<div className="saved-views-content">
      <div className="saved-view-presets" role="group" aria-label={t("Представления")}>
        <button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>preset("Назначено мне",{assigneeIds:["me"]})}>{t("Назначено мне")}</button>
        <button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>preset("Создано мной",{createdBy:"me"})}>{t("Создано мной")}</button>
        <button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>preset("Просрочено",{},"overdue")}>{t("Просрочено")}</button>
        <button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>preset("На этой неделе",{},"this-week")}>{t("На этой неделе")}</button>
        <button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>preset("Без исполнителя",{assigneeIds:["unassigned"]})}>{t("Без исполнителя")}</button>
        <button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>preset("Ожидает утверждения",{approvalPending:true})}>{t("Ожидает утверждения")}</button>
      </div>
      {listLoading&&online?<p role="status">{t("Загружаем данные…")}</p>:null}
      {list&&!list.total&&!listLoading?<p>{t("Сохранённых представлений пока нет")}</p>:null}
      {listError?<p role="alert">{listError}</p>:null}
      <div className="saved-view-list">{list?.views.map(view=><button type="button" className="secondary-button" disabled={busy} key={view.id} onClick={()=>openView(view)} aria-pressed={filter?.savedViewId===view.id}><span data-no-translate>{typeof view.definition?.title==="string"?view.definition.title:t("Представление")}</span><small>{t(view.visibility==="shared"?"Общее":"Личное")}{view.invalid?` · ${t("Условия недоступны")}`:""}</small></button>)}</div>
      {list?.hasMore?<button type="button" className="secondary-button" disabled={busy||listLoading||!online} onClick={()=>void moreViews()}>{t("Показать ещё")}</button>:null}
      <div className="saved-view-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(replace()){setDraft(fresh(mode));setMetadata(null);setEditor(true);setFilter(null);setError("");}}}>{t("Новое представление")}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setFilter(null);setError("");}}>{t("Сбросить")}</button><button type="button" className="secondary-button" disabled={busy||listLoading||!online} onClick={()=>{void refresh();setOptionsVersion(previous=>previous+1);}}>{t("Обновить")}</button></div>
      {error?<p role="alert">{error}</p>:null}{!online?<p role="status">{t("Для сохранения нужно подключение к интернету")}</p>:null}
      {definition||draft.damagedDefinition?<button type="button" className="secondary-button" disabled={busy} aria-expanded={editor} aria-controls="saved-view-conditions" onClick={()=>setEditor(previous=>!previous)}>{t(editor?"Свернуть":"Изменить условия")}</button>:null}
      <div id="saved-view-conditions" hidden={!editor}>
      {editor&&!definition?<div role="alert"><p>{t("Сохранённые условия повреждены. Создайте новое представление или откройте исправленную версию.")}</p>
        {repairedContext?<button type="button" className="secondary-button" disabled={busy} onClick={()=>editDraft(previous=>({...previous,definition:repairedContext,damagedDefinition:undefined,dirty:true}))}>{t("Восстановить календарь представления")}</button>:null}
        {draft.id&&canEdit?<button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>void remove()}>{t("Удалить")}</button>:null}</div>:null}
      {editor&&definition?<form className="saved-view-editor" onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy}>
        <div className="saved-view-fields"><label>{t("Название")}<input required maxLength={160} value={definition.title} onChange={event=>update({title:event.target.value})}/></label>
          <label>{t("Пространство")}<select value={draft.spaceId??""} onChange={event=>editDraft(previous=>({...previous,spaceId:event.target.value||null,visibility:"personal",dirty:true}))}><option value="">{t("Все пространства")}</option>{spaces.map(space=><option key={space.id} value={space.id}>{space.title}</option>)}</select></label>
          <label>{t("Доступ")}<select value={draft.visibility} onChange={event=>editDraft(previous=>({...previous,visibility:event.target.value as Draft["visibility"],dirty:true}))}><option value="personal">{t("Личное")}</option><option value="shared" disabled={!canShare}>{t("Общее")}</option></select></label>
          <label>{t("Поиск")}<input value={typeof definition.filter.q==="string"?definition.filter.q:""} maxLength={200} onChange={event=>criteria({q:event.target.value})}/></label>
        </div>
        <p className="saved-view-hint">{t("Пустой выбор включает все доступные проекты. Условия не выдают доступ к задачам.")}</p>
        {scopeChanged?<p role="status">{t("Чтобы изменить пространство или доступ, сохраните новое представление.")}</p>:null}
        <div className="saved-view-fields"><ViewChoice key={`projects-${optionsVersion}`} kind="projects" label={t("Проекты")} filter={draft.spaceId?{spaceId:draft.spaceId}:{}} value={strings(definition.filter.projectIds)} onChange={value=>ids("projectIds",value)} online={online}/>
          <ViewChoice key={`statuses-${optionsVersion}`} kind="statuses" label={t("Статусы")} filter={optionFilter} value={strings(definition.filter.statusIds)} onChange={value=>ids("statusIds",value)} online={online}/>
          <ViewChoice key={`assignees-${optionsVersion}`} kind="assignees" label={t("Исполнители")} filter={optionFilter} value={strings(definition.filter.assigneeIds)} onChange={value=>ids("assigneeIds",value)} online={online}/>
          <ViewChoice key={`labels-${optionsVersion}`} kind="labels" label={t("Метки")} filter={optionFilter} value={strings(definition.filter.labelIds)} onChange={value=>ids("labelIds",value)} online={online}/>
          <label>{t("Приоритет")}<select multiple size={4} value={(Array.isArray(definition.filter.priority)?definition.filter.priority:[]).map(String)} onChange={event=>{const filter={...definition.filter},selected=Array.from(event.target.selectedOptions,option=>Number(option.value));if(selected.length)filter.priority=selected;else delete filter.priority;update({filter});}}>{[0,1,2,3].map(priority=><option key={priority} value={priority}>{sharedPriorityLabel(priority)}</option>)}</select></label>
          <label>{t("Теги")}<input value={draft.tagsInput??strings(definition.filter.tags).join(", ")} onChange={event=>{const tagsInput=event.target.value,filter={...definition.filter},tags=tagsInput.split(/[,;]+/).map(tag=>tag.trim().replace(/^#/,"")).filter(Boolean);if(tags.length)filter.tags=tags;else delete filter.tags;editDraft(previous=>({...previous,tagsInput,dirty:true,definition:{...definition,filter}}));}}/></label>
          <label className="saved-view-toggle">{t("Создано мной")}<input type="checkbox" checked={definition.filter.createdBy==="me"} onChange={event=>{const filter={...definition.filter};if(event.target.checked)filter.createdBy="me";else delete filter.createdBy;update({filter});}}/></label>
          <label className="saved-view-toggle">{t("Ожидает утверждения")}<input type="checkbox" checked={definition.filter.approvalPending===true} onChange={event=>criteria({approvalPending:event.target.checked})}/></label>
          <label>{t("Выполнение")}<select value={definition.filter.completion??"any"} onChange={event=>criteria({completion:event.target.value as SharedTaskCriteria["completion"]})}><option value="any">{t("Все задачи")}</option><option value="open">{t("Текущие")}</option><option value="completed">{t("Завершённые")}</option></select></label>
          <label>{t("Сортировка")}<select value={definition.sort} onChange={event=>update({sort:event.target.value as SharedSavedViewDefinition["sort"]})}>{sortOptions.map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label>{t("Период")}<select value={definition.relative} onChange={event=>update({relative:event.target.value as SharedSavedViewDefinition["relative"]})}>{([ ["none","Фиксированный диапазон"],["overdue","Просрочено"],["this-week","На этой неделе"],["this-month","В этом месяце"]]as const).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label>{t("Календарь")}<select value={definition.calendarMode} onChange={event=>update({calendarMode:event.target.value as CalendarMode})}>{([ ["profane","Григорианский"],["sacred","Сакральный"],["lunar","Лунный"]]as const).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label>{t("Начало года")}<select value={definition.calendarContext.gregorianYearStart} onChange={event=>update({calendarContext:{...definition.calendarContext,gregorianYearStart:event.target.value as CalendarContext["gregorianYearStart"]}})}><option value="january">{t("Январь")}</option><option value="march">{t("Март")}</option></select></label>
          <label>{t("Часовой пояс")}<input value={definition.calendarContext.timeZone} aria-invalid={Boolean(zoneError)} aria-describedby={zoneError?"saved-view-zone-error":undefined} onChange={event=>update({calendarContext:{...definition.calendarContext,timeZone:event.target.value}})}/></label>
        </div>
        {zoneError?<p id="saved-view-zone-error" role="alert">{zoneError}</p>:null}
        {definition.relative==="none"&&!zoneError?<div className="saved-view-dates">{([ ["dueFrom","Начало"],["dueTo","Окончание"]]as const).map(([key,label])=><label key={key}>{t(label)}<CalendarDatePicker mode={definition.calendarMode} calculationContext={context} value={definition.filter[key]??""} ariaLabel={t(label)} onChange={value=>{const filter={...definition.filter};if(value)filter[key]=value;else delete filter[key];update({filter});}}/></label>)}</div>:null}
        <div className="saved-view-actions"><button type="button" className="secondary-button" disabled={busy||!online||Boolean(zoneError)} onClick={()=>{setFilter({viewDefinition:payload(draft)});setEditor(false);setError("");}}>{t("Показать задачи")}</button>
          <button type="submit" className="primary-button" disabled={busy||!online||!canEdit||scopeChanged||Boolean(zoneError)||Boolean(draft.id&&!draft.dirty)}>{t("Сохранить")}</button>
          {draft.id?<button type="button" className="secondary-button" disabled={busy||!online||Boolean(zoneError)} onClick={()=>void save(true)}>{t("Сохранить как новое")}</button>:null}
          <button type="button" className="secondary-button" onClick={()=>{update({filter:{},relative:"none"});setDraft(previous=>({...previous,tagsInput:undefined}));}}>{t("Сбросить условия")}</button>
          {draft.id&&canEdit?<button type="button" className="secondary-button" disabled={busy||!online} onClick={()=>void remove()}>{t("Удалить")}</button>:null}
        </div>
      </fieldset></form>:null}
      </div>
      <SharedBulkActions key={userId} userId={userId} filter={filter} page={tasks.page} sort={definition?.sort??"position"} mode={mode} online={online} loading={tasks.busy} queryError={tasks.error} onMore={()=>void tasks.more()} onRefresh={()=>void tasks.refresh()} onOpen={onOpen}/>
    </div>:null}
  </details>;
}
