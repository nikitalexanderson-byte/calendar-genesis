import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarModule } from './helpers/calendar-modules.mjs';
import { cloudSyncClient, MemoryStorage, deferred } from './helpers/cloud-sync-client.mjs';
const { DiaryRepository } = calendarModule('app/diary-storage.ts');
const { newDiaryNote, validateDiaryNote, reactToAdvice, restoreDiaryNote, diaryCustomInk } = calendarModule('app/diary-model.ts');
const advice = { id:'catalog-advice-123', dayKey:'2026-10-26', title:'A useful thought', body:'Private saved advice snapshot', language:'en', categories:['aretology'], dismissed:false, sources:[{work:'Original book',kind:'inspired'}] };
const note = () => newDiaryNote('A private diary thought', 'Private diary title');
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
async function fixture() {
 const a=await cloudSyncClient({userId:'diary-owner'}), b=await cloudSyncClient({userId:a.userId,key:a.key});
 const rows=new Map(), last=new Map(); let writes=0;
 const respond=async(url,init)=>{
  const path=new URL(url).pathname;
  if(path==='/api/diary')return response({notes:[...rows.values()]});
  assert.match(path,/^\/api\/diary\/[\w-]+$/);const id=path.split('/').at(-1),body=JSON.parse(init.body),old=rows.get(id);
  if(last.get(id)===init.body)return response({revision:old.revision,updatedAt:old.updatedAt});
  if(body.expectedRevision!==(old?.revision??0))return response({error:'DIARY_REVISION_CONFLICT'},409);
  writes++;const row={id,revision:body.expectedRevision+1,schemaVersion:1,iv:body.iv,ciphertext:body.ciphertext,updatedAt:new Date().toISOString()};rows.set(id,row);last.set(id,init.body);return response({revision:row.revision,updatedAt:row.updatedAt});
 };
 a.respond(respond);b.respond(respond);const storage=new MemoryStorage(),otherStorage=new MemoryStorage();
 return {a,b,rows,storage,otherStorage,respond,get writes(){return writes;},
   left:new DiaryRepository(a.userId,storage,a.client.personalDocumentAccess(a.userId)),right:new DiaryRepository(b.userId,otherStorage,b.client.personalDocumentAccess(b.userId))};
}
test('custom palette colors survive encrypted sync and retain a legacy preset fallback', async()=>{
 const f=await fixture(), original={...note(),color:'rose',customColor:'#15aB73'};
 await f.left.save(original);
 const copied=(await f.right.list()).find(row=>row.note.id===original.id).note;
 assert.equal(copied.customColor,'#15aB73');assert.equal(copied.color,'rose');
 assert.equal(validateDiaryNote(restoreDiaryNote(copied)).customColor,'#15aB73');
 for(const customColor of ['red','#123','#12345678','url(secret)',123,{}])assert.throws(()=>validateDiaryNote({...original,customColor}));
 assert.equal(diaryCustomInk('#ffffff'),'#000000');assert.equal(diaryCustomInk('#000000'),'#ffffff');
 assert.equal(diaryCustomInk('#ffff00'),'#000000');assert.equal(diaryCustomInk('#112233'),'#ffffff');
});

