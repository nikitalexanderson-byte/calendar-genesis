<?php
declare(strict_types=1);

function genesisDiaryNotes(string $userId): array
{
    $q=genesisDb()->prepare('SELECT id,revision,schema_version,iv,ciphertext,updated_at FROM personal_diary_notes WHERE user_id=? ORDER BY updated_at DESC');
    $q->execute([$userId]);
    return array_map(static fn(array $row): array => ['id'=>$row['id'],'revision'=>(int)$row['revision'],'schemaVersion'=>(int)$row['schema_version'],
        'iv'=>$row['iv'],'ciphertext'=>$row['ciphertext'],'updatedAt'=>$row['updated_at']],$q->fetchAll());
}

function genesisDiaryDeletions(string $userId): array
{
    $q=genesisDb()->prepare('SELECT id,revision,local_only,updated_at FROM personal_diary_deletions WHERE user_id=?');
    $q->execute([$userId]);
    return array_map(static fn(array $row): array => ['id'=>$row['id'],'revision'=>(int)$row['revision'],'updatedAt'=>$row['updated_at'],'localOnly'=>(bool)$row['local_only']],$q->fetchAll());
}

function genesisDiarySettings(string $userId): array
{
    $q=genesisDb()->prepare('SELECT sync_enabled,revision FROM personal_diary_settings WHERE user_id=?');$q->execute([$userId]);$row=$q->fetch();
    return ['syncEnabled'=>$row?(bool)$row['sync_enabled']:true,'revision'=>$row?(int)$row['revision']:0];
}

function genesisDiarySnapshot(string $userId): string
{
    $q=genesisDb()->prepare('SELECT id,revision FROM personal_diary_notes WHERE user_id=? ORDER BY id');$q->execute([$userId]);
    return hash('sha256',json_encode(array_map(static fn(array $row):array=>[$row['id'],(int)$row['revision']],$q->fetchAll()),JSON_THROW_ON_ERROR));
}

/** The client must durably retain this exact snapshot before asking to remove server copies. */
function genesisUpdateDiarySettings(string $userId,array $input): array
{
    $enabled=$input['syncEnabled']??null;$revision=$input['expectedRevision']??null;$snapshot=$input['expectedSnapshot']??null;
    if(!is_bool($enabled)||!is_int($revision)||$revision<0||!is_string($snapshot)||!preg_match('/^[a-f0-9]{64}$/D',$snapshot)
        ||array_diff(array_keys($input),['syncEnabled','expectedRevision','expectedSnapshot']))throw new InvalidArgumentException('Invalid diary settings.');
    $hash=hash('sha256',json_encode([$enabled,$revision,$snapshot],JSON_THROW_ON_ERROR));$db=genesisDb();genesisBeginWriteTransaction($db);
    try {
        $q=$db->prepare('SELECT revision,command_hash,removed_count FROM personal_diary_settings WHERE user_id=?');$q->execute([$userId]);$old=$q->fetch();
        if($old&&hash_equals($old['command_hash'],$hash)){
            $db->commit();return ['settings'=>genesisDiarySettings($userId),'snapshot'=>genesisDiarySnapshot($userId),'deleted'=>genesisDiaryDeletions($userId),'removed'=>(int)$old['removed_count']];
        }
        if((int)($old['revision']??0)!==$revision)throw new GenesisResourceLimitException(409,'DIARY_SETTINGS_CONFLICT');
        if(!hash_equals(genesisDiarySnapshot($userId),$snapshot))throw new GenesisResourceLimitException(409,'DIARY_SNAPSHOT_CHANGED');
        $now=genesisNow();$removed=0;
        if(!$enabled){
            $q=$db->prepare('SELECT id,revision FROM personal_diary_notes WHERE user_id=?');$q->execute([$userId]);$notes=$q->fetchAll();$removed=count($notes);
            foreach($notes as $note)$db->prepare('INSERT INTO personal_diary_deletions(user_id,id,revision,local_only,updated_at) VALUES(?,?,?,?,?)')
                ->execute([$userId,$note['id'],(int)$note['revision']+1,1,$now]);
            $db->prepare('DELETE FROM personal_diary_notes WHERE user_id=?')->execute([$userId]);
        }
        $db->prepare('INSERT INTO personal_diary_settings VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET sync_enabled=excluded.sync_enabled,revision=excluded.revision,command_hash=excluded.command_hash,removed_count=excluded.removed_count,updated_at=excluded.updated_at')
            ->execute([$userId,(int)$enabled,$revision+1,$hash,$removed,$now]);
        $db->commit();return ['settings'=>genesisDiarySettings($userId),'snapshot'=>genesisDiarySnapshot($userId),'deleted'=>genesisDiaryDeletions($userId),'removed'=>$removed];
    }catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
}

