<?php
declare(strict_types=1);

const GENESIS_ADMIN_EMAIL = 'nikitalexanderson@gmail.com';

function genesisAdminEmail(): string
{
    return mb_strtolower(trim((string)(genesisConfig()['admin_email'] ?? GENESIS_ADMIN_EMAIL)));
}

function genesisIsGmail(string $email): bool
{
    return (bool)preg_match('/^[^@\s]+@gmail\.com$/i', trim($email));
}

function genesisEnsureWorkspaceKey(array $user): array
{
    if (!empty($user['workspace_key_enc'])) {
        return $user;
    }
    $key = base64_encode(random_bytes(32));
    genesisDb()->prepare('UPDATE users SET workspace_key_enc = :key, updated_at = :updated_at WHERE id = :id')->execute([
        'key' => genesisEncrypt($key),
        'updated_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
    $user['workspace_key_enc'] = genesisEncrypt($key);
    return $user;
}

function genesisUserForClient(array $user): array
{
    $grantedScopes = preg_split('/\s+/', trim((string)($user['granted_scopes'] ?? ''))) ?: [];
    return [
        'uid' => (string)$user['id'],
        'displayName' => (string)$user['display_name'],
        'email' => (string)$user['email'],
        'photoURL' => $user['avatar_url'] ?: null,
        'calendarConnected' => !empty($user['google_calendar_id']) && !empty($user['refresh_token_enc']),
        'googleTasksImportReady' => in_array('https://www.googleapis.com/auth/tasks', $grantedScopes, true),
        'passwordEnabled' => !empty($user['password_hash']),
        'isAdmin' => mb_strtolower((string)$user['email']) === genesisAdminEmail(),
    ];
}

function genesisFindUser(string $userId): ?array
{
    $statement = genesisDb()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();
    return is_array($user) ? $user : null;
}

function genesisFindUserByEmail(string $email): ?array
{
    $statement = genesisDb()->prepare('SELECT * FROM users WHERE email = :email COLLATE NOCASE LIMIT 1');
    $statement->execute(['email' => trim($email)]);
    $user = $statement->fetch();
    return is_array($user) ? $user : null;
}

function genesisTouchUser(string $userId, bool $login = false): void
{
    $now = genesisNow();
    if ($login) {
        genesisDb()->prepare('UPDATE users SET login_count = login_count + 1, last_login_at = :now, last_seen_at = :now, updated_at = :now WHERE id = :id')->execute([
            'now' => $now,
            'id' => $userId,
        ]);
        return;
    }
    genesisDb()->prepare('UPDATE users SET last_seen_at = :now WHERE id = :id')->execute([
        'now' => $now,
        'id' => $userId,
    ]);
}

function genesisUpsertGoogleUser(array $profile, array $tokens): array
{
    $email = mb_strtolower(trim((string)($profile['email'] ?? '')));
    if (!genesisIsGmail($email)) {
        throw new InvalidArgumentException('GENESIS доступен только для адресов Gmail.');
    }

    $db = genesisDb();
    $statement = $db->prepare('SELECT * FROM users WHERE google_sub = :sub OR email = :email COLLATE NOCASE LIMIT 1');
    $statement->execute(['sub' => (string)$profile['sub'], 'email' => $email]);
    $existing = $statement->fetch();
    $now = genesisNow();
    $id = is_array($existing) ? (string)$existing['id'] : genesisUuid();
    $refresh = isset($tokens['refresh_token']) && is_string($tokens['refresh_token'])
        ? genesisEncrypt($tokens['refresh_token'])
        : ($existing['refresh_token_enc'] ?? null);
    $access = isset($tokens['access_token']) && is_string($tokens['access_token'])
        ? genesisEncrypt($tokens['access_token'])
        : ($existing['access_token_enc'] ?? null);
    $workspaceKey = $existing['workspace_key_enc'] ?? genesisEncrypt(base64_encode(random_bytes(32)));
    $expiresAt = time() + genesisClampInt($tokens['expires_in'] ?? 3600, 60, 86400, 3600) - 60;

    $values = [
        'id' => $id,
        'sub' => (string)$profile['sub'],
        'email' => $email,
        'display_name' => mb_substr((string)($profile['name'] ?? $email), 0, 160),
        'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
        'access_token_enc' => $access,
        'refresh_token_enc' => $refresh,
        'token_expires_at' => $expiresAt,
        'granted_scopes' => (string)($tokens['scope'] ?? ($existing['granted_scopes'] ?? '')),
        'workspace_key_enc' => $workspaceKey,
        'last_login_at' => $now,
        'last_seen_at' => $now,
        'created_at' => is_array($existing) ? (string)$existing['created_at'] : $now,
        'updated_at' => $now,
    ];
    if (is_array($existing)) {
        $db->prepare('UPDATE users SET google_sub = :sub, email = :email, display_name = :display_name, avatar_url = :avatar_url, access_token_enc = :access_token_enc, refresh_token_enc = :refresh_token_enc, token_expires_at = :token_expires_at, granted_scopes = :granted_scopes, workspace_key_enc = :workspace_key_enc, login_count = login_count + 1, last_login_at = :last_login_at, last_seen_at = :last_seen_at, updated_at = :updated_at WHERE id = :id')->execute([
            'id' => $values['id'],
            'sub' => $values['sub'],
            'email' => $values['email'],
            'display_name' => $values['display_name'],
            'avatar_url' => $values['avatar_url'],
            'access_token_enc' => $values['access_token_enc'],
            'refresh_token_enc' => $values['refresh_token_enc'],
            'token_expires_at' => $values['token_expires_at'],
            'granted_scopes' => $values['granted_scopes'],
            'workspace_key_enc' => $values['workspace_key_enc'],
            'last_login_at' => $values['last_login_at'],
            'last_seen_at' => $values['last_seen_at'],
            'updated_at' => $values['updated_at'],
        ]);
    } else {
        $db->prepare('INSERT INTO users (id, google_sub, email, display_name, avatar_url, access_token_enc, refresh_token_enc, token_expires_at, granted_scopes, workspace_key_enc, login_count, last_login_at, last_seen_at, created_at, updated_at) VALUES (:id, :sub, :email, :display_name, :avatar_url, :access_token_enc, :refresh_token_enc, :token_expires_at, :granted_scopes, :workspace_key_enc, 1, :last_login_at, :last_seen_at, :created_at, :updated_at)')->execute($values);
    }

    $user = genesisFindUser($id);
    if ($user === null) {
        throw new RuntimeException('User profile could not be saved.');
    }
    return genesisEnsureWorkspaceKey($user);
}

function genesisSetPassword(string $userId, string $password, ?string $currentPassword = null): void
{
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new RuntimeException('Пользователь не найден.');
    }
    if (!genesisIsGmail((string)$user['email']) || empty($user['refresh_token_enc'])) {
        throw new RuntimeException('Сначала подключите Google Calendar через Gmail.');
    }
    if (mb_strlen($password) < 10 || mb_strlen($password) > 200) {
        throw new InvalidArgumentException('Пароль должен содержать от 10 до 200 символов.');
    }
    if (!empty($user['password_hash']) && (!is_string($currentPassword) || !password_verify($currentPassword, (string)$user['password_hash']))) {
        throw new InvalidArgumentException('Текущий пароль указан неверно.');
    }
    genesisDb()->prepare('UPDATE users SET password_hash = :hash, password_set_at = :set_at, updated_at = :updated_at WHERE id = :id')->execute([
        'hash' => password_hash($password, PASSWORD_DEFAULT),
        'set_at' => genesisNow(),
        'updated_at' => genesisNow(),
        'id' => $userId,
    ]);
}

function genesisVerifyPasswordLogin(string $email, string $password): ?array
{
    if (!genesisIsGmail($email)) {
        return null;
    }
    $user = genesisFindUserByEmail($email);
    if ($user === null || empty($user['password_hash']) || !password_verify($password, (string)$user['password_hash'])) {
        password_verify($password, '$2y$10$K1yDr0vymZ4G9LdK4ZqvR.Qp4BUl8gmDjuO8XkXkjHHwB86b1ZZwG');
        return null;
    }
    genesisTouchUser((string)$user['id'], true);
    return genesisFindUser((string)$user['id']);
}

function genesisWorkspaceForClient(array $user): array
{
    $user = genesisEnsureWorkspaceKey($user);
    $key = genesisDecrypt($user['workspace_key_enc'] ?? null);
    if (!is_string($key) || $key === '') {
        throw new RuntimeException('Workspace encryption key is unavailable.');
    }
    $statement = genesisDb()->prepare('SELECT ciphertext, iv, version, updated_at FROM workspace_blobs WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => (string)$user['id']]);
    $blob = $statement->fetch();
    return [
        'key' => $key,
        'envelope' => is_array($blob) ? [
            'ciphertext' => (string)$blob['ciphertext'],
            'iv' => (string)$blob['iv'],
            'version' => (int)$blob['version'],
            'updatedAt' => (string)$blob['updated_at'],
        ] : null,
    ];
}

function genesisSaveWorkspaceEnvelope(string $userId, array $payload): array
{
    $ciphertext = trim((string)($payload['ciphertext'] ?? ''));
    $iv = trim((string)($payload['iv'] ?? ''));
    if ($ciphertext === '' || strlen($ciphertext) > 2_000_000 || !preg_match('/^[A-Za-z0-9+\/=]+$/', $ciphertext)) {
        throw new InvalidArgumentException('Encrypted workspace is invalid.');
    }
    if ($iv === '' || strlen($iv) > 128 || !preg_match('/^[A-Za-z0-9+\/=]+$/', $iv)) {
        throw new InvalidArgumentException('Workspace IV is invalid.');
    }
    $version = genesisClampInt($payload['version'] ?? 1, 1, 1_000_000_000, 1);
    $now = genesisNow();
    genesisDb()->prepare('INSERT INTO workspace_blobs (user_id, ciphertext, iv, version, updated_at) VALUES (:user_id, :ciphertext, :iv, :version, :updated_at) ON CONFLICT(user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, version = excluded.version, updated_at = excluded.updated_at WHERE excluded.version >= workspace_blobs.version')->execute([
        'user_id' => $userId,
        'ciphertext' => $ciphertext,
        'iv' => $iv,
        'version' => $version,
        'updated_at' => $now,
    ]);
    return ['version' => $version, 'updatedAt' => $now];
}

function genesisSaveMetrics(string $userId, array $payload): void
{
    $metrics = is_array($payload['metrics'] ?? null) ? $payload['metrics'] : $payload;
    $values = [
        'project_count' => genesisClampInt($metrics['projectCount'] ?? 0, 0, 1_000_000, 0),
        'task_count' => genesisClampInt($metrics['taskCount'] ?? 0, 0, 10_000_000, 0),
        'open_task_count' => genesisClampInt($metrics['openTaskCount'] ?? 0, 0, 10_000_000, 0),
        'completed_task_count' => genesisClampInt($metrics['completedTaskCount'] ?? 0, 0, 10_000_000, 0),
        'google_synced_count' => genesisClampInt($metrics['googleSyncedCount'] ?? 0, 0, 10_000_000, 0),
    ];
    $values['user_id'] = $userId;
    $values['updated_at'] = genesisNow();
    genesisDb()->prepare('INSERT INTO user_metrics (user_id, project_count, task_count, open_task_count, completed_task_count, google_synced_count, updated_at) VALUES (:user_id, :project_count, :task_count, :open_task_count, :completed_task_count, :google_synced_count, :updated_at) ON CONFLICT(user_id) DO UPDATE SET project_count = excluded.project_count, task_count = excluded.task_count, open_task_count = excluded.open_task_count, completed_task_count = excluded.completed_task_count, google_synced_count = excluded.google_synced_count, updated_at = excluded.updated_at')->execute($values);
    genesisTouchUser($userId);
}

function genesisRequireAdmin(array $user): void
{
    if (mb_strtolower((string)$user['email']) !== genesisAdminEmail()) {
        genesisJson(['error' => 'FORBIDDEN'], 403);
    }
}

function genesisAdminStats(): array
{
    $rows = genesisDb()->query('SELECT u.email, u.display_name, u.created_at, u.last_login_at, u.last_seen_at, u.login_count, u.password_hash IS NOT NULL AS password_enabled, u.google_calendar_id IS NOT NULL AS calendar_connected, COALESCE(m.project_count, 0) AS project_count, COALESCE(m.task_count, 0) AS task_count, COALESCE(m.open_task_count, 0) AS open_task_count, COALESCE(m.completed_task_count, 0) AS completed_task_count, COALESCE(m.google_synced_count, 0) AS google_synced_count, m.updated_at AS metrics_updated_at FROM users u LEFT JOIN user_metrics m ON m.user_id = u.id ORDER BY COALESCE(u.last_seen_at, u.created_at) DESC')->fetchAll();
    return [
        'users' => array_map(static fn(array $row): array => [
            'email' => (string)$row['email'],
            'displayName' => (string)$row['display_name'],
            'createdAt' => (string)$row['created_at'],
            'lastLoginAt' => $row['last_login_at'] ?: null,
            'lastSeenAt' => $row['last_seen_at'] ?: null,
            'loginCount' => (int)$row['login_count'],
            'passwordEnabled' => (bool)$row['password_enabled'],
            'calendarConnected' => (bool)$row['calendar_connected'],
            'projectCount' => (int)$row['project_count'],
            'taskCount' => (int)$row['task_count'],
            'openTaskCount' => (int)$row['open_task_count'],
            'completedTaskCount' => (int)$row['completed_task_count'],
            'googleSyncedCount' => (int)$row['google_synced_count'],
            'metricsUpdatedAt' => $row['metrics_updated_at'] ?: null,
        ], $rows),
        'totals' => [
            'users' => count($rows),
            'projects' => array_sum(array_map(static fn(array $row): int => (int)$row['project_count'], $rows)),
            'tasks' => array_sum(array_map(static fn(array $row): int => (int)$row['task_count'], $rows)),
            'completedTasks' => array_sum(array_map(static fn(array $row): int => (int)$row['completed_task_count'], $rows)),
        ],
    ];
}

function genesisStoicheionDrawForClient(array $row): array
{
    $firstAt = strtotime((string)$row['first_draw_at']);
    $deadline = ($firstAt !== false ? $firstAt : time()) + 180;
    $attempts = (int)$row['attempt_count'];
    $remaining = max(0, $deadline - time());
    return [
        'kind' => (string)$row['draw_kind'],
        'dayKey' => (string)$row['day_key'],
        'seed' => (int)$row['seed_value'],
        'attempts' => $attempts,
        'firstDrawAt' => (string)$row['first_draw_at'],
        'rerollDeadline' => gmdate('Y-m-d\TH:i:s\Z', $deadline),
        'remainingSeconds' => $remaining,
        'canReroll' => $attempts === 1 && $remaining > 0,
    ];
}

function genesisStoicheionDraws(string $userId): array
{
    $dayKey = genesisClientDayKey();
    $statement = genesisDb()->prepare('SELECT * FROM stoicheion_draws WHERE user_id = :user_id AND day_key = :day_key');
    $statement->execute(['user_id' => $userId, 'day_key' => $dayKey]);
    $draws = [];
    foreach ($statement->fetchAll() as $row) {
        $draw = genesisStoicheionDrawForClient($row);
        $draws[(string)$row['draw_kind']] = $draw;
    }
    return ['dayKey' => $dayKey, 'draws' => $draws];
}

function genesisSaveStoicheionDraw(string $userId, string $kind, int $seed): array
{
    if (!in_array($kind, ['daily', 'spread'], true)) {
        throw new InvalidArgumentException('Неизвестный вид расклада.');
    }
    if ($seed < 0 || $seed > 4294967295) {
        throw new InvalidArgumentException('Зерно расклада указано неверно.');
    }
    $db = genesisDb();
    $dayKey = genesisClientDayKey();
    $now = genesisNow();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $statement = $db->prepare('SELECT * FROM stoicheion_draws WHERE user_id = :user_id AND day_key = :day_key AND draw_kind = :draw_kind LIMIT 1');
        $statement->execute(['user_id' => $userId, 'day_key' => $dayKey, 'draw_kind' => $kind]);
        $existing = $statement->fetch();
        if (!is_array($existing)) {
            $db->prepare('INSERT INTO stoicheion_draws (user_id, day_key, draw_kind, seed_value, attempt_count, first_draw_at, updated_at) VALUES (:user_id, :day_key, :draw_kind, :seed_value, 1, :first_draw_at, :updated_at)')->execute([
                'user_id' => $userId,
                'day_key' => $dayKey,
                'draw_kind' => $kind,
                'seed_value' => $seed,
                'first_draw_at' => $now,
                'updated_at' => $now,
            ]);
        } else {
            $firstAt = strtotime((string)$existing['first_draw_at']);
            $withinWindow = $firstAt !== false && time() < $firstAt + 180;
            if ((int)$existing['attempt_count'] !== 1 || !$withinWindow) {
                throw new DomainException((int)$existing['attempt_count'] >= 2
                    ? 'Переброс на сегодня уже использован.'
                    : 'Трёхминутное окно для переброса завершилось.');
            }
            $db->prepare('UPDATE stoicheion_draws SET seed_value = :seed_value, attempt_count = 2, updated_at = :updated_at WHERE user_id = :user_id AND day_key = :day_key AND draw_kind = :draw_kind')->execute([
                'seed_value' => $seed,
                'updated_at' => $now,
                'user_id' => $userId,
                'day_key' => $dayKey,
                'draw_kind' => $kind,
            ]);
        }
        $statement->execute(['user_id' => $userId, 'day_key' => $dayKey, 'draw_kind' => $kind]);
        $saved = $statement->fetch();
        $db->commit();
        if (!is_array($saved)) {
            throw new RuntimeException('Расклад не удалось сохранить.');
        }
        genesisTouchUser($userId);
        return genesisStoicheionDrawForClient($saved);
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function genesisDeleteAccount(string $userId): void
{
    genesisDb()->prepare('DELETE FROM users WHERE id = :id')->execute(['id' => $userId]);
}

function genesisSacredFromDate(string $date): array
{
    $value = new DateTimeImmutable($date . ' 12:00:00');
    $year = (int)$value->format('Y');
    $start = new DateTimeImmutable($year . '-03-20 12:00:00');
    if ($value < $start) {
        $year--;
        $start = new DateTimeImmutable($year . '-03-20 12:00:00');
    }
    $dayOfYear = (int)$start->diff($value)->format('%a');
    return $dayOfYear < 360
        ? ['sacredYear' => $year, 'monthIndex' => intdiv($dayOfYear, 30), 'day' => ($dayOfYear % 30) + 1]
        : ['sacredYear' => $year, 'monthIndex' => 12, 'day' => $dayOfYear - 359];
}
