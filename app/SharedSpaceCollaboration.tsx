"use client";
import { useEffect,useRef,useState } from 'react';
import { ExperimentalIcon } from './ExperimentalIcon';
import { translateText } from './i18n';
import { collaborationText } from './collaboration-copy';
import { spaceParticipants,messagingKey,openConversation,privateMessages,privateInbox,savePrivateMessage,deletePrivateMessage,readPrivateMessages,type SpaceParticipant,type PrivateMessage,type PrivateNotice } from './private-messages-api';
import { createMessagingIdentity,keyFingerprint,conversationKey,encryptPrivateMessage,decryptPrivateMessage,securityCode,exportMessagingBackup,importMessagingBackup,type MessagingIdentity } from './private-message-crypto';
import {loadMessagingIdentity,saveMessagingIdentity,claimMessagingIdentity,pinPeerKey} from './private-message-vault';
import './shared-space-collaboration.css';
type Peer={spaceId:string;userId:string;displayName:string};

async function identityFor(userId:string,create=false):Promise<MessagingIdentity|null>{
  const server=await messagingKey(),saved=await loadMessagingIdentity(userId);
  if(saved&&(!server.keyId||saved.keyId===server.keyId)){await messagingKey(saved.publicKey);return saved;}
  if(server.keyId)throw new Error('LOCAL_KEY_MISSING');
  if(!create)return null;
  const identity=await claimMessagingIdentity(userId,await createMessagingIdentity());if(!identity)throw new Error('KEY_STORAGE_UNAVAILABLE');await messagingKey(identity.publicKey);return identity;
}
function KeyRecovery({userId,onReady,identity,missing,language}:{userId:string;onReady:(key:MessagingIdentity)=>void;identity:MessagingIdentity|null;missing:boolean;language:string}){
  const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const c=(key:Parameters<typeof collaborationText>[0])=>collaborationText(key,language);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError(false);try{await action();}catch{setError(true);}finally{setBusy(false);}};
  return <details className="shared-key-recovery" open={!identity} data-no-translate><summary>{identity?c('backup'):c('restore')}</summary><p>{c('recovery')} {c('signOut')}</p>
    {missing?<p role="status">{c('missing')}</p>:!identity?<button type="button" className="primary-button" disabled={busy} onClick={()=>void run(async()=>{const key=await identityFor(userId,true);if(key)onReady(key);})}>{c('enable')}</button>:null}
    <label>{c('password')}<input type="password" minLength={12} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)}/></label>
    <div className="shared-key-actions">{identity?<button type="button" className="secondary-button" disabled={busy||password.length<12} onClick={()=>void run(async()=>{
      const source=await exportMessagingBackup(identity,password),url=URL.createObjectURL(new Blob([source],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='genesis-private-messages-key.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setPassword('');
    })}>{c('backup')}</button>:null}
    <label className="shared-key-import">{c('restore')}<input type="file" accept=".json,application/json" disabled={busy||password.length<12} onChange={event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;void run(async()=>{if(file.size>4000)throw new Error('INVALID_BACKUP');const key=await importMessagingBackup(await file.text(),password),server=await messagingKey();if(server.keyId&&server.keyId!==key.keyId)throw new Error('KEY_MISMATCH');await messagingKey(key.publicKey);await saveMessagingIdentity(userId,key);setPassword('');onReady(key);});
    }}/></label></div>{error?<p role="alert">{c('failure')}</p>:null}</details>;
}

