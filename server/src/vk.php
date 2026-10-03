<?php
declare(strict_types=1);

function genesisVkConfigured(): bool
{
    return preg_match('/\A[1-9][0-9]{2,19}\z/D', trim((string)(genesisConfig()['vk_client_id'] ?? ''))) === 1;
}

function genesisVkRedirectUri(): string
{
    return rtrim((string)genesisConfig()['app_url'], '/') . '/api/auth/vk/callback';
}

function genesisVkAuthUrl(string $state, string $challenge): string
{
    if (!genesisVkConfigured()) throw new RuntimeException('VK ID sign-in is not configured.');
    $id = trim((string)genesisConfig()['vk_client_id']);
    return 'https://id.vk.ru/authorize?' . http_build_query([
        'client_id' => $id, 'app_id' => $id,
        'redirect_uri' => genesisVkRedirectUri(),
        'response_type' => 'code', 'scope' => 'email',
        'state' => $state, 'code_challenge' => $challenge,
        'code_challenge_method' => 's256',
    ], '', '&', PHP_QUERY_RFC3986);
}

/** @return array<string, mixed> */
function genesisVkRequest(string $path, array $query, array $form): array
{
    $url = 'https://id.vk.ru/oauth2/' . $path . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    $handle = curl_init($url);
    if ($handle === false) throw new RuntimeException('VK ID request could not be initialized.');
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($form, '', '&', PHP_QUERY_RFC3986),
    ]);
    try {
        $body = curl_exec($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    } finally {
        curl_close($handle);
    }
    if (!is_string($body) || $status !== 200 || strlen($body) > 65536) {
        throw new RuntimeException('VK ID authorization is temporarily unavailable.');
    }
    $decoded = json_decode($body, true);
    if (!is_array($decoded) || isset($decoded['error'])) {
        throw new RuntimeException('VK ID returned an invalid response.');
    }
    return $decoded;
}

/** @return array<string, mixed> */
function genesisVkExchangeCode(string $code, string $deviceId, string $verifier, string $state): array
{
    if (!genesisVkConfigured() || $code === '' || $deviceId === '' || $verifier === '') {
        throw new InvalidArgumentException('VK ID request is incomplete.');
    }
    $tokens = genesisVkRequest('auth', [
        'grant_type' => 'authorization_code',
        'redirect_uri' => genesisVkRedirectUri(),
        'client_id' => (string)genesisConfig()['vk_client_id'],
        'code_verifier' => $verifier,
        'state' => $state,
        'device_id' => $deviceId,
    ], ['code' => $code]);
    if (!hash_equals($state, (string)($tokens['state'] ?? ''))
        || !is_string($tokens['access_token'] ?? null)
        || $tokens['access_token'] === '') {
        throw new RuntimeException('VK ID token validation failed.');
    }
    return $tokens;
}

/** @return array{id: string, email: string, name: string, picture: ?string} */
function genesisVkUserInfo(array $tokens): array
{
    $profile = genesisVkRequest('user_info', [
        'client_id' => (string)genesisConfig()['vk_client_id'],
    ], ['access_token' => (string)$tokens['access_token']]);
    $user = $profile['user'] ?? null;
    if (!is_array($user)) throw new RuntimeException('VK ID did not return a profile.');
    $id = trim((string)($user['user_id'] ?? ''));
    if ($id === '' || strlen($id) > 128 || !hash_equals((string)($tokens['user_id'] ?? ''), $id)) {
        throw new RuntimeException('VK ID profile does not match the token.');
    }
    $email = mb_strtolower(trim((string)($user['email'] ?? '')));
    if ($email === '') $email = 'vk-' . hash('sha256', $id) . '@users.genesis.invalid';
    if (!genesisIsValidEmail($email)) throw new RuntimeException('VK ID email is invalid.');
    $name = trim((string)($user['first_name'] ?? '') . ' ' . (string)($user['last_name'] ?? ''));
    if ($name === '') $name = 'VK ID ' . $id;
    $picture = isset($user['avatar']) && is_string($user['avatar'])
        && str_starts_with($user['avatar'], 'https://') ? $user['avatar'] : null;
    return ['id' => $id, 'email' => $email, 'name' => $name, 'picture' => $picture];
}

