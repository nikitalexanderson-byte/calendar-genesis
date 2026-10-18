"use client";
import { useEffect, useRef, useState } from "react";
import { GenesisApiError, listSharedCustomFields, loadSharedCustomFieldHistory, previewSharedCustomField, saveSharedCustomField } from "./cloud-sync";
import { translateText, type Language } from "./i18n";
import { customFieldDraft, customFieldsError, customFieldTypes, type CustomFieldCommand, type CustomFieldDraft, type CustomFieldPreview, type CustomFieldType, type SharedCustomField } from "./shared-custom-fields";
import "./shared-custom-fields.css";

export function SharedCustomFieldManager({spaceId,projectId,language,onChanged,onDirtyChange}:{spaceId:string;projectId:string;language:Language;onChanged:()=>Promise<void>;onDirtyChange:(dirty:boolean)=>void}){
 const t=(source:string)=>translateText(source,language);
 const [fields,setFields]=useState<SharedCustomField[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState("");
 const [draft,setDraft]=useState<CustomFieldDraft|null>(null),[preview,setPreview]=useState<CustomFieldPreview|null>(null),[confirm,setConfirm]=useState(false);
 const [history,setHistory]=useState<{field:SharedCustomField;createdAt:string}[]>([]);
 const lock=useRef(false),pending=useRef<CustomFieldCommand|null>(null),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{onDirtyChange(Boolean(draft));return()=>onDirtyChange(false);},[draft,onDirtyChange]);
 useEffect(()=>{if(!draft)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[draft]);
 const run=async(work:()=>Promise<void>)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setStatus("");
  try{await work();}catch(reason){if(live.current){setError(customFieldsError(reason)??t("Не удалось загрузить или сохранить поля. Черновик сохранён; повторите попытку."));
   if(reason instanceof GenesisApiError&&reason.status===409){setPreview(null);pending.current=null;}}}
  finally{lock.current=false;if(live.current)setBusy(false);}
 };
 const refresh=async()=>{const value=await listSharedCustomFields(spaceId,projectId);if(live.current){setFields(value);setLoaded(true);}};
 const edit=(next:CustomFieldDraft)=>{setDraft(next);setPreview(null);setConfirm(false);setError("");setHistory([]);pending.current=null;};
 const choose=(field:SharedCustomField|null)=>{
  if(draft&&!window.confirm(t("Отменить несохранённые изменения поля?")))return;
  edit(field?customFieldDraft(field):{id:crypto.randomUUID(),title:"",type:"text",projectId,options:[],position:fields.length,required:false,showCard:true,showList:false,archived:false,expectedRevision:0});
 };
 const apply=()=>run(async()=>{
  if(!draft||!preview||preview.replaceType&&!confirm)return;
  const command=pending.current??{...draft,fingerprint:preview.fingerprint,operationId:crypto.randomUUID(),replaceType:preview.replaceType};pending.current=command;
  await saveSharedCustomField(spaceId,command);await refresh();await onChanged();
  if(live.current){setDraft(null);setPreview(null);pending.current=null;setStatus(t("Поле сохранено."));}
 });
 return <details className="shared-custom-field-manager" onToggle={event=>{if(event.currentTarget.open&&!loaded)void run(refresh);}}><summary>{t("Пользовательские поля")}</summary>
  <p>{t("Поля доступны читателям задачи. Видимость в карточке и списке меняет отображение, а не права доступа.")}</p>
  <div className="shared-custom-field-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>choose(null)}>{t("Добавить поле")}</button>
  <button type="button" className="secondary-button" disabled={busy} onClick={()=>void run(refresh)}>{t("Обновить")}</button></div>
  <ul>{fields.map(field=><li key={field.id}><strong data-no-translate>{field.title}</strong> · {t(customFieldTypes[field.type])}{field.archived?` · ${t("Архив")}`:""}
    <button type="button" className="text-button" disabled={busy} onClick={()=>choose(field)}>{t("Настроить")}</button></li>)}</ul>
  {draft?<form onSubmit={event=>{event.preventDefault();void run(async()=>{const value=await previewSharedCustomField(spaceId,draft);if(live.current){setPreview(value);pending.current=null;}});}}>
    <fieldset disabled={busy}><legend>{t("Настройки поля")}</legend>
      <label>{t("Название")}<input value={draft.title} maxLength={160} required onChange={event=>edit({...draft,title:event.target.value})}/></label>
      <label>{t("Тип поля")}<select value={draft.type} onChange={event=>edit({...draft,type:event.target.value as CustomFieldType,options:[]})}>{Object.entries(customFieldTypes).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
      <label>{t("Область поля")}<select value={draft.projectId??""} onChange={event=>edit({...draft,projectId:event.target.value||null})}><option value={projectId}>{t("Этот проект")}</option><option value="">{t("Всё пространство")}</option></select></label>
      <label>{t("Порядок")}<input type="number" min={-100000} max={100000} step={1} value={draft.position} required onChange={event=>edit({...draft,position:event.target.valueAsNumber})}/></label>
      {([['required','Обязательное поле'],['showCard','Показывать в карточке'],['showList','Показывать в списке'],['archived','Архивировать поле']] as const).map(([key,label])=><label className="shared-custom-field-check" key={key}><input type="checkbox" checked={draft[key]} onChange={event=>edit({...draft,[key]:event.target.checked})}/>{t(label)}</label>)}
      <p>{t("Архив сохраняет значения. Снимите отметку, чтобы восстановить поле. Новые обязательные поля проверяются при создании, заполнении полей или завершении задачи.")}</p>
      {['select','multi'].includes(draft.type)?<div className="shared-custom-field-options">{draft.options.map((option,index)=><div className="shared-custom-field-option" key={option.id}>
        <label>{t("Вариант списка")}<input value={option.title} maxLength={160} required onChange={event=>edit({...draft,options:draft.options.map((row,i)=>i===index?{...row,title:event.target.value}:row)})}/></label>
        <label className="shared-custom-field-check"><input type="checkbox" checked={option.archived} onChange={event=>edit({...draft,options:draft.options.map((row,i)=>i===index?{...row,archived:event.target.checked}:row)})}/>{t("Архив")}</label>
      </div>)}<button type="button" disabled={draft.options.length>=200} onClick={()=>edit({...draft,options:[...draft.options,{id:crypto.randomUUID(),title:"",archived:false}]})}>{t("Добавить вариант")}</button>
      <p>{t("Архивный вариант сохраняется в старых задачах и недоступен для новых назначений.")}</p></div>:null}
      <div className="shared-custom-field-actions"><button type="submit" className="secondary-button">{t("Предпросмотр изменений")}</button>
      <button type="button" className="secondary-button" onClick={()=>{if(window.confirm(t("Отменить несохранённые изменения поля?"))){setDraft(null);setPreview(null);pending.current=null;}}}>{t("Отмена")}</button>
      {draft.expectedRevision?<button type="button" className="secondary-button" onClick={()=>void run(async()=>{const value=await loadSharedCustomFieldHistory(draft.id);if(live.current)setHistory(value.versions);})}>{t("История поля")}</button>:null}</div>
    </fieldset>
    {preview?<section className="shared-custom-field-preview"><p>{t("Задач со значением: {count}").replace('{count}',new Intl.NumberFormat(language).format(preview.valueCount))}</p>
      {preview.replaceType?<label className="shared-custom-field-check"><input type="checkbox" checked={confirm} disabled={busy} onChange={event=>setConfirm(event.target.checked)}/>{t("Создать поле нового типа. Прежнее поле и все его значения останутся в архиве.")}</label>:null}
      <button type="button" className="primary-button" disabled={busy||preview.replaceType&&!confirm} onClick={()=>void apply()}>{t("Применить")}</button></section>:null}
  </form>:null}
  {history.length?<section><h4>{t("История поля")}</h4><ol>{history.map(row=><li key={row.field.revision}><time dateTime={row.createdAt}>{new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.createdAt))}</time> · <span data-no-translate>{row.field.title}</span> · {t(customFieldTypes[row.field.type])} · {row.field.archived?t("Архив"):t("Действующее поле")}
    <button type="button" className="secondary-button" onClick={()=>{const current=fields.find(field=>field.id===row.field.id);if(current)edit({...customFieldDraft(row.field),expectedRevision:current.revision});}}>{t("Использовать эти настройки")}</button></li>)}</ol></section>:null}
  {busy?<p role="status">{t("Загрузка…")}</p>:null}{error?<p role="alert">{error}</p>:null}{status?<p role="status">{status}</p>:null}
 </details>;
}