test('favorites and dislikes retain the original advice; dislikes archive and can be restored',()=>{
 const favorite=reactToAdvice(advice,'opaque-key','favorite');assert.equal(favorite.reaction,'favorite');assert.equal(favorite.archived,false);
 const unstarred=reactToAdvice(advice,'opaque-key','favorite',favorite);assert.equal(unstarred.reaction,null);assert.equal(unstarred.body,advice.body);
 const disliked=reactToAdvice(advice,'opaque-key','dislike',favorite);assert.equal(disliked.archived,true);assert.equal(disliked.reaction,'dislike');assert.deepEqual(disliked.advice,advice);
 const restored=restoreDiaryNote(disliked);assert.equal(restored.archived,false);assert.equal(restored.reaction,null);assert.equal(restored.id,favorite.id);
 assert.equal(reactToAdvice({...advice,title:'x'.repeat(500)},'opaque-key','favorite').advice.title.length,500);
 for(const change of [{version:2},{body:''},{body:'x'.repeat(30001)},{reaction:'dislike',archived:false},{id:'../escape'}])assert.throws(()=>validateDiaryNote({...favorite,...change}));
});
test('real account encryption protects server envelopes, cache and account-private advice identifiers',async()=>{
 const f=await fixture();await f.left.list();const value=note();await f.left.save(value);assert.deepEqual((await f.right.list())[0].note,value);
 const serialized=JSON.stringify([...f.rows.values()])+JSON.stringify([...f.storage.data.values()]);assert.ok(!serialized.includes(value.body)&&!serialized.includes(value.title));
 assert.ok(f.a.requests.every(row=>!row.url.endsWith('/workspace')));
 const id=await f.left.adviceId(advice.id);assert.equal(id,await f.right.adviceId(advice.id));assert.match(id,/^[0-9a-f]{64}$/);assert.ok(!id.includes(advice.id));
 const other=await cloudSyncClient({userId:'different-owner',key:f.a.key});assert.notEqual(id,await other.client.personalDocumentAccess(other.userId).privateId(`diary-advice:${advice.id}`));
 const access=f.a.client.personalDocumentAccess(f.a.userId),e=await access.seal(value,`diary-note:v1:${value.id}`);
 await assert.rejects(access.open(e,'diary-note:v1:another-id'));await assert.rejects(other.client.personalDocumentAccess(other.userId).open(e,`diary-note:v1:${value.id}`));
});
test('a lost reply reuses the same encrypted attempt after reload and does not duplicate a note',async()=>{
 const f=await fixture();await f.left.list();let lost=true;f.a.respond(async(url,init)=>{const result=await f.respond(url,init);if(init.method==='PUT'&&lost){lost=false;throw new TypeError('Lost reply');}return result;});
 const value=note();await assert.rejects(f.left.save(value));assert.equal(f.writes,1);assert.ok([...f.storage.data.keys()].some(k=>k.includes(':draft:')));
 const reloaded=new DiaryRepository(f.a.userId,f.storage,f.a.client.personalDocumentAccess(f.a.userId));const pending=(await reloaded.list()).find(row=>row.draftKey);assert.deepEqual(pending.note,value);
 await reloaded.save({...value,updatedAt:new Date(Date.now()+1000).toISOString()},pending);assert.equal(f.writes,1);assert.equal((await reloaded.list()).filter(row=>row.draftKey).length,0);
});
test('two tabs keep independent encrypted drafts and conflicts preserve both versions',async()=>{
 const f=await fixture();await f.left.list();const value=note(),saved=await f.left.save(value);const remote=(await f.right.list())[0];
 await f.left.save({...value,body:'First window version'},saved);await assert.rejects(f.right.save({...value,body:'Second window version'},remote),/DIARY_REVISION_CONFLICT/);
 const records=await f.right.list();assert.equal(records.find(row=>!row.draftKey).note.body,'First window version');assert.equal(records.find(row=>row.draftKey).note.body,'Second window version');
 const third=new DiaryRepository(f.a.userId,f.otherStorage,f.b.client.personalDocumentAccess(f.b.userId));await third.keepDraft({...value,body:'Third window draft'},remote);
 assert.equal((await third.list()).filter(row=>row.draftKey).length,2);assert.ok(![...f.otherStorage.data.values()].join('').includes('Second window version'));
});
test('offline drafts survive reload and storage failure prevents an unjournaled network write',async()=>{
 const f=await fixture();await f.left.list();f.a.respond(async()=>{throw new TypeError('Offline');});const value=note();await assert.rejects(f.left.save(value));
 const reloaded=new DiaryRepository(f.a.userId,f.storage,f.a.client.personalDocumentAccess(f.a.userId));assert.equal((await reloaded.list()).find(row=>row.draftKey).note.body,value.body);assert.equal(reloaded.offline,true);
 f.storage.setItem=()=>{throw new Error('Quota');};const before=f.a.requests.length;await assert.rejects(f.left.save({...note(),body:'Another note'}),/Quota/);assert.equal(f.a.requests.length,before);
});
test('a malformed save receipt and a late response after session close retain the encrypted draft',async()=>{
 const f=await fixture();await f.left.list();f.a.respond(async(url,init)=>init.method==='PUT'?response({revision:0,updatedAt:'invalid'}):f.respond(url,init));await assert.rejects(f.left.save(note()),/DIARY_INVALID_RESPONSE/);assert.ok([...f.storage.data.keys()].some(k=>k.includes(':draft:')));
 const g=await fixture();await g.left.list();const gate=deferred(),entered=deferred();g.a.respond(async(url,init)=>{if(init.method==='PUT'){entered.resolve();await gate.promise;}return g.respond(url,init);});const write=g.left.save(note());await entered.promise;g.left.dispose();gate.resolve();await assert.rejects(write,/DIARY_SESSION_CLOSED/);assert.ok([...g.storage.data.keys()].some(k=>k.includes(':draft:')));
});
test('a draft encryption already in flight finishes before save and cannot recreate an acknowledged draft',async()=>{
 const f=await fixture();await f.left.list();const value=note(),gate=f.a.holdCrypto('encrypt');
 const draft=f.left.keepDraft(value);await gate.entered;const save=f.left.save(value);gate.release();await draft;await save;
 assert.equal((await f.left.list()).filter(row=>row.draftKey).length,0);assert.equal(f.writes,1);
});
test('an earlier slow read cannot erase a newly acknowledged note from the encrypted offline cache',async()=>{
 const f=await fixture();await f.left.list();const gate=deferred(),entered=deferred();let slow=true;
 f.a.respond(async(url,init)=>{if(!init.method&&slow){slow=false;entered.resolve();await gate.promise;return response({notes:[]});}return f.respond(url,init);});
 const read=f.left.list();await entered.promise;const value=note();await f.left.save(value);gate.resolve();await read;
 f.a.respond(async()=>{throw new TypeError('Offline');});assert.equal((await f.left.list())[0].note.body,value.body);
});
