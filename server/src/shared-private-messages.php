<?php
declare(strict_types=1);

/** Only public P-256 keys cross the API. Registration is immutable. */
function genesisSharedMessagingKey(string $userId, ?array $input = null): array
{
    genesisSharedRequireEnabled($userId);
    $db = genesisDb();
    if ($input !== null) {
        $jwk = $input['publicKey'] ?? null;
        if (!is_array($jwk) || array_diff(array_keys($jwk), ['kty','crv','x','y'])
            || ($jwk['kty'] ?? '') !== 'EC' || ($jwk['crv'] ?? '') !== 'P-256') throw new InvalidArgumentException('INVALID_PUBLIC_KEY');
        foreach (['x','y'] as $field) {
            if (!is_string($jwk[$field] ?? null) || !preg_match('/\A[A-Za-z0-9_-]{43}\z/', $jwk[$field])) throw new InvalidArgumentException('INVALID_PUBLIC_KEY');
            $bytes = base64_decode(strtr($jwk[$field], '-_', '+/') . '=', true);
            if ($bytes === false || strlen($bytes) !== 32 || rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=') !== $jwk[$field]) throw new InvalidArgumentException('INVALID_PUBLIC_KEY');
        }
        $canonical = json_encode(['kty'=>'EC','crv'=>'P-256','x'=>$jwk['x'],'y'=>$jwk['y']], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $keyId = hash('sha256', $canonical);
        $q = $db->prepare('INSERT OR IGNORE INTO shared_messaging_keys(user_id,key_id,public_key_json,created_at) VALUES(?,?,?,?)');
        $q->execute([$userId,$keyId,$canonical,genesisNow()]);
    }
    $q = $db->prepare('SELECT key_id AS keyId, public_key_json FROM shared_messaging_keys WHERE user_id=?'); $q->execute([$userId]);
    $row = $q->fetch();
    if ($input !== null && $row['keyId'] !== $keyId) throw new GenesisSharedAccessException('MESSAGING_KEY_MISMATCH',409);
    return ['keyId'=>$row['keyId'] ?? null, 'publicKey'=>isset($row['public_key_json']) ? json_decode($row['public_key_json'],true) : null];
}

function genesisSharedPrivateAccess(string $userId, string $id): array
{
    genesisSharedRequireEnabled($userId);
    $q = genesisDb()->prepare('SELECT c.* FROM shared_private_conversations c
        JOIN shared_space_members a ON a.space_id=c.space_id AND a.user_id=c.user_a
        JOIN shared_space_members b ON b.space_id=c.space_id AND b.user_id=c.user_b
        WHERE c.id=? AND (c.user_a=? OR c.user_b=?)');
    $q->execute([$id,$userId,$userId]); $row = $q->fetch();
    if (!$row) throw new GenesisSharedAccessException('PRIVATE_CONVERSATION_NOT_FOUND');
    return $row;
}

function genesisSharedPrivateConversation(string $userId, string $spaceId, array $input): array
{
    genesisSharedRequireEnabled($userId); genesisSharedSpaceAccess($spaceId,$userId);
    $peer = $input['userId'] ?? null;
    if (!is_string($peer) || $peer === $userId) throw new InvalidArgumentException('INVALID_RECIPIENT');
    genesisSharedSpaceAccess($spaceId,$peer);
    $q = genesisDb()->prepare('SELECT COUNT(*) FROM shared_messaging_keys WHERE user_id IN (?,?)'); $q->execute([$userId,$peer]);
    if ((int)$q->fetchColumn() !== 2) throw new GenesisSharedAccessException('RECIPIENT_KEY_REQUIRED',409);
    [$a,$b] = strcmp($userId,$peer) < 0 ? [$userId,$peer] : [$peer,$userId];
    genesisDb()->prepare('INSERT OR IGNORE INTO shared_private_conversations(id,space_id,user_a,user_b,created_at) VALUES(?,?,?,?,?)')
        ->execute([genesisUuid(),$spaceId,$a,$b,genesisNow()]);
    $q = genesisDb()->prepare('SELECT id FROM shared_private_conversations WHERE space_id=? AND user_a=? AND user_b=?'); $q->execute([$spaceId,$a,$b]);
    return ['id'=>$q->fetchColumn(),'spaceId'=>$spaceId,'userA'=>$a,'userB'=>$b];
}

/** A metadata-only inbox: no message bodies or private keys in notifications. */
function genesisSharedPrivateInbox(string $userId): array
{
    genesisSharedRequireEnabled($userId);
    $q = genesisDb()->prepare('SELECT c.id, c.space_id AS spaceId, s.title AS spaceTitle,
        CASE WHEN c.user_a=:user THEN c.user_b ELSE c.user_a END AS peerId,
        COALESCE(NULLIF(u.display_name,\'\'),\'GENESIS\') AS peerName,
        COUNT(m.seq) AS unread, MAX(m.seq) AS latestSeq
        FROM shared_private_conversations c JOIN shared_spaces s ON s.id=c.space_id
        JOIN shared_space_members a ON a.space_id=c.space_id AND a.user_id=c.user_a
        JOIN shared_space_members b ON b.space_id=c.space_id AND b.user_id=c.user_b
        JOIN users u ON u.id=CASE WHEN c.user_a=:user THEN c.user_b ELSE c.user_a END
        LEFT JOIN shared_private_message_reads r ON r.conversation_id=c.id AND r.user_id=:user
        JOIN shared_private_messages m ON m.conversation_id=c.id AND m.sender_id<>:user
            AND m.seq>COALESCE(r.last_read_seq,0) AND m.deleted_at IS NULL
        WHERE c.user_a=:user OR c.user_b=:user
        GROUP BY c.id ORDER BY latestSeq DESC LIMIT 100');
    $q->execute(['user'=>$userId]);
    return ['conversations'=>array_map(static function(array $row): array { $row['unread']=(int)$row['unread']; $row['latestSeq']=(int)$row['latestSeq']; return $row; },$q->fetchAll())];
}

function genesisSharedPrivateMessages(string $userId, string $conversationId, int $before = 0): array
{
    genesisSharedPrivateAccess($userId,$conversationId);
    if ($before < 0) throw new InvalidArgumentException('INVALID_MESSAGE_CURSOR');
    $q = genesisDb()->prepare('SELECT seq,id,sender_id AS senderId,payload_json,revision,created_at AS createdAt,updated_at AS updatedAt,deleted_at AS deletedAt
        FROM shared_private_messages WHERE conversation_id=? AND (CAST(? AS INTEGER)=0 OR seq<CAST(? AS INTEGER)) ORDER BY seq DESC LIMIT 51');
    $q->execute([$conversationId,$before,$before]); $rows = $q->fetchAll();
    $more = count($rows)>50; $rows = array_slice($rows,0,50);
    $cursor = $more ? (int)$rows[49]['seq'] : null;
    $rows = array_map(static function(array $r): array {
        $r['payload'] = $r['payload_json'] === null ? null : json_decode($r['payload_json'],true);
        unset($r['payload_json']); $r['seq']=(int)$r['seq']; $r['revision']=(int)$r['revision']; return $r;
    }, array_reverse($rows));
    return ['messages'=>$rows,'nextCursor'=>$cursor];
}

function genesisSharedPrivatePayload(mixed $payload, array $conversation): string
{
    if (!is_array($payload) || array_diff(array_keys($payload),['version','iv','ciphertext','keyIds']) || ($payload['version'] ?? null)!==1
        || !is_string($payload['iv'] ?? null) || !preg_match('/\A[A-Za-z0-9_-]{16}\z/',$payload['iv'])
        || !is_string($payload['ciphertext'] ?? null) || !preg_match('/\A[A-Za-z0-9_-]{22,44000}\z/',$payload['ciphertext'])
        || !is_array($payload['keyIds'] ?? null) || count($payload['keyIds'])!==2) throw new InvalidArgumentException('INVALID_CIPHERTEXT');
    foreach ([$conversation['user_a'],$conversation['user_b']] as $id) {
        $q = genesisDb()->prepare('SELECT key_id FROM shared_messaging_keys WHERE user_id=?'); $q->execute([$id]);
        if (($payload['keyIds'][$id] ?? '') !== $q->fetchColumn()) throw new InvalidArgumentException('INVALID_MESSAGE_KEY');
    }
    return json_encode($payload,JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function genesisSharedPrivateSave(string $userId, string $conversationId, array $input, string $method = 'POST', ?string $id = null): array
{
    $db = genesisDb(); genesisBeginWriteTransaction($db);
    try {
        $conversation = genesisSharedPrivateAccess($userId,$conversationId);
        $id = $id ?? ($input['id'] ?? null);
        if (!is_string($id) || !preg_match('/\A[a-f0-9-]{36}\z/',$id)) throw new InvalidArgumentException('INVALID_MESSAGE_ID');
        $q = $db->prepare('SELECT * FROM shared_private_messages WHERE id=? AND conversation_id=?'); $q->execute([$id,$conversationId]); $existing = $q->fetch();
        if ($existing && $existing['sender_id'] !== $userId) throw new GenesisSharedAccessException('MESSAGE_AUTHOR_REQUIRED',403);
        if ($method!=='POST' && (!$existing || $existing['deleted_at']!==null)) throw new GenesisSharedAccessException('MESSAGE_NOT_FOUND');
        if ($method!=='POST' && ($input['expectedRevision'] ?? null)!==(int)$existing['revision']) throw new GenesisSharedAccessException('MESSAGE_REVISION_CONFLICT',409);
        $payload = $method==='DELETE' ? null : genesisSharedPrivatePayload($input['payload'] ?? null,$conversation);
        if ($payload !== null && strlen($payload)>strlen($existing['payload_json'] ?? '')) {
            $q=$db->prepare('SELECT COALESCE(SUM(length(payload_json)),0) FROM shared_private_messages WHERE sender_id=?');$q->execute([$userId]);
            if ((int)$q->fetchColumn()+strlen($payload)-strlen($existing['payload_json'] ?? '')>536870912) throw new GenesisSharedAccessException('MESSAGE_STORAGE_LIMIT',409);
        }
        if ($method==='POST' && $existing) {
            if ($existing['revision']!=1 || $existing['payload_json']!==$payload || $existing['deleted_at']!==null) throw new GenesisSharedAccessException('MESSAGE_REVISION_CONFLICT',409);
        } elseif ($method==='POST') {
            $q = $db->prepare('SELECT COUNT(*) FROM shared_private_messages WHERE sender_id=? AND created_at>=?'); $q->execute([$userId,gmdate('Y-m-d\TH:i:s\Z',time()-60)]);
            if ((int)$q->fetchColumn()>=30) throw new GenesisSharedAccessException('MESSAGE_RATE_LIMIT',429);
            $q=$db->prepare('SELECT COUNT(*) FROM shared_private_messages WHERE sender_id=?');$q->execute([$userId]);
            if((int)$q->fetchColumn()>=100000)throw new GenesisSharedAccessException('MESSAGE_STORAGE_LIMIT',409);
            $db->prepare('INSERT INTO shared_private_messages(id,conversation_id,sender_id,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?)')
                ->execute([$id,$conversationId,$userId,$payload,genesisNow(),genesisNow()]);
        } else {
            $db->prepare('UPDATE shared_private_messages SET payload_json=?,revision=revision+1,updated_at=?,deleted_at=? WHERE id=?')
                ->execute([$payload,genesisNow(),$method==='DELETE' ? genesisNow() : null,$id]);
        }
        $db->commit(); return ['ok'=>true,'id'=>$id];
    } catch (Throwable $error) { $db->rollBack(); throw $error; }
}

function genesisSharedPrivateRead(string $userId, string $conversationId, array $input): void
{
    genesisSharedPrivateAccess($userId,$conversationId);
    $seq = $input['seq'] ?? null;
    if (!is_int($seq) || $seq<0) throw new InvalidArgumentException('INVALID_READ_CURSOR');
    $q = genesisDb()->prepare('SELECT COALESCE(MAX(seq),0) FROM shared_private_messages WHERE conversation_id=?'); $q->execute([$conversationId]);
    if ($seq>(int)$q->fetchColumn()) throw new InvalidArgumentException('INVALID_READ_CURSOR');
    genesisDb()->prepare('INSERT INTO shared_private_message_reads(conversation_id,user_id,last_read_seq) VALUES(?,?,?)
        ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_read_seq=MAX(last_read_seq,excluded.last_read_seq)')->execute([$conversationId,$userId,$seq]);
}