export function SharedPrivateMessages({userId,peer,language,onClose}:{userId:string;peer:Peer;language:string;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),generation=useRef(0);
  const [identity,setIdentity]=useState<MessagingIdentity|null>(null),[missing,setMissing]=useState(false),[error,setError]=useState(false),[loading,setLoading]=useState(true);
  const [ready,setReady]=useState<{id:string;key:CryptoKey;keyIds:Record<string,string>;code:string}|null>(null);
  const [messages,setMessages]=useState<(PrivateMessage&{text:string;failed?:boolean})[]>([]),[cursor,setCursor]=useState<number|null>(null);
  const [draft,setDraft]=useState(''),[editing,setEditing]=useState<PrivateMessage|null>(null),[busy,setBusy]=useState(false),[peerMissing,setPeerMissing]=useState(false);
  const c=(key:Parameters<typeof collaborationText>[0])=>collaborationText(key,language),t=(text:string)=>translateText(text,language as import('./i18n').Language);
  useEffect(()=>{const guard=generation;dialog.current?.showModal();return()=>{guard.current++;};},[]);
  useEffect(()=>{let active=true;void identityFor(userId).then(key=>{if(active)setIdentity(key);}).catch(()=>{if(active)setMissing(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[userId]);
  useEffect(()=>{
    const guard=generation;++guard.current;if(!identity)return;const controller=new AbortController();let inFlight=false;
    const start=async()=>{try{
      const {members}=await spaceParticipants(peer.spaceId,undefined,controller.signal),member=members.find(item=>item.userId===peer.userId);
      if(!member?.publicKey||!member.keyId){if(!controller.signal.aborted)setPeerMissing(true);return;}
      if(await keyFingerprint(member.publicKey)!==member.keyId)throw new Error('INVALID_PEER_KEY');
      await pinPeerKey(userId,peer.userId,member.keyId);const conversation=await openConversation(peer.spaceId,peer.userId),key=await conversationKey(identity,member.publicKey,conversation.id,peer.spaceId),code=await securityCode([identity.keyId,member.keyId]);
      if(controller.signal.aborted)return;
      setReady({id:conversation.id,key,keyIds:{[userId]:identity.keyId,[peer.userId]:member.keyId},code});setPeerMissing(false);setError(false);
    }catch{if(!controller.signal.aborted){setError(true);setReady(null);setMessages([]);}}};
    const retry=()=>{if(inFlight||document.visibilityState!=='visible')return;inFlight=true;void start().finally(()=>{inFlight=false;});};retry();const timer=setInterval(retry,30000);
    return()=>{controller.abort();clearInterval(timer);guard.current++;};
  },[identity,userId,peer.spaceId,peer.userId]);
  const load=async(before=0)=>{
    if(!ready)return;const version=generation.current;let result=await privateMessages(ready.id,before),rows=result.messages;
    if(!before){const oldest=messages[0]?.seq;while(oldest&&result.nextCursor&&rows[0]?.seq>oldest){result=await privateMessages(ready.id,result.nextCursor);rows=[...result.messages,...rows];if(version!==generation.current)return;}}
    const decoded=await Promise.all(rows.map(async message=>{if(!message.payload)return {...message,text:c('deleted')};try{return {...message,text:await decryptPrivateMessage(ready.key,{conversationId:ready.id,spaceId:peer.spaceId,id:message.id,senderId:message.senderId,revision:message.revision},message.payload,ready.keyIds)};}catch{return {...message,text:c('cannotDecrypt'),failed:true};}}));
    if(version!==generation.current)return;
    setMessages(old=>before?[...decoded,...old.filter(item=>!decoded.some(row=>row.id===item.id))]:decoded);setCursor(result.nextCursor);
    if(!before&&rows.length){await readPrivateMessages(ready.id,rows.at(-1)!.seq);window.dispatchEvent(new Event('genesis:private-updates'));}
  };
  const loadRef=useRef(load);useEffect(()=>{loadRef.current=load;});
  useEffect(()=>{if(!ready)return;let active=true,pending=false;const refresh=()=>{if(pending||document.visibilityState!=='visible')return;pending=true;void loadRef.current().catch(()=>{if(active){setError(true);setMessages([]);setReady(null);}}).finally(()=>{pending=false;});};refresh();const timer=setInterval(refresh,10000);return()=>{active=false;clearInterval(timer);};},[ready]);
  const run=async(action:()=>Promise<void>,reload=true)=>{if(busy)return;setBusy(true);setError(false);try{await action();if(reload)await load();}catch{setError(true);}finally{setBusy(false);}};
  return <dialog ref={dialog} className="shared-projects-modal shared-private-dialog" data-no-translate aria-labelledby="shared-private-title" onClose={onClose} onCancel={event=>{if(busy)event.preventDefault();}}>
    <header><h2 id="shared-private-title">{c('messages')} · {peer.displayName}</h2><button type="button" className="shared-projects-close" disabled={busy} aria-label={t('Закрыть')} onClick={()=>dialog.current?.close()}><ExperimentalIcon name="close"/></button></header><p>{c('encrypted')}</p>
    {loading?<p role="status">{t('Загрузка…')}</p>:<KeyRecovery userId={userId} identity={identity} missing={missing} language={language} onReady={key=>{setIdentity(key);setMissing(false);}}/>}{peerMissing?<p role="status">{c('peerMissing')}</p>:null}
    {ready?<><details className="shared-security-code"><summary>{c('code')}</summary><code>{ready.code}</code><p>{c('compare')}</p></details>{cursor?<button type="button" disabled={busy} onClick={()=>void run(()=>load(cursor),false)}>{t('Показать ещё')}</button>:null}
    <ol className="shared-private-messages">{messages.map(message=><li key={message.id} data-self={message.senderId===userId||undefined}><header><strong>{message.senderId===userId?t('Вы'):peer.displayName}</strong><time dateTime={message.updatedAt}>{new Intl.DateTimeFormat(language,{dateStyle:'short',timeStyle:'short'}).format(new Date(message.updatedAt))}</time></header><p role={message.failed?'alert':undefined}>{message.text}</p>
    {!message.deletedAt&&message.senderId===userId?<div className="shared-private-actions"><button type="button" disabled={busy||message.failed} onClick={()=>{setEditing(message);setDraft(message.text);}}>{t('Редактировать')}</button><button type="button" disabled={busy} onClick={()=>{if(confirm(t('Удалить сообщение?')))void run(async()=>{await deletePrivateMessage(ready.id,message);if(editing?.id===message.id){setEditing(null);setDraft('');}});}}>{t('Удалить')}</button></div>:null}</li>)}</ol>
    <form onSubmit={event=>{event.preventDefault();if(!draft.trim()||busy)return;void run(async()=>{const id=editing?.id??crypto.randomUUID(),revision=editing?editing.revision+1:1,payload=await encryptPrivateMessage(ready.key,{conversationId:ready.id,spaceId:peer.spaceId,id,senderId:userId,revision},draft,ready.keyIds);await savePrivateMessage(ready.id,id,payload,editing?.revision);setDraft('');setEditing(null);});}}><label>{editing?t('Редактировать'):c('write')}<textarea maxLength={8000} value={draft} disabled={busy} onChange={event=>setDraft(event.target.value)}/></label><div className="shared-private-actions"><button type="submit" className="primary-button" disabled={busy||!draft.trim()}>{editing?t('Сохранить'):t('Отправить')}</button>{editing?<button type="button" disabled={busy} onClick={()=>{setEditing(null);setDraft('');}}>{t('Отмена')}</button>:null}</div></form></>:null}{error?<p role="alert">{c('failure')}</p>:null}
  </dialog>;
}

export default function SharedSpaceCollaboration({userId,spaceId,language}:{userId:string;spaceId:string;language:string}){
  const [clientId]=useState(()=>crypto.randomUUID());
  const [members,setMembers]=useState<SpaceParticipant[]>([]),[error,setError]=useState(false),[peer,setPeer]=useState<Peer|null>(null),[keysOpen,setKeysOpen]=useState(false),[identity,setIdentity]=useState<MessagingIdentity|null>(null),[missing,setMissing]=useState(false);
  const c=(key:Parameters<typeof collaborationText>[0])=>collaborationText(key,language);
  useEffect(()=>{const controller=new AbortController();let inFlight=false;const refresh=()=>{if(inFlight||!navigator.onLine)return;inFlight=true;void spaceParticipants(spaceId,document.visibilityState==='visible',controller.signal,clientId).then(result=>{if(!controller.signal.aborted){setMembers(result.members);setError(false);}}).catch(()=>{if(!controller.signal.aborted){setMembers([]);setError(true);}}).finally(()=>{inFlight=false;});};refresh();const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);void spaceParticipants(spaceId,false,undefined,clientId).catch(()=>{});};},[spaceId,clientId]);
  return <section className="shared-space-collaboration" data-no-translate><details><summary><ExperimentalIcon name="team"/>{c('participants')} · {members.length}<span>{c('viewing')} · {members.filter(member=>member.viewing).length}</span></summary>{error?<p role="alert">{c('failure')}</p>:null}
    <ul>{members.map(member=><li key={member.userId}><strong>{member.displayName}</strong><span>{translateText(({owner:'Владелец',admin:'Администратор',member:'Участник',guest:'Гость'} as Record<string,string>)[member.role]??'Участник',language as import('./i18n').Language)}</span>{member.viewing?<small>{c('viewing')}</small>:null}{member.userId!==userId?<button type="button" className="secondary-button" onClick={()=>setPeer({spaceId,userId:member.userId,displayName:member.displayName})}><ExperimentalIcon name="mail"/>{c('write')}</button>:null}</li>)}</ul>
    <button type="button" className="secondary-button" onClick={()=>{setKeysOpen(true);void identityFor(userId).then(setIdentity).catch(()=>setMissing(true));}}>{c('enable')}</button>{keysOpen?<KeyRecovery userId={userId} identity={identity} missing={missing} language={language} onReady={key=>{setIdentity(key);setMissing(false);}}/>:null}
    </details>{peer?<SharedPrivateMessages key={peer.userId} userId={userId} peer={peer} language={language} onClose={()=>setPeer(null)}/>:null}</section>;
}
export function SharedPrivateNotices({userId,language}:{userId:string;language:string}){
  const [items,setItems]=useState<PrivateNotice[]>([]),[open,setOpen]=useState(false),[peer,setPeer]=useState<Peer|null>(null);const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  useEffect(()=>{const controller=new AbortController();let pending=false;const refresh=()=>{if(pending||document.visibilityState!=='visible'||!navigator.onLine)return;pending=true;void privateInbox(controller.signal).then(result=>{if(!controller.signal.aborted)setItems(result.conversations);}).catch(()=>{if(!controller.signal.aborted)setItems([]);}).finally(()=>{pending=false;});};refresh();const timer=setInterval(refresh,30000);window.addEventListener('genesis:private-updates',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('genesis:private-updates',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[userId]);
  const count=items.reduce((total,item)=>total+item.unread,0);
  return <><aside className="shared-private-notices" data-no-translate aria-live="polite">{count?<button type="button" className="primary-button" onClick={()=>setOpen(true)}><ExperimentalIcon name="mail"/>{collaborationText('unread',language)} · {count}</button>:null}</aside>
    <dialog ref={dialog} className="shared-projects-modal" data-no-translate onClose={()=>setOpen(false)} aria-label={collaborationText('messages',language)}><header><h2>{collaborationText('messages',language)}</h2><button type="button" className="shared-projects-close" aria-label={translateText('Закрыть')} onClick={()=>setOpen(false)}><ExperimentalIcon name="close"/></button></header>{items.map(item=><button type="button" className="shared-private-notice" key={item.id} onClick={()=>{setOpen(false);setPeer({spaceId:item.spaceId,userId:item.peerId,displayName:item.peerName});}}><strong>{item.peerName}</strong><span>{item.spaceTitle} · {item.unread}</span></button>)}</dialog>
    {peer?<SharedPrivateMessages key={peer.spaceId+peer.userId} userId={userId} peer={peer} language={language} onClose={()=>setPeer(null)}/>:null}</>;
}