function genesisVkIssueNativeTicket(string $userId, string $flow, bool $isNew): string
{
    $ticket = genesisBase64Url(random_bytes(32));
    genesisDb()->prepare('DELETE FROM vk_native_tickets WHERE expires_at < :now')->execute(['now' => time()]);
    genesisDb()->prepare('INSERT INTO vk_native_tickets (ticket_hash, flow_hash, user_id, is_new, expires_at)
        VALUES (:ticket, :flow, :user, :is_new, :expires)')->execute([
        'ticket' => hash('sha256', $ticket), 'flow' => hash('sha256', $flow),
        'user' => $userId, 'is_new' => $isNew ? 1 : 0, 'expires' => time() + 300,
        ]);
    return $ticket;
}

/** @return array{userId: string, newAccount: bool} */
function genesisVkConsumeNativeTicket(string $ticket, string $flow): array
{
    if (!preg_match('/\A[A-Za-z0-9_-]{43}\z/D', $ticket)
        || !preg_match('/\A[A-Za-z0-9_-]{43}\z/D', $flow)) {
        throw new InvalidArgumentException('VK ID ticket is invalid.');
    }
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $hash = hash('sha256', $ticket);
        $query = $db->prepare('SELECT flow_hash, user_id, is_new, expires_at FROM vk_native_tickets WHERE ticket_hash = :hash');
        $query->execute(['hash' => $hash]);
        $row = $query->fetch();
        if (!is_array($row) || (int)$row['expires_at'] < time()
            || !hash_equals((string)$row['flow_hash'], hash('sha256', $flow))) {
            throw new DomainException('VK ID ticket expired or did not match this device.');
        }
        $db->prepare('DELETE FROM vk_native_tickets WHERE ticket_hash = :hash')->execute(['hash' => $hash]);
        $db->commit();
        return ['userId' => (string)$row['user_id'], 'newAccount' => (int)$row['is_new'] === 1];
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

/** @return array<int, array<string, mixed>> */
function genesisVkTasksForClient(string $userId): array
{
    $query = genesisDb()->prepare('SELECT payload_enc FROM vk_tasks WHERE user_id = :id ORDER BY updated_at');
    $query->execute(['id' => $userId]);
    $tasks = [];
    foreach ($query->fetchAll() as $row) {
        try {
            $plain = genesisDecrypt((string)$row['payload_enc']);
            $task = is_string($plain) ? json_decode($plain, true) : null;
        } catch (Throwable $error) {
            throw new RuntimeException('A stored GENESIS task could not be decrypted.', 0, $error);
        }
        if (!is_array($task)) {
            throw new RuntimeException('A stored GENESIS task could not be decrypted.');
        }
        $tasks[] = $task;
    }
    return $tasks;
}

/** @return array<string, mixed> */
function genesisSyncTaskToVk(string $userId, string $taskId, array $task): array
{
    if (!preg_match('/\A[A-Za-z0-9_-]{1,100}\z/D', $taskId)) {
        throw new InvalidArgumentException('Task identifier is invalid.');
    }
    $task['id'] = $taskId;
    $task['syncToGoogle'] = false;
    $task['createdIn'] = 'genesis';
    $task['updatedAt'] = max((int)($task['updatedAt'] ?? 0), (int)round(microtime(true) * 1000));
    $encoded = json_encode($task, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (strlen($encoded) > 131072) throw new InvalidArgumentException('Task is too large.');
    genesisDb()->prepare('INSERT INTO vk_tasks (user_id, task_id, payload_enc, updated_at)
        VALUES (:user, :task, :payload, :now)
        ON CONFLICT(user_id, task_id) DO UPDATE SET payload_enc = excluded.payload_enc,
        updated_at = excluded.updated_at')->execute([
            'user' => $userId, 'task' => $taskId, 'payload' => genesisEncrypt($encoded), 'now' => genesisNow(),
        ]);
    return $task;
}

function genesisDeleteVkTask(string $userId, string $taskId): void
{
    genesisDb()->prepare('DELETE FROM vk_tasks WHERE user_id = :user AND task_id = :task')
        ->execute(['user' => $userId, 'task' => $taskId]);
}
