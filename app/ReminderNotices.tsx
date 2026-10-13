"use client";
import {useEffect,useState} from "react";
import {WEB_REMINDER_EVENT,unlockReminderAudio,type WebReminderKind} from "./web-reminder-presentation";
import {ExperimentalIcon} from "./ExperimentalIcon";
import {translateText} from "./i18n";
import {LOCAL_SESSION_ENDED_EVENT} from "./cloud-sync";
export function ReminderNotices({appBase}:{appBase:string}) {
 const [notes,setNotes]=useState<{id:string;kind:WebReminderKind;title:string;body:string}[]>([]);
 useEffect(()=>{const remove=unlockReminderAudio(appBase);const notify=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!detail||!["task","habit"].includes(detail.kind))return;setNotes(current=>[...current.slice(-2),{...detail,id:crypto.randomUUID()}]);};const clear=()=>setNotes([]);
 window.addEventListener(WEB_REMINDER_EVENT,notify);window.addEventListener(LOCAL_SESSION_ENDED_EVENT,clear);return()=>{remove?.();window.removeEventListener(WEB_REMINDER_EVENT,notify);window.removeEventListener(LOCAL_SESSION_ENDED_EVENT,clear);};},[appBase]);
 return <div className="reminder-notices" aria-live="polite">{notes.map(note=><article key={note.id} className={`reminder-notice reminder-${note.kind}`} role="status"><ExperimentalIcon name={note.kind==="task"?"check":"habits"}/><div><strong>{translateText(note.kind==="task"?"Задача":"Привычка")}</strong><p data-no-translate>{note.title}</p><small data-no-translate>{note.body}</small></div><button type="button" aria-label={translateText("Закрыть")} onClick={()=>setNotes(current=>current.filter(value=>value.id!==note.id))}><ExperimentalIcon name="close"/></button></article>)}</div>;
}