/** Revision-checked, idempotent deletion. No title, text, IV or ciphertext survives here. */
function genesisDeleteDiaryNote(string $userId,string $id,array $input): array
{
    $revision=$input['expectedRevision']??null;
    if(!preg_match('/^[a-zA-Z0-9_-]{1,100}$/D',$id) || array_keys($input)!==['expectedRevision'] || !is_int($revision) || $revision<1)
        throw new InvalidArgumentException('Invalid diary deletion.');
    $db=genesisDb();genesisBeginWriteTransaction($db);
    try {
        $q=$db->prepare('SELECT revision,updated_at FROM personal_diary_deletions WHERE user_id=? AND id=?');$q->execute([$userId,$id]);$deleted=$q->fetch();
        if($deleted){
            if((int)$deleted['revision']!==$revision+1)throw new GenesisResourceLimitException(409,'DIARY_REVISION_CONFLICT');
            $db->commit();return ['id'=>$id,'revision'=>(int)$deleted['revision'],'updatedAt'=>$deleted['updated_at'],'deleted'=>true];
        }
        $q=$db->prepare('SELECT revision FROM personal_diary_notes WHERE user_id=? AND id=?');$q->execute([$userId,$id]);$old=$q->fetch();
        if(!$old)throw new GenesisResourceLimitException(404,'DIARY_NOTE_NOT_FOUND');
        if((int)$old['revision']!==$revision)throw new GenesisResourceLimitException(409,'DIARY_REVISION_CONFLICT');
        $now=genesisNow();$next=$revision+1;
        $db->prepare('DELETE FROM personal_diary_notes WHERE user_id=? AND id=?')->execute([$userId,$id]);
        $db->prepare('INSERT INTO personal_diary_deletions(user_id,id,revision,updated_at) VALUES(?,?,?,?)')->execute([$userId,$id,$next,$now]);
        $db->commit();return ['id'=>$id,'revision'=>$next,'updatedAt'=>$now,'deleted'=>true];
    }catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
}

/** Only ciphertext reaches SQLite. Concurrent edits require an explicit client decision. */
function genesisSaveDiaryNote(string $userId,string $id,array $input): array
{
    $revision=$input['expectedRevision']??null;$iv=$input['iv']??null;$ciphertext=$input['ciphertext']??null;
    if(!preg_match('/^[a-zA-Z0-9_-]{1,100}$/D',$id) || array_diff(array_keys($input),['expectedRevision','schemaVersion','iv','ciphertext'])
        || ($input['schemaVersion']??null)!==1 || !is_int($revision) || $revision<0
        || !is_string($iv) || strlen($iv)!==16 || strlen((string)base64_decode($iv,true))!==12
        || !is_string($ciphertext) || strlen($ciphertext)<24 || strlen($ciphertext)>300_000 || base64_decode($ciphertext,true)===false)
        throw new InvalidArgumentException('Invalid diary envelope.');
    $hash=hash('sha256','v1:'.$revision.':'.$iv.':'.$ciphertext);$db=genesisDb();genesisBeginWriteTransaction($db);
    try {
        if(!genesisDiarySettings($userId)['syncEnabled'])throw new GenesisResourceLimitException(409,'DIARY_SYNC_DISABLED');
        $q=$db->prepare('SELECT 1 FROM personal_diary_deletions WHERE user_id=? AND id=?');$q->execute([$userId,$id]);
        if($q->fetchColumn())throw new GenesisResourceLimitException(409,'DIARY_NOTE_DELETED');
        $q=$db->prepare('SELECT revision,payload_hash,updated_at FROM personal_diary_notes WHERE user_id=? AND id=?');$q->execute([$userId,$id]);$old=$q->fetch();
        if($old&&hash_equals($old['payload_hash'],$hash)){$db->commit();return ['revision'=>(int)$old['revision'],'updatedAt'=>$old['updated_at']];}
        if((int)($old['revision']??0)!==$revision)throw new GenesisResourceLimitException(409,'DIARY_REVISION_CONFLICT');
        $q=$db->prepare('SELECT COUNT(*),COALESCE(SUM(length(ciphertext)),0) FROM personal_diary_notes WHERE user_id=? AND id<>?');$q->execute([$userId,$id]);$usage=$q->fetch(PDO::FETCH_NUM);
        if((int)$usage[0]>=2000 || (int)$usage[1]+strlen($ciphertext)>20_000_000)throw new GenesisResourceLimitException(413,'DIARY_STORAGE_LIMIT');
        $now=genesisNow();$next=$revision+1;
        $db->prepare('INSERT INTO personal_diary_notes VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET revision=excluded.revision,schema_version=excluded.schema_version,iv=excluded.iv,ciphertext=excluded.ciphertext,payload_hash=excluded.payload_hash,updated_at=excluded.updated_at')
            ->execute([$userId,$id,$next,1,$iv,$ciphertext,$hash,$now]);
        $db->commit();return ['revision'=>$next,'updatedAt'=>$now];
    }catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
}
