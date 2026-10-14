<?php
declare(strict_types=1);
if (!function_exists('genesisDb')) { foreach (['bootstrap','repository','google','shared-projects'] as $file) require dirname(__DIR__).'/src/'.$file.'.php'; }
function privateExpect(bool $value,string $message): void { if(!$value)throw new RuntimeException($message); }
function privateReject(callable $action): void { try{$action();}catch(GenesisSharedAccessException|InvalidArgumentException){return;}throw new RuntimeException('Private access or invalid mutation succeeded'); }
$db=genesisDb();$users=['private-owner','private-peer','private-admin','private-pending','private-outsider'];
foreach($users as $id){$db->prepare('INSERT INTO users(id,google_sub,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')->execute([$id,$id,$id.'@gmail.com',$id,genesisNow(),genesisNow()]);genesisUpdateAccountPreferences($id,['sharedProjectsEnabled'=>true]);}
[$owner,$peer,$admin,$pending,$outsider]=$users;
try{
  $space=genesisSharedCreateSpace($owner,['title'=>'Private collaboration']);$spaceId=$space['id'];
  $invite=genesisSharedSpaceInvite($owner,$spaceId,['email'=>$pending.'@gmail.com']);
  privateExpect(count(genesisSharedSpaceInvitations($pending))===1,'Pending invitation disappeared.');
  privateReject(fn()=>genesisSharedSpaceParticipants($pending,$spaceId));privateReject(fn()=>genesisSharedSpaceParticipants($outsider,$spaceId));
  privateExpect(genesisSharedOverview($pending)['tasks']===0 && genesisSharedSpaces($pending)===[],'Invitation granted access before acceptance.');
  genesisSharedRespondSpaceInvitation($pending,$invite['id'],true);privateExpect(count(genesisSharedSpaceParticipants($pending,$spaceId)['members'])===2,'Accepted invitation did not grant access.');
  $invite=genesisSharedSpaceInvite($owner,$spaceId,['email'=>$outsider.'@gmail.com']);genesisSharedRevokeSpaceInvitation($owner,$spaceId,$invite['id']);privateReject(fn()=>genesisSharedRespondSpaceInvitation($outsider,$invite['id'],true));
  foreach([$peer=>'member',$admin=>'admin'] as $id=>$role)$db->prepare('INSERT INTO shared_space_members(space_id,user_id,role,joined_at) VALUES(?,?,?,?)')->execute([$spaceId,$id,$role,genesisNow()]);
  $present=genesisSharedSpaceParticipants($peer,$spaceId,true);privateExpect((bool)array_filter($present['members'],fn($row)=>$row['userId']===$peer&&$row['viewing']),'Presence did not update.');
  $tabA=genesisUuid();$tabB=genesisUuid();genesisSharedSpaceParticipants($peer,$spaceId,true,$tabA);genesisSharedSpaceParticipants($peer,$spaceId,true,$tabB);genesisSharedSpaceParticipants($peer,$spaceId,false,$tabA);genesisSharedSpaceParticipants($peer,$spaceId,false);
  privateExpect((bool)array_filter(genesisSharedSpaceParticipants($owner,$spaceId)['members'],fn($row)=>$row['userId']===$peer&&$row['viewing']),'Closing one tab hid another active tab.');
  $db->prepare('UPDATE shared_space_presence SET last_seen_at=? WHERE user_id=?')->execute([time()-91,$peer]);privateExpect(!array_filter(genesisSharedSpaceParticipants($owner,$spaceId)['members'],fn($row)=>$row['userId']===$peer&&$row['viewing']),'Stale presence stayed online.');
  $project=genesisSharedCreateProject($owner,$spaceId,['title'=>'Member project']);$status=genesisSharedProjectSnapshot($owner,$project['id'])['statuses'][0]['id'];
  $db->prepare('DELETE FROM shared_project_members WHERE project_id=? AND user_id=?')->execute([$project['id'],$admin]);
  $db->prepare('INSERT INTO shared_project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)')->execute([$project['id'],$peer,'member',genesisNow()]);
  genesisSharedTask($owner,$project['id'],['title'=>'Only assigned members','statusId'=>$status,'dueDate'=>'2026-10-14']);
  privateExpect(genesisSharedOverview($peer)['projects']===1&&genesisSharedOverview($peer)['tasks']===1,'Own counters are inaccurate.');
  privateExpect(genesisSharedOverview($admin)['projects']===0&&genesisSharedOverview($admin)['tasks']===0,'Workspace admin saw totals for projects they did not join.');
  // Real valid public points; no private scalar is ever stored by the API.
  $key=['kty'=>'EC','crv'=>'P-256','x'=>'axfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpY','y'=>'T-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU'];
  $a=genesisSharedMessagingKey($owner,['publicKey'=>$key]);$b=genesisSharedMessagingKey($peer,['publicKey'=>$key]);
  privateReject(fn()=>genesisSharedMessagingKey($owner,['publicKey'=>$key+['d'=>'secret']]));
  $changed=$key;$changed['x']='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';privateReject(fn()=>genesisSharedMessagingKey($owner,['publicKey'=>$changed]));
  $conversation=genesisSharedPrivateConversation($owner,$spaceId,['userId'=>$peer]);$cid=$conversation['id'];
  privateExpect(genesisSharedPrivateConversation($peer,$spaceId,['userId'=>$owner])['id']===$cid,'Pair created duplicate conversations.');
  $payload=['version'=>1,'iv'=>'AAAAAAAAAAAAAAAA','ciphertext'=>str_repeat('A',44),'keyIds'=>[$owner=>$a['keyId'],$peer=>$b['keyId']]];$id=genesisUuid();
  genesisSharedPrivateSave($owner,$cid,['id'=>$id,'payload'=>$payload]);genesisSharedPrivateSave($owner,$cid,['id'=>$id,'payload'=>$payload]);
  privateExpect(count(genesisSharedPrivateMessages($peer,$cid)['messages'])===1,'Retry duplicated message.');
  privateReject(fn()=>genesisSharedPrivateMessages($admin,$cid));privateReject(fn()=>genesisSharedPrivateMessages($outsider,$cid));
  privateReject(fn()=>genesisSharedPrivateSave($peer,$cid,['expectedRevision'=>1,'payload'=>$payload],'PATCH',$id));
  privateReject(fn()=>genesisSharedPrivateSave($peer,$cid,['expectedRevision'=>1],'DELETE',$id));
  privateReject(fn()=>genesisSharedPrivateSave($owner,$cid,['expectedRevision'=>2,'payload'=>$payload],'PATCH',$id));
  privateReject(fn()=>genesisSharedPrivateSave($owner,$cid,['id'=>genesisUuid(),'payload'=>$payload+['text'=>'plaintext']]));
  privateExpect(genesisSharedPrivateInbox($peer)['conversations'][0]['unread']===1&&genesisSharedPrivateInbox($admin)['conversations']===[],'Inbox violated privacy.');
  privateExpect(!str_contains(json_encode(genesisSharedPrivateInbox($peer)),'ciphertext'),'Notification leaked message body.');
  $message=genesisSharedPrivateMessages($peer,$cid)['messages'][0];genesisSharedPrivateRead($peer,$cid,['seq'=>$message['seq']]);privateExpect(genesisSharedPrivateInbox($peer)['conversations']===[],'Read receipt did not persist.');
  genesisSharedPrivateSave($owner,$cid,['expectedRevision'=>1,'payload'=>$payload],'PATCH',$id);privateExpect(genesisSharedPrivateMessages($peer,$cid)['messages'][0]['revision']===2,'Edit revision failed.');
  genesisSharedPrivateSave($owner,$cid,['expectedRevision'=>2],'DELETE',$id);$message=genesisSharedPrivateMessages($peer,$cid)['messages'][0];privateExpect($message['payload']===null&&$message['deletedAt']!==null,'Deleted ciphertext survived.');
  $db->prepare('DELETE FROM shared_space_members WHERE space_id=? AND user_id=?')->execute([$spaceId,$peer]);
  privateReject(fn()=>genesisSharedPrivateMessages($peer,$cid));privateReject(fn()=>genesisSharedPrivateMessages($owner,$cid));
  privateExpect(genesisSharedOverview($peer)['tasks']===0&&genesisSharedCalendarTasks($peer,'2026-10-01','2026-10-31')===[],'Revoked workspace access survived in counters or calendar.');
  $backup=tempnam(sys_get_temp_dir(),'genesis-private-backup-');try{$db->exec('VACUUM INTO '.$db->quote($backup));$snapshot=new PDO('sqlite:'.$backup);privateExpect($snapshot->query('PRAGMA integrity_check')->fetchColumn()==='ok','Consistent backup failed.');privateExpect((int)$snapshot->query('SELECT COUNT(*) FROM shared_private_conversations')->fetchColumn()>=1,'Backup lost messaging metadata.');}finally{$snapshot=null;if(is_file($backup))unlink($backup);}
}finally{foreach($users as $id)if(genesisFindUser($id))genesisDeleteAccount($id);}
echo "Private messages, author/revision ACL, invitations, presence, per-user counters and backup passed.\n";
