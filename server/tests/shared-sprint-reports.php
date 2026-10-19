<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'||getenv('GENESIS_IMPROVEMENTS_TEST')!=='isolated')throw new RuntimeException('Explicit isolated fixture required');
require __DIR__.'/../src/bootstrap.php';
$config=genesisConfig();$ciDirectory=getenv('GENESIS_LOCAL_CI_DIR')?:getenv('GENESIS_SMOKE_ROOT');
$browser=$config['app_url']==='http://127.0.0.1:4338'&&basename($config['db_path'])==='improvements-test.sqlite';
$ci=$config['app_url']==='https://localhost.invalid'&&$ciDirectory&&str_replace('\\','/',$config['db_path'])===str_replace('\\','/',$ciDirectory).'/genesis.sqlite';
if(!$browser&&!$ci)throw new RuntimeException('Non-fixture refused');
foreach(['repository','google','shared-projects','shared-google'] as $module)require_once __DIR__.'/../src/'.$module.'.php';
function srCheck(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
function srReject(callable $work,string $code):void{
    try{$work();}catch(InvalidArgumentException|GenesisSharedAccessException $error){srCheck($error->getMessage()===$code,'Expected '.$code.', got '.$error->getMessage());return;}throw new RuntimeException('Expected '.$code);
}
function srSprint(string $actor,string $project,string $title):array{
    return genesisSharedSaveSprint($actor,$project,['requestId'=>genesisUuid(),'expectedRevision'=>0,'title'=>$title,'goal'=>'Actual observations, not planned dates',
        'startDate'=>'2026-10-01','endDate'=>'2026-10-14','calendarMode'=>'lunar','calendarContext'=>['version'=>2,'timeZone'=>'Pacific/Kiritimati','gregorianYearStart'=>'march']])['sprint'];
}
function srTransition(string $actor,string $project,array $sprint,string $action,array $extra=[]):array{
    return genesisSharedTransitionSprint($actor,$project,$sprint['id'],['requestId'=>genesisUuid(),'expectedRevision'=>$sprint['revision'],'fingerprint'=>genesisPlanningFingerprint($project),'action'=>$action,...$extra])['sprint'];
}
$users=[];$space=null;$db=genesisDb();$checks=[];
try{
    $tag='sprint-report-'.genesisUuid();
    foreach(['owner','viewer','outsider'] as $kind){$users[$kind]=genesisUpsertGoogleUser(['email_verified'=>true,'sub'=>$tag.$kind,'email'=>$tag.$kind.'@example.invalid','name'=>'Sprint report '.$kind],[],false)['id'];genesisUpdateAccountPreferences($users[$kind],['sharedProjectsEnabled'=>true]);}
    $owner=$users['owner'];$viewer=$users['viewer'];$space=genesisSharedCreateSpace($owner,['title'=>'Sprint report fixture'])['id'];
    $db->prepare('INSERT INTO shared_space_members(space_id,user_id,role,joined_at,all_projects) VALUES(?,?,?,?,1)')->execute([$space,$viewer,'guest',genesisNow()]);
    $project=genesisSharedCreateProject($owner,$space,['title'=>'Sprint flow source'])['id'];$hidden=genesisSharedCreateProject($owner,$space,['title'=>'Private destination'])['id'];
    $statuses=genesisSharedProjectSnapshot($owner,$project)['statuses'];$todo=$statuses[0]['id'];$done=$statuses[2]['id'];
    genesisSharedSavePlanning($owner,$project,['requestId'=>genesisUuid(),'expectedRevision'=>0,'enabled'=>true,'estimateUnit'=>'points']);
    $a=srSprint($owner,$project,'A · Terminal evidence');$b=srSprint($owner,$project,'B · More than 100');
    $empty=genesisSharedSprintReport($viewer,$project,$a['id'],['unit'=>'tasks']);srCheck(!$empty['flow']['available']&&$empty['flow']['summary']===null,'Planning sprint fabricated history');
    srReject(fn()=>genesisSharedSprintReport($users['outsider'],$project,$a['id'],[]),'SHARED_PROJECT_NOT_FOUND');
    $tasks=[];for($i=0;$i<10;$i++)$tasks[]=genesisSharedTask($owner,$project,['title'=>$i===0?'SECRET_MOVED_TASK':'Committed '.$i,'statusId'=>$todo,'sprintId'=>$a['id'],'storyPoints'=>$i===0?0:($i===1?null:2),'estimateHours'=>$i===0?0:null]);
    $a=srTransition($owner,$project,$a,'start');
    for($i=0;$i<4;$i++)$tasks[$i]=genesisSharedTask($owner,$project,['expectedRevision'=>$tasks[$i]['revision'],'statusId'=>$done],$tasks[$i]['id']);
    $outcomes=[];for($i=4;$i<10;$i++)$outcomes[]=['taskId'=>$tasks[$i]['id'],'expectedRevision'=>$tasks[$i]['revision'],'destinationSprintId'=>$b['id']];
    $a=srTransition($owner,$project,$a,'complete',['outcomes'=>$outcomes]);
    $report=genesisSharedSprintReport($viewer,$project,$a['id'],['unit'=>'tasks']);$s=$report['flow']['summary'];
    srCheck($report['flow']['terminal']&&$report['flow']['historyComplete'],'Complete source history was marked partial');
    srCheck($s['plan']['value']===10.0&&$s['delivered']['value']===4.0&&$s['remaining']['value']===6.0&&$s['carried']['value']===6.0,'Real carries fabricated terminal zero/completions');
    srCheck(substr($report['flow']['from'],0,10)!==$report['launch']['startDate']&&$report['flow']['timeZone']==='Pacific/Kiritimati','Planned dates backdated the actual launch or lost saved timezone');
    foreach(['plan'=>10,'alreadyDone'=>0,'committed'=>10,'scope'=>10,'remaining'=>6,'done'=>4,'delivered'=>4,'carried'=>6,'reopened'=>0] as $metric=>$count){
        $page=genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$report['token'],'kind'=>'tasks','metric'=>$metric]);srCheck($page['total']===$count&&count($page['items'])===$count,'Metric source count differs: '.$metric);
    }
    $evidence=genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$report['token'],'kind'=>'events']);
    srCheck(count(array_filter($evidence['items'],static fn($row)=>$row['completionCarry']??false))===6,'Carry source events are not inspectable');
    $date=$report['flow']['series'][0]['date'];$day=genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$report['token'],'kind'=>'events','date'=>$date]);
    foreach($day['items'] as $row)srCheck((new DateTimeImmutable($row['at']))->setTimezone(new DateTimeZone('Pacific/Kiritimati'))->format('Y-m-d')===$date,'Source day ignored launch timezone');
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$report['token'],'kind'=>'events','date'=>'1900-01-01']),'REPORT_METRIC_INVALID');
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$report['token'],'kind'=>'tasks','date'=>$date]),'REPORT_INVALID');
    srCheck(genesisSharedSprintReportCheck($viewer,$project,$a['id'],['token'=>$report['token']])['unchanged'],'Unchanged report rejected its own token');
    srReject(fn()=>genesisSharedSprintReportSources($owner,$project,$a['id'],['token'=>$report['token']]),'REPORT_TOKEN_INVALID');
    $points=genesisSharedSprintReport($viewer,$project,$a['id'],['unit'=>'points']);$hours=genesisSharedSprintReport($viewer,$project,$a['id'],['unit'=>'hours']);
    srCheck($points['flow']['summary']['plan']['value']===16.0&&$points['flow']['summary']['plan']['unestimated']===1&&$points['flow']['summary']['delivered']['unestimated']===1,'Zero/null effort changed in the API');
    srCheck($hours['flow']['summary']['plan']['value']===0.0&&$hours['flow']['summary']['plan']['unestimated']===9,'Hours inherited point values');$checks[]='real lifecycle, terminal carry, units and metric/event sources';

    for($i=0;$i<125;$i++)genesisSharedTask($owner,$project,['title'=>'Large source '.$i,'statusId'=>$todo,'sprintId'=>$b['id'],'storyPoints'=>1]);
    $b=srTransition($owner,$project,$b,'start');$large=genesisSharedSprintReport($viewer,$project,$b['id'],['unit'=>'tasks']);
    srCheck($large['flow']['summary']['plan']['value']===131.0&&$large['flow']['summary']['scope']['value']===131.0&&$large['flow']['historyComplete'],'More-than-100 report dropped scope or invented gaps');
    $first=genesisSharedSprintReportSources($viewer,$project,$b['id'],['token'=>$large['token'],'kind'=>'tasks','metric'=>'plan']);
    srCheck($first['total']===131&&count($first['items'])===100&&$first['nextCursor']!==null,'Source pagination truncated the full selection');
    $next=genesisSharedSprintReportSources($viewer,$project,$b['id'],['token'=>$large['token'],'kind'=>'tasks','metric'=>'plan','cursor'=>$first['nextCursor']]);
    srCheck(count($next['items'])===31&&$next['nextCursor']===null&&count(array_unique(array_column([...$first['items'],...$next['items']],'id')))===131,'Source cursor skipped or repeated tasks');
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$b['id'],['token'=>$large['token'],'kind'=>'tasks','metric'=>'scope','cursor'=>$first['nextCursor']]),'REPORT_TOKEN_INVALID');
    $change=genesisSharedTask($owner,$project,['title'=>'Added after launch','statusId'=>$todo,'sprintId'=>$b['id'],'storyPoints'=>3]);
    srReject(fn()=>genesisSharedSprintReportCheck($viewer,$project,$b['id'],['token'=>$large['token']]),'REPORT_CHANGED');
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$b['id'],['token'=>$large['token'],'cursor'=>$first['nextCursor'],'metric'=>'plan']),'REPORT_CHANGED');
    $fresh=genesisSharedSprintReport($viewer,$project,$b['id'],['unit'=>'points']);srCheck($fresh['flow']['summary']['added']['tasks']===1&&$fresh['flow']['historyComplete'],'New observed task did not change scope honestly');
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$b['id'],['token'=>$fresh['token'],'kind'=>'tasks','metric'=>'not-a-metric']),'REPORT_METRIC_INVALID');$checks[]='full selection, immutable cursor and stale/change checks';

    $access=['allProjects'=>false,'grants'=>[['projectId'=>$project,'role'=>'viewer','includeDescendants'=>false]]];$preview=genesisSharedPreviewProjectAccess($owner,$space,$viewer,$access);
    genesisSharedSaveProjectAccess($owner,$space,$viewer,[...$access,'expectedFingerprint'=>$preview['fingerprint'],'operationId'=>genesisUuid()]);
    $moved=genesisSharedGetTask($owner,$project,$tasks[0]['id']);$target=genesisSharedProjectSnapshot($owner,$hidden)['statuses'][0]['id'];
    genesisSharedMoveTask($owner,$project,$moved['id'],['expectedRevision'=>$moved['revision'],'destinationProjectId'=>$hidden,'statusId'=>$target,'position'=>0]);
    $safe=genesisSharedSprintReport($viewer,$project,$a['id'],['unit'=>'points']);
    srCheck(!str_contains(genesisDataJson($safe),$moved['id'])&&!str_contains(genesisDataJson($safe),'SECRET_MOVED_TASK')&&$safe['flow']['summary']['plan']['value']===null,'Historical plan leaked inaccessible identity/estimate or fabricated zero');
    foreach(['tasks','events','changes'] as $kind){$source=genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$safe['token'],'kind'=>$kind,'metric'=>'plan']);srCheck(!str_contains(genesisDataJson($source),$moved['id'])&&!str_contains(genesisDataJson($source),'SECRET_MOVED_TASK'),'Source page leaked revoked task: '.$kind);}
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$a['id'],['token'=>$report['token'],'kind'=>'tasks','metric'=>'plan']),'REPORT_CHANGED');$checks[]='current ACL, moved history and inaccessible source redaction';

    $terminal=genesisPlanningRows("SELECT id FROM shared_audit_events WHERE project_id=? AND object_id=? AND action='sprint.completed'",[$project,$a['id']])[0]['id'];
    $db->prepare('DELETE FROM shared_audit_events WHERE id=?')->execute([$terminal]);$unknown=genesisSharedSprintReport($owner,$project,$a['id'],['unit'=>'tasks']);
    srCheck(!$unknown['flow']['available']&&$unknown['flow']['summary']===null&&$unknown['flow']['reason']==='terminal-observation-missing','Missing closure was rebuilt from post-carry snapshot');$checks[]='missing terminal honesty';

    $last=genesisSharedSprintReport($viewer,$project,$b['id'],['unit'=>'tasks']);$db->prepare('DELETE FROM shared_space_members WHERE space_id=? AND user_id=?')->execute([$space,$viewer]);
    srReject(fn()=>genesisSharedSprintReportCheck($viewer,$project,$b['id'],['token'=>$last['token']]),'SHARED_PROJECT_NOT_FOUND');
    srReject(fn()=>genesisSharedSprintReportSources($viewer,$project,$b['id'],['token'=>$last['token'],'kind'=>'tasks','metric'=>'scope']),'SHARED_PROJECT_NOT_FOUND');
    srCheck(!$db->query('PRAGMA foreign_key_check')->fetch(),'Report violated foreign keys');$checks[]='revoke before source replay';
    echo genesisDataJson(['pass'=>true,'groups'=>count($checks),'checks'=>$checks])."\n";
}finally{if($space)$db->prepare('DELETE FROM shared_spaces WHERE id=?')->execute([$space]);foreach($users as $id)$db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);}
