<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/google.php';
require dirname(__DIR__) . '/src/shared-projects.php';
if (!in_array(parse_url(genesisConfig()['app_url'], PHP_URL_HOST), ['127.0.0.1','localhost.invalid'], true)) throw new RuntimeException('Isolated test configuration required.');
function detailsExpect(bool $ok, string $why): void { if (!$ok) throw new RuntimeException($why); }
function detailsReject(callable $operation, string $code): void {
    try { $operation(); } catch (GenesisSharedAccessException|InvalidArgumentException $error) {
        detailsExpect($error->getMessage()===$code, 'Unexpected error: '.$error->getMessage().' instead of '.$code); return;
    }
    throw new RuntimeException('Expected rejection: '.$code);
}
$db=genesisDb(); $prefix='task-details-'.bin2hex(random_bytes(5)); $owner=$prefix.'-owner'; $viewer=$prefix.'-viewer'; $outsider=$prefix.'-outsider'; $space=null;
foreach ([$owner,$viewer,$outsider] as $id) {
    $db->prepare('INSERT INTO users(id,google_sub,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')->execute([$id,$id,$id.'@example.invalid','Synthetic',genesisNow(),genesisNow()]);
    genesisUpdateAccountPreferences($id,['sharedProjectsEnabled'=>true]);
}
try {
    $space=genesisSharedCreateSpace($owner,['title'=>'Synthetic details']);
    $project=genesisSharedCreateProject($owner,$space['id'],['title'=>'Synthetic project']); $projectId=$project['id'];
    $db->prepare("INSERT INTO shared_space_members(space_id,user_id,role,joined_at) VALUES(?,?,'guest',?)")->execute([$space['id'],$viewer,genesisNow()]);
    $db->prepare("INSERT INTO shared_project_members(project_id,user_id,role,joined_at) VALUES(?,?,'viewer',?)")->execute([$projectId,$viewer,genesisNow()]);
    $statuses=genesisSharedProjectSnapshot($owner,$projectId)['statuses'];
    $open=array_values(array_filter($statuses,fn($s)=>!(int)$s['isDone']))[0]['id'];
    $done=array_values(array_filter($statuses,fn($s)=>(int)$s['isDone']))[0]['id'];
    $lists=[['id'=>'list-a','title'=>'Materials','items'=>[['id'=>'item-a','title'=>'Prepare venue','done'=>false,'assigneeId'=>$owner,'dueDate'=>'2026-10-15','linkedTaskId'=>null]]]];
    $parent=genesisSharedTask($owner,$projectId,['title'=>'Parent','statusId'=>$open,'priority'=>3,'checklists'=>$lists,'requestId'=>genesisUuid()]);
    $parentId=$parent['id'];
    detailsExpect($parent['priority']===3 && $parent['checklists'][0]['items'][0]['title']==='Prepare venue','Task details lost');
    $raw=$db->prepare('SELECT checklists_json FROM shared_tasks WHERE id=?');$raw->execute([$parentId]);
    detailsExpect(!str_contains($raw->fetchColumn(),'Prepare venue'),'Checklist plaintext leaked at rest');
    $raw->closeCursor();
    $legacy=genesisSharedTask($owner,$projectId,['title'=>'Legacy title','expectedRevision'=>$parent['revision']],$parentId);
    detailsExpect($legacy['checklists']===$parent['checklists'] && $legacy['priority']===3,'Old client erased new fields');
    detailsReject(fn()=>genesisSharedTask($owner,$projectId,['checklists'=>[],'expectedRevision'=>$parent['revision']],$parentId),'SHARED_TASK_CONFLICT');
    detailsReject(fn()=>genesisSharedTask($viewer,$projectId,['title'=>'Unauthorized','expectedRevision'=>$legacy['revision']],$parentId),'SHARED_PROJECT_FORBIDDEN');
    detailsReject(fn()=>genesisSharedGetTask($outsider,$projectId,$parentId),'SHARED_PROJECT_NOT_FOUND');
    $child=genesisSharedTask($owner,$projectId,['title'=>'Child','statusId'=>$open,'parentTaskId'=>$parentId]);
    detailsExpect(genesisSharedGetTask($owner,$projectId,$parentId)['childCount']===1,'Child count missing');
    detailsReject(fn()=>genesisSharedTask($owner,$projectId,['parentTaskId'=>$child['id'],'expectedRevision'=>$legacy['revision']],$parentId),'TASK_RELATION_CYCLE');
    detailsReject(fn()=>genesisSharedTask($owner,$projectId,['statusId'=>$done,'expectedRevision'=>$legacy['revision']],$parentId),'TASK_CHILDREN_INCOMPLETE');
    genesisSharedTask($owner,$projectId,['statusId'=>$done,'expectedRevision'=>$child['revision']],$child['id']);
    detailsReject(fn()=>genesisSharedTask($owner,$projectId,['statusId'=>$done,'expectedRevision'=>$legacy['revision']],$parentId),'TASK_CHECKLIST_INCOMPLETE');
    $convert=['itemId'=>'item-a','expectedRevision'=>$legacy['revision'],'requestId'=>genesisUuid()];
    $converted=genesisSharedConvertChecklistItem($owner,$projectId,$parentId,$convert);
    detailsExpect($converted===genesisSharedConvertChecklistItem($owner,$projectId,$parentId,$convert),'Conversion retry created a duplicate');
    detailsExpect($converted===genesisSharedConvertChecklistItem($owner,$projectId,$parentId,$convert+['ignored'=>true]),'Conversion changed result');
    $linked=genesisSharedGetTask($owner,$projectId,$converted['taskId']);
    genesisSharedTask($owner,$projectId,['statusId'=>$done,'expectedRevision'=>$linked['revision']],$linked['id']);
    $parent=genesisSharedGetTask($owner,$projectId,$parentId);
    detailsExpect($parent['checklists'][0]['items'][0]['done']===true,'Converted item does not follow linked task');
    $parent=genesisSharedTask($owner,$projectId,['statusId'=>$done,'expectedRevision'=>$parent['revision']],$parentId);
    $child=genesisSharedGetTask($owner,$projectId,$child['id']);
    detailsReject(fn()=>genesisSharedTask($owner,$projectId,['statusId'=>$open,'expectedRevision'=>$child['revision']],$child['id']),'TASK_PARENT_COMPLETED');
    echo "Task details: encryption, legacy fields, revisions, ACL, cycle, completion, checklist conversion passed.\n";

    $db->prepare('DELETE FROM shared_tasks WHERE project_id=?')->execute([$projectId]);
    $insert=$db->prepare('INSERT INTO shared_tasks(id,project_id,status_id,title,due_date,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    $count=0;
    foreach ([499,500,501,4999,5000,5001,10000] as $target) {
        genesisBeginWriteTransaction($db);
        while($count<$target){$count++;$insert->execute([$prefix.'-'.str_pad((string)$count,5,'0',STR_PAD_LEFT),$projectId,$open,'Find me '.$count,'2026-10-15',$owner,$owner,genesisNow(),genesisNow()]);}
        $db->commit();
        $page=genesisSharedQueryTasks($owner,['projectIds'=>[$projectId]],null,100);
        detailsExpect($page['total']===$target && count($page['tasks'])===100 && $page['hasMore'],'Incorrect boundary count '.$target);
        detailsExpect(array_sum($page['statusCounts'])===$target && $page['dateCounts']['2026-10-15']===$target,'Incomplete counts '.$target);
    }
    $seen=[]; $cursor=null;
    do {
        $page=genesisSharedQueryTasks($owner,['projectIds'=>[$projectId],'q'=>'Find'], $cursor);
        foreach($page['tasks'] as $task){detailsExpect(!isset($seen[$task['id']]),'Duplicate page entry');$seen[$task['id']]=true;}
        $cursor=$page['nextCursor'];
    } while($cursor);
    detailsExpect(count($seen)===10000,'Pagination omitted tasks');
    $beyond=genesisSharedQueryTasks($owner,['projectIds'=>[$projectId],'q'=>'10000']);
    detailsExpect($beyond['total']===1 && str_ends_with($beyond['tasks'][0]['id'],'10000'),'Search omits a task beyond 5000');
    detailsExpect(genesisSharedSearch($owner,$space['id'],'Find')['total']===10000,'Search count truncated');
    $first=genesisSharedQueryTasks($owner,['projectIds'=>[$projectId]]);
    $db->prepare('UPDATE shared_tasks SET position=2 WHERE id=?')->execute([$prefix.'-10000']);
    detailsReject(fn()=>genesisSharedQueryTasks($owner,['projectIds'=>[$projectId]],$first['nextCursor']),'SHARED_QUERY_CHANGED');
    $first=genesisSharedQueryTasks($owner,['projectIds'=>[$projectId]]);
    $db->prepare('DELETE FROM shared_tasks WHERE id=?')->execute([$prefix.'-10000']);
    detailsReject(fn()=>genesisSharedQueryTasks($owner,['projectIds'=>[$projectId]],$first['nextCursor']),'SHARED_QUERY_CHANGED');
    $first=genesisSharedQueryTasks($viewer,['projectIds'=>[$projectId]]);
    $db->prepare('DELETE FROM shared_project_members WHERE project_id=? AND user_id=?')->execute([$projectId,$viewer]);
    detailsReject(fn()=>genesisSharedQueryTasks($viewer,['projectIds'=>[$projectId]],$first['nextCursor']),'SHARED_PROJECT_NOT_FOUND');
    for($i=1;$i<50;$i++){
        $p=genesisSharedCreateProject($owner,$space['id'],['title'=>'Scoped '.$i]);
        $s=genesisSharedProjectSnapshot($owner,$p['id'])['statuses'][0]['id'];
        genesisSharedTask($owner,$p['id'],['title'=>'Across projects','statusId'=>$s]);
    }
    detailsExpect(genesisSharedQueryTasks($owner,['spaceId'=>$space['id'],'q'=>'Across'])['total']===49,'Cross-project search incomplete');
    detailsExpect(genesisSharedQueryTasks($outsider,['q'=>'Across'])['total']===0,'Search exposed inaccessible projects');
    echo "Task query: 499/500/501/4999/5000/5001/10000, 50 projects, full search/pages/counts and stale/revoked cursors passed.\n";
} finally {
    if($db->inTransaction())$db->rollBack();
    if($space)$db->prepare('DELETE FROM shared_spaces WHERE id=?')->execute([$space['id']]);
    foreach([$owner,$viewer,$outsider] as $id)$db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
}
