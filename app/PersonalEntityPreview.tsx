"use client";
import { DialogCloseButton } from "./DialogCloseButton";
import {useEffect,useRef,useState} from 'react';
import {ExperimentalIcon} from './ExperimentalIcon';
import {translateText,type Language} from './i18n';
import type {SharedComment,GenesisTask,GenesisProject,GoogleTaskList} from './cloud-sync';

export type PersonalPreviewData={title:string;description?:string;kind:string;tags?:string[];fields:[string,string][];comments:SharedComment[]};
export default function PersonalEntityPreview({task,project,list,schedule,projectTitle,taskCount,language,onClose,onEdit,onComment}:{task?:GenesisTask;project?:GenesisProject;list?:GoogleTaskList;schedule:string;projectTitle:string;taskCount:number;language:string;onClose:()=>void;onEdit:()=>void;onComment:(body:string)=>Promise<void>}){
  const dialog=useRef<HTMLDialogElement>(null),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false),pending=useRef(false);
  useEffect(()=>{dialog.current?.showModal();},[]);
  const entity=task??project??list;
  if(!entity)return null;
  const date=(value:string|number|undefined|null)=>value?new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
  const data:PersonalPreviewData={title:entity.title,kind:task?({task:'Задача',meeting:'Встреча',event:'Событие',birthday:'День рождения'}[task.entryType??'task']):project?'Проект':'Список задач',description:task?.description??project?.description,tags:task?.tags??project?.tags,comments:entity.comments??[],fields:task?[['Создатель',task.createdByName??'—'],['Создано',date(task.createdAt)],['Обновлено',date(task.updatedAt)],['Срок',schedule],['Проект',projectTitle]]:project?[['Создатель',project.createdByName??'—'],['Создано',date(project.createdAt)],['Задачи',String(taskCount)]]:[['Задачи',String(taskCount)],['Обновлено',date(list?.updatedAt)]]};
  const t=(text:string)=>translateText(text,language as Language);
  return <dialog ref={dialog} aria-labelledby="personal-preview-title" className="shared-projects-modal entity-preview-modal" onClose={onClose}>
    <header><h2 id="personal-preview-title" data-no-translate>{data.title}</h2><DialogCloseButton type="button" className="icon-button" aria-label={t('Закрыть')} onClick={onClose} /></header>
    <div className="entity-preview-columns"><section className="entity-information"><h3>{t(data.kind)}</h3>{data.description?<p data-no-translate>{data.description}</p>:null}<dl>{data.fields.map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd data-no-translate>{value||'—'}</dd></div>)}</dl>{data.tags?.length?<p data-no-translate>{data.tags.map(tag=>`#${tag}`).join(' ')}</p>:null}<button className="secondary-button" type="button" onClick={onEdit}><ExperimentalIcon name="edit"/>{t('Редактировать')}</button></section>
    <section className="shared-task-comments"><h3>{t('Комментарии')} · {data.comments.length}</h3>{data.comments.map(comment=><article key={comment.id}><header><strong data-no-translate>{comment.authorName}</strong><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(comment.createdAt))}</time></header><p data-no-translate>{comment.body}</p></article>)}<form onSubmit={event=>{event.preventDefault();if(pending.current||!body.trim())return;pending.current=true;setBusy(true);setError(false);void onComment(body.trim()).then(()=>setBody('')).catch(()=>setError(true)).finally(()=>{pending.current=false;setBusy(false);});}}><label>{t('Комментарий')}<textarea value={body} maxLength={5000} disabled={busy} onChange={event=>setBody(event.target.value)}/></label><button className="primary-button" disabled={busy||!body.trim()}>{t('Отправить комментарий')}</button></form>{error?<p role="alert">{t('Не удалось сохранить изменения')}</p>:null}</section></div>
  </dialog>;
}
