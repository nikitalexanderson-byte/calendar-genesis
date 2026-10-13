<?php
declare(strict_types=1);
function genesisSharedTrashDays(mixed $value):int {if(!is_int($value)||$value<1||$value>30)throw new InvalidArgumentException('INVALID_TRASH_RETENTION');return $value;}
function genesisSharedTrashExpiry(string $now,int $days):string {return gmdate('Y-m-d\TH:i:s\Z',(int)strtotime($now)+$days*86400);}
function genesisSharedTrashProjectAccess(string $userId,string $projectId,string $permission):array {
 genesisSharedRequireEnabled($userId);
 $q=genesisDb()->prepare('SELECT p.*,m.role AS member_role,sm.role AS space_member_role,sm.permissions_json AS space_permissions_json,sm.can_organize_tasks FROM shared_projects p JOIN shared_project_members m ON m.project_id=p.id AND m.user_id=? JOIN shared_space_members sm ON sm.space_id=p.space_id AND sm.user_id=m.user_id WHERE p.id=?');$q->execute([$userId,$projectId]);$p=$q->fetch();
 if(!$p)throw new GenesisSharedAccessException();
 $p['permissions']=genesisSharedPermissions($p['space_member_role'],$p['space_permissions_json'],(int)$p['can_organize_tasks']===1,$p['member_role']);
 if($permission!=='read'&&!$p['permissions'][$permission])throw new GenesisSharedAccessException('SHARED_PROJECT_FORBIDDEN',403);return $p;
}
function genesisSharedTrashGoogleCleanup(PDO $db,string $taskId):void {
 $db->prepare('INSERT INTO shared_google_projection_cleanup(id,user_id,destination,google_id,google_list_id,created_at) SELECT lower(hex(randomblob(16))),user_id,destination,google_id,google_list_id,? FROM shared_google_projection_links WHERE task_id=?')->execute([genesisNow(),$taskId]);
 $db->prepare('DELETE FROM shared_google_projection_links WHERE task_id=?')->execute([$taskId]);
}
function genesisSharedTrashTask(string $userId,string $projectId,string $taskId,array $input):array {
 $days=genesisSharedTrashDays($input['retentionDays']??30);$expected=$input['expectedRevision']??null;
 if(!is_int($expected)||$expected<1)throw new InvalidArgumentException('INVALID_TASK_REVISION');
 $db=genesisDb();genesisBeginWriteTransaction($db);try{
  $project=genesisSharedTrashProjectAccess($userId,$projectId,'organizeTasks');
  $q=$db->prepare("SELECT 1 FROM shared_trash WHERE kind='task' AND object_id=? AND project_id=?");$q->execute([$taskId,$projectId]);if($q->fetchColumn()){$db->commit();return ['ok'=>true,'id'=>$taskId,'trashed'=>true];}
  genesisSharedProjectAccess($projectId,$userId,'organize');
  // The normal reader excludes expired or deleted objects and rejects stale cached writes.
  $q=$db->prepare('SELECT revision FROM shared_tasks_read WHERE id=? AND project_id=?');$q->execute([$taskId,$projectId]);$revision=$q->fetchColumn();if($revision===false)throw new GenesisSharedAccessException();if((int)$revision!==$expected)throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT',409);
  $now=genesisNow();$db->prepare("INSERT INTO shared_trash VALUES('task',?,?,?,?,?,?,?,NULL)")->execute([$taskId,$project['space_id'],$projectId,$taskId,$now,genesisSharedTrashExpiry($now,$days),$days]);
  genesisSharedTrashGoogleCleanup($db,$taskId);
  genesisSharedAudit($projectId,$userId,'task.deleted',$taskId,['retentionDays'=>$days]);
  $db->commit();return ['ok'=>true,'id'=>$taskId,'trashed'=>true];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function genesisSharedTrashProject(string $userId,string $projectId,array $input):array {
 $days=genesisSharedTrashDays($input['retentionDays']??30);$db=genesisDb();genesisBeginWriteTransaction($db);try{
  $project=genesisSharedTrashProjectAccess($userId,$projectId,'manageProjects');if($project['is_inbox'])throw new GenesisSharedAccessException('INBOX_CANNOT_BE_ARCHIVED',403);
  $q=$db->prepare("SELECT 1 FROM shared_trash WHERE kind='project' AND object_id=?");$q->execute([$projectId]);if($q->fetchColumn()){$db->commit();return ['ok'=>true];}
  if(!is_int($input['expectedRevision']??null)||(int)$project['revision']!==$input['expectedRevision'])throw new GenesisSharedAccessException('SHARED_PROJECT_CONFLICT',409);
  $q=$db->prepare('WITH RECURSIVE branch AS (SELECT id,archived_at FROM shared_projects WHERE id=? UNION SELECT p.id,p.archived_at FROM shared_projects p JOIN branch b ON p.parent_id=b.id) SELECT * FROM branch');$q->execute([$projectId]);$now=genesisNow();
  foreach($q->fetchAll() as $row){$db->prepare("INSERT OR IGNORE INTO shared_trash VALUES('project',?,?,?,?,?,?,?,?)")->execute([$row['id'],$project['space_id'],$row['id'],$projectId,$now,genesisSharedTrashExpiry($now,$days),$days,$row['archived_at']]);
   $db->prepare('UPDATE shared_projects SET archived_at=COALESCE(archived_at,?),revision=revision+1 WHERE id=?')->execute([$now,$row['id']]);
   $tasks=$db->prepare('SELECT id FROM shared_tasks WHERE project_id=?');$tasks->execute([$row['id']]);foreach($tasks->fetchAll() as $task)genesisSharedTrashGoogleCleanup($db,$task['id']);
  }
  genesisSharedAudit($projectId,$userId,'project.deleted',$projectId,['retentionDays'=>$days]);$db->commit();return ['ok'=>true];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function genesisSharedTrashList(string $userId,string $spaceId):array {
 genesisSharedRequireEnabled($userId);genesisSharedSpaceAccess($spaceId,$userId);
 $q=genesisDb()->prepare("SELECT tr.*,CASE WHEN tr.kind='task' THEN genesis_content_decrypt(t.title) ELSE p.title END AS title FROM shared_trash tr JOIN shared_projects p ON p.id=tr.project_id JOIN shared_project_members m ON m.project_id=p.id AND m.user_id=? LEFT JOIN shared_tasks t ON tr.kind='task' AND t.id=tr.object_id WHERE tr.space_id=? AND tr.object_id=tr.root_id ORDER BY tr.deleted_at DESC");$q->execute([$userId,$spaceId]);$out=[];
 foreach($q->fetchAll() as $row){$project=genesisSharedTrashProjectAccess($userId,$row['project_id'],'read');$out[]=['kind'=>$row['kind'],'id'=>$row['object_id'],'title'=>$row['title'],'deletedAt'=>$row['deleted_at'],'expiresAt'=>$row['expires_at'],'retentionDays'=>(int)$row['retention_days'],'canRestore'=>$project['permissions'][$row['kind']==='project'?'manageProjects':'organizeTasks']];}return $out;
}
function genesisSharedRestoreTrash(string $userId,string $spaceId,string $kind,string $id,array $input):array {
 if(!in_array($kind,['task','project'],true))throw new InvalidArgumentException('INVALID_TRASH_KIND');
 $db=genesisDb();genesisBeginWriteTransaction($db);try{
  $q=$db->prepare('SELECT * FROM shared_trash WHERE kind=? AND object_id=? AND space_id=?');$q->execute([$kind,$id,$spaceId]);$row=$q->fetch();if(!$row)throw new GenesisSharedAccessException();
  if($kind==='project'&&$row['root_id']!==$id)throw new GenesisSharedAccessException();
  if(isset($input['expectedExpiresAt'])&&$input['expectedExpiresAt']!==$row['expires_at'])throw new GenesisSharedAccessException('SHARED_PROJECT_CONFLICT',409);
  $project=genesisSharedTrashProjectAccess($userId,$row['project_id'],$kind==='project'?'manageProjects':'organizeTasks');
  if(strtotime($row['expires_at'])<=time())throw new GenesisSharedAccessException('TRASH_EXPIRED',409);
  if(isset($input['retentionDays'])){$days=genesisSharedTrashDays($input['retentionDays']);$expires=genesisSharedTrashExpiry($row['deleted_at'],$days);if(strtotime($expires)<=time())throw new GenesisSharedAccessException('TRASH_EXPIRED',409);
   $db->prepare('UPDATE shared_trash SET retention_days=?,expires_at=? WHERE kind=? AND root_id=? AND space_id=?')->execute([$days,$expires,$kind,$row['root_id'],$spaceId]);$db->commit();return ['ok'=>true];}
  if($kind==='project'){
   if($project['parent_id']!==null){$parent=$db->prepare('SELECT archived_at FROM shared_projects WHERE id=?');$parent->execute([$project['parent_id']]);$archived=$parent->fetchColumn();if($archived!==false&&$archived!==null)throw new GenesisSharedAccessException('RESTORE_PARENT_FIRST',409);}
   $q=$db->prepare("SELECT object_id,previous_archived_at FROM shared_trash WHERE kind='project' AND root_id=? AND space_id=?");$q->execute([$row['root_id'],$spaceId]);foreach($q->fetchAll() as $child)$db->prepare('UPDATE shared_projects SET archived_at=?,revision=revision+1,updated_at=? WHERE id=?')->execute([$child['previous_archived_at'],genesisNow(),$child['object_id']]);
   $db->prepare("DELETE FROM shared_trash WHERE kind='project' AND root_id=? AND space_id=?")->execute([$row['root_id'],$spaceId]);
  }else{
   if($project['archived_at']!==null)throw new GenesisSharedAccessException('RESTORE_PARENT_FIRST',409);
   $db->prepare('UPDATE shared_tasks SET revision=revision+1,updated_at=? WHERE id=?')->execute([genesisNow(),$id]);
   $db->prepare('UPDATE shared_task_reviews SET task_revision=task_revision+1 WHERE task_id=?')->execute([$id]);
   $db->prepare("DELETE FROM shared_trash WHERE kind='task' AND object_id=?")->execute([$id]);
  }
  genesisSharedAudit($row['project_id'],$userId,$kind.'.restored',$id);$db->commit();return ['ok'=>true];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
