<?php
declare(strict_types=1);

function genesisDiaryNotes(string $userId): array
{
    $q=genesisDb()->prepare('SELECT id,revision,schema_version,iv,ciphertext,updated_at FROM personal_diary_notes WHERE user_id=? ORDER BY updated_at DESC');
    $q->execute([$userId]);
    return array_map(static fn(array $row): array => ['id'=>$row['id'],'revision'=>(int)$row['revision'],'schemaVersion'=>(int)$row['schema_version'],
        'iv'=>$row['iv'],'ciphertext'=>$row['ciphertext'],'updatedAt'=>$row['updated_at']],$q->fetchAll());
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
