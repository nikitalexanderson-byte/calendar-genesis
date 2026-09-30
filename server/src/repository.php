<?php
declare(strict_types=1);

const GENESIS_ADMIN_EMAIL = 'nikitalexanderson@gmail.com';

final class GenesisWorkspaceConflictException extends DomainException
{
    public function __construct(public readonly int $currentVersion)
    {
        parent::__construct('WORKSPACE_VERSION_CONFLICT');
    }
}

function genesisAdminEmail(): string
{
    return mb_strtolower(trim((string)(genesisConfig()['admin_email'] ?? GENESIS_ADMIN_EMAIL)));
}

function genesisIsValidEmail(string $email): bool
{
    $clean = trim($email);
    return mb_strlen($clean) <= 254 && filter_var($clean, FILTER_VALIDATE_EMAIL) !== false;
}

function genesisEnsureWorkspaceKey(array $user): array
{
    if (($user['workspace_key_mode'] ?? 'legacy') === 'client') {
        return $user;
    }
    if (!empty($user['workspace_key_enc'])) {
        return $user;
    }
    $key = base64_encode(random_bytes(32));
    genesisDb()->prepare("UPDATE users SET workspace_key_enc = :key, updated_at = :updated_at WHERE id = :id AND (workspace_key_enc IS NULL OR workspace_key_enc = '') AND workspace_key_mode <> 'client'")->execute([
        'key' => genesisEncrypt($key),
        'updated_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
    // A second device may have initialized the same account in the meantime.
    // Both requests must use the one persisted key, never their losing candidate.
    return genesisFindUser((string)$user['id']) ?? $user;
}

function genesisLinkedGoogleAccountAsUser(array $account): array
{
    $account['_linked_account'] = true;
    $account['_owner_user_id'] = (string)$account['owner_user_id'];
    return $account;
}

function genesisLinkedGoogleAccounts(string $ownerUserId): array
{
    $statement = genesisDb()->prepare('SELECT * FROM linked_google_accounts WHERE owner_user_id = :owner_user_id ORDER BY position, created_at');
    $statement->execute(['owner_user_id' => $ownerUserId]);
    return array_map('genesisLinkedGoogleAccountAsUser', $statement->fetchAll());
}

function genesisFindLinkedGoogleAccount(string $accountId): ?array
{
    $statement = genesisDb()->prepare('SELECT * FROM linked_google_accounts WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $accountId]);
    $account = $statement->fetch();
    return is_array($account) ? genesisLinkedGoogleAccountAsUser($account) : null;
}

function genesisFindLinkedGoogleAccountBySub(string $googleSub): ?array
{
    $statement = genesisDb()->prepare('SELECT * FROM linked_google_accounts WHERE google_sub = :google_sub LIMIT 1');
    $statement->execute(['google_sub' => $googleSub]);
    $account = $statement->fetch();
    return is_array($account) ? genesisLinkedGoogleAccountAsUser($account) : null;
}

function genesisGoogleAccountsForUser(array $owner): array
{
    return array_merge([$owner], genesisLinkedGoogleAccounts((string)$owner['id']));
}

function genesisGoogleAccountForUser(string $ownerUserId, string $accountId): ?array
{
    $owner = genesisFindUser($ownerUserId);
    if ($owner === null) {
        return null;
    }
    if (hash_equals((string)$owner['id'], $accountId)) {
        return $owner;
    }
    $account = genesisFindLinkedGoogleAccount($accountId);
    return $account !== null && hash_equals((string)$account['owner_user_id'], $ownerUserId) ? $account : null;
}

function genesisMultiAccountEnabled(array $owner): bool
{
    return isset($owner['id']) && trim((string)$owner['id']) !== '';
}

function genesisAccountForClient(array $account, bool $primary): array
{
    $grantedScopes = preg_split('/\s+/', trim((string)($account['granted_scopes'] ?? ''))) ?: [];
    $hasRefreshToken = !empty($account['refresh_token_enc']);
    return [
        'id' => (string)$account['id'],
        'email' => (string)$account['email'],
        'displayName' => (string)$account['display_name'],
        'photoURL' => $account['avatar_url'] ?: null,
        'isPrimary' => $primary,
        'calendarConnected' => $hasRefreshToken && !empty($account['google_calendar_id'])
            && in_array(GENESIS_GOOGLE_CALENDAR_SCOPE, $grantedScopes, true),
        'googleTasksImportReady' => $hasRefreshToken
            && in_array(GENESIS_GOOGLE_TASKS_SCOPE, $grantedScopes, true),
    ];
}

function genesisDecodeStringListJson(mixed $value): array
{
    $decoded = is_string($value) ? json_decode($value, true) : $value;
    if (!is_array($decoded)) {
        return [];
    }
    return array_values(array_unique(array_filter(array_map(
        static fn(mixed $item): string => mb_substr(trim((string)$item), 0, 100),
        $decoded,
    ))));
}

function genesisCategorySyncMap(mixed $value): array
{
    $decoded = is_string($value) ? json_decode($value, true) : $value;
    if (!is_array($decoded)) {
        return [];
    }
    $result = [];
    foreach ($decoded as $categoryId => $accountIds) {
        $cleanCategoryId = mb_substr(trim((string)$categoryId), 0, 100);
        if ($cleanCategoryId !== '') {
            $result[$cleanCategoryId] = genesisDecodeStringListJson($accountIds);
        }
    }
    return $result;
}

function genesisUserForClient(array $user): array
{
    $multiAccountEnabled = genesisMultiAccountEnabled($user);
    $accounts = [genesisAccountForClient($user, true)];
    if ($multiAccountEnabled) {
        foreach (genesisLinkedGoogleAccounts((string)$user['id']) as $account) {
            $accounts[] = genesisAccountForClient($account, false);
        }
    }
    $calendarMode = in_array($user['calendar_mode'] ?? '', ['profane', 'sacred', 'lunar'], true)
        ? (string)$user['calendar_mode']
        : 'sacred';
    $taskCalendarMode = in_array($user['task_calendar_mode'] ?? '', ['profane', 'sacred', 'lunar'], true)
        ? (string)$user['task_calendar_mode']
        : 'sacred';
    $timeFormat = in_array($user['time_format'] ?? '', ['24h', '12h'], true)
        ? (string)$user['time_format']
        : '24h';
    $weekStart = in_array($user['week_start'] ?? '', ['sunday', 'monday'], true)
        ? (string)$user['week_start']
        : 'sunday';
    $gregorianYearStart = in_array($user['gregorian_year_start'] ?? '', ['january', 'march'], true)
        ? (string)$user['gregorian_year_start']
        : 'january';
    $theme = in_array($user['theme'] ?? '', ['standart', 'experimental'], true)
        ? (string)$user['theme']
        : 'standart';
    $language = in_array($user['language'] ?? '', ['ru', 'en'], true)
        ? (string)$user['language']
        : 'ru';
    $syncRoutingMode = in_array($user['sync_routing_mode'] ?? '', ['fixed', 'choose', 'category'], true)
        ? (string)$user['sync_routing_mode']
        : 'fixed';
    $validAccountIds = array_map(static fn(array $account): string => (string)$account['id'], $accounts);
    $defaultAccountIds = array_values(array_filter(
        genesisDecodeStringListJson($user['sync_target_account_ids'] ?? '[]'),
        static fn(string $id): bool => in_array($id, $validAccountIds, true),
    ));
    if ($defaultAccountIds === []) {
        $defaultAccountIds = [(string)$user['id']];
    }
    $categoryAccountIds = genesisCategorySyncMap($user['category_sync_map'] ?? '{}');
    foreach ($categoryAccountIds as $categoryId => $accountIds) {
        $categoryAccountIds[$categoryId] = array_values(array_filter(
            $accountIds,
            static fn(string $id): bool => in_array($id, $validAccountIds, true),
        ));
    }
    $anyCalendarConnected = count(array_filter($accounts, static fn(array $account): bool => !empty($account['calendarConnected']))) > 0;
    $anyTasksConnected = count(array_filter($accounts, static fn(array $account): bool => !empty($account['googleTasksImportReady']))) > 0;
    return [
        'uid' => (string)$user['id'],
        'displayName' => (string)$user['display_name'],
        'email' => (string)$user['email'],
        'photoURL' => $user['avatar_url'] ?: null,
        'calendarConnected' => $anyCalendarConnected,
        'googleTasksImportReady' => $anyTasksConnected,
        'passwordEnabled' => !empty($user['password_hash']),
        'stoicheionDivinationDisabled' => !empty($user['stoicheion_divination_disabled']),
        'isAdmin' => mb_strtolower((string)$user['email']) === genesisAdminEmail(),
        'calendarMode' => $calendarMode,
        'taskCalendarMode' => $taskCalendarMode,
        'timeFormat' => $timeFormat,
        'weekStart' => $weekStart,
        'gregorianYearStart' => $gregorianYearStart,
        'theme' => $theme,
        'themeRevision' => max(0, (int)($user['theme_revision'] ?? 0)),
        'language' => $language,
        'multiAccountEnabled' => $multiAccountEnabled,
        'googleAccounts' => $accounts,
        'syncRouting' => [
            'mode' => $syncRoutingMode,
            'defaultAccountIds' => $defaultAccountIds,
            // An empty PHP array is encoded as [] while the native client contract
            // requires a JSON object. Preserve the map shape for accounts that have
            // not configured category routing yet.
            'categoryAccountIds' => (object)$categoryAccountIds,
        ],
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

function genesisUpsertGoogleUser(array $profile, array $tokens, bool $persistGoogleTokens = true): array
{
    $email = mb_strtolower(trim((string)($profile['email'] ?? '')));
    $googleSub = trim((string)($profile['sub'] ?? ''));
    $emailVerified = filter_var($profile['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if (!genesisIsValidEmail($email) || $emailVerified !== true || $googleSub === '') {
        throw new InvalidArgumentException('Google не подтвердил адрес электронной почты этого аккаунта.');
    }
    genesisAssertIdentityAllowed($googleSub, $email);

    $db = genesisDb();
    $linkedAccount = genesisFindLinkedGoogleAccountBySub($googleSub);
    if ($linkedAccount !== null && !$persistGoogleTokens) {
        $db->prepare('UPDATE linked_google_accounts SET email = :email, display_name = :display_name, avatar_url = :avatar_url, updated_at = :updated_at WHERE id = :id')->execute([
            'email' => $email,
            'display_name' => mb_substr((string)($profile['name'] ?? $email), 0, 160),
            'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
            'updated_at' => genesisNow(),
            'id' => (string)$linkedAccount['id'],
        ]);
        $owner = genesisFindUser((string)$linkedAccount['owner_user_id']);
        if ($owner === null) {
            throw new RuntimeException('Связанное пространство GENESIS не найдено.');
        }
        genesisTouchUser((string)$owner['id'], true);
        return genesisEnsureWorkspaceKey($owner);
    }
    $statement = $db->prepare('SELECT * FROM users WHERE google_sub = :sub LIMIT 1');
    $statement->execute(['sub' => $googleSub]);
    $existing = $statement->fetch();
    if (is_array($existing) && !$persistGoogleTokens) {
        // Identity-only login must never write a stale copy of OAuth credentials
        // or the workspace key while another device is refreshing them.
        $db->prepare('UPDATE users SET email = :email, display_name = :display_name, avatar_url = :avatar_url, login_count = login_count + 1, last_login_at = :now, last_seen_at = :now, updated_at = :now WHERE id = :id')->execute([
            'email' => $email,
            'display_name' => mb_substr((string)($profile['name'] ?? $email), 0, 160),
            'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
            'now' => genesisNow(), 'id' => (string)$existing['id'],
        ]);
        return genesisEnsureWorkspaceKey(genesisFindUser((string)$existing['id']) ?? $existing);
    }
    if (!is_array($existing)) {
        $emailOwner = genesisFindUserByEmail($email);
        if ($emailOwner !== null) {
            throw new DomainException('Этот адрес уже связан с другой учётной записью Google. Обратитесь в поддержку GENESIS.');
        }
    }
    $now = genesisNow();
    $id = is_array($existing) ? (string)$existing['id'] : genesisUuid();
    $refresh = $persistGoogleTokens && isset($tokens['refresh_token']) && is_string($tokens['refresh_token'])
        ? genesisEncrypt($tokens['refresh_token'])
        : ($existing['refresh_token_enc'] ?? null);
    $access = $persistGoogleTokens && isset($tokens['access_token']) && is_string($tokens['access_token'])
        ? genesisEncrypt($tokens['access_token'])
        : ($existing['access_token_enc'] ?? null);
    $workspaceKey = is_array($existing) ? ($existing['workspace_key_enc'] ?? null) : null;
    $workspaceKeyMode = is_array($existing) ? (string)($existing['workspace_key_mode'] ?? 'legacy') : 'account';
    $expiresAt = $persistGoogleTokens && isset($tokens['access_token'])
        ? time() + genesisClampInt($tokens['expires_in'] ?? 3600, 60, 86400, 3600) - 60
        : ($existing['token_expires_at'] ?? null);
    $grantedScopes = $persistGoogleTokens
        ? (string)($tokens['scope'] ?? ($existing['granted_scopes'] ?? ''))
        : (string)($existing['granted_scopes'] ?? '');

    $values = [
        'id' => $id,
        'sub' => $googleSub,
        'email' => $email,
        'display_name' => mb_substr((string)($profile['name'] ?? $email), 0, 160),
        'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
        'access_token_enc' => $access,
        'refresh_token_enc' => $refresh,
        'token_expires_at' => $expiresAt,
        'granted_scopes' => $grantedScopes,
        'workspace_key_enc' => $workspaceKey,
        'workspace_key_mode' => $workspaceKeyMode,
        'last_login_at' => $now,
        'last_seen_at' => $now,
        'created_at' => is_array($existing) ? (string)$existing['created_at'] : $now,
        'updated_at' => $now,
    ];
    if (is_array($existing)) {
        $db->prepare('UPDATE users SET google_sub = :sub, email = :email, display_name = :display_name, avatar_url = :avatar_url, access_token_enc = :access_token_enc, refresh_token_enc = :refresh_token_enc, token_expires_at = :token_expires_at, granted_scopes = :granted_scopes, workspace_key_enc = :workspace_key_enc, workspace_key_mode = :workspace_key_mode, login_count = login_count + 1, last_login_at = :last_login_at, last_seen_at = :last_seen_at, updated_at = :updated_at WHERE id = :id')->execute([
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
            'workspace_key_mode' => $values['workspace_key_mode'],
            'last_login_at' => $values['last_login_at'],
            'last_seen_at' => $values['last_seen_at'],
            'updated_at' => $values['updated_at'],
        ]);
    } else {
        $db->prepare('INSERT INTO users (id, google_sub, email, display_name, avatar_url, access_token_enc, refresh_token_enc, token_expires_at, granted_scopes, workspace_key_enc, workspace_key_mode, login_count, last_login_at, last_seen_at, created_at, updated_at) VALUES (:id, :sub, :email, :display_name, :avatar_url, :access_token_enc, :refresh_token_enc, :token_expires_at, :granted_scopes, :workspace_key_enc, :workspace_key_mode, 1, :last_login_at, :last_seen_at, :created_at, :updated_at)')->execute($values);
    }

    $user = genesisFindUser($id);
    if ($user === null) {
        throw new RuntimeException('User profile could not be saved.');
    }
    return genesisEnsureWorkspaceKey($user);
}

function genesisFindUserByGoogleSub(string $googleSub): ?array
{
    $statement = genesisDb()->prepare('SELECT * FROM users WHERE google_sub = :google_sub LIMIT 1');
    $statement->execute(['google_sub' => $googleSub]);
    $user = $statement->fetch();
    return is_array($user) ? $user : null;
}

/**
 * Persist Android service authorization only for the already authenticated primary sub.
 * Email is profile data, never the account-linking key.
 */
function genesisPersistPrimaryGoogleAuthorization(string $userId, array $profile, array $tokens): array
{
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new RuntimeException('Пользователь не найден.');
    }
    $sub = trim((string)($profile['sub'] ?? ''));
    $email = mb_strtolower(trim((string)($profile['email'] ?? '')));
    $emailVerified = filter_var($profile['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if ($sub === '' || !genesisIsValidEmail($email) || $emailVerified !== true) {
        throw new InvalidArgumentException('Google не подтвердил профиль выбранного аккаунта.');
    }
    genesisAssertIdentityAllowed($sub, $email);
    if (!hash_equals((string)$user['google_sub'], $sub)) {
        throw new DomainException('Выбран другой Google-аккаунт. Войдите в него отдельно через выход из GENESIS.');
    }
    if (empty($tokens['access_token']) || !is_string($tokens['access_token'])) {
        throw new RuntimeException('Google не вернул токен доступа.');
    }
    $grantedScopes = preg_split('/\s+/', trim((string)($tokens['scope'] ?? ''))) ?: [];
    if (array_intersect(GENESIS_GOOGLE_SERVICE_SCOPES, $grantedScopes) === []) {
        throw new DomainException('Google не предоставил доступ ни к Calendar, ни к Tasks.');
    }
    $refresh = !empty($tokens['refresh_token']) && is_string($tokens['refresh_token'])
        ? genesisEncrypt($tokens['refresh_token'])
        : ($user['refresh_token_enc'] ?? null);
    if (empty($refresh)) {
        throw new RuntimeException('Google не вернул токен для фоновой синхронизации. Повторите подключение и подтвердите доступ.');
    }
    $now = genesisNow();
    genesisDb()->prepare('UPDATE users SET email = :email, display_name = :display_name, avatar_url = :avatar_url, access_token_enc = :access_token_enc, refresh_token_enc = :refresh_token_enc, token_expires_at = :token_expires_at, granted_scopes = :granted_scopes, last_seen_at = :last_seen_at, updated_at = :updated_at WHERE id = :id')->execute([
        'id' => $userId,
        'email' => $email,
        'display_name' => mb_substr((string)($profile['name'] ?? $email), 0, 160),
        'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
        'access_token_enc' => genesisEncrypt((string)$tokens['access_token']),
        'refresh_token_enc' => $refresh,
        'token_expires_at' => time() + genesisClampInt($tokens['expires_in'] ?? 3600, 60, 86400, 3600) - 60,
        'granted_scopes' => implode(' ', array_values(array_unique($grantedScopes))),
        'last_seen_at' => $now,
        'updated_at' => $now,
    ]);
    $saved = genesisFindUser($userId);
    if ($saved === null) throw new RuntimeException('Google-разрешения не удалось сохранить.');
    return $saved;
}

function genesisLinkGoogleAccount(string $ownerUserId, array $profile, array $tokens): array
{
    $owner = genesisFindUser($ownerUserId);
    if ($owner === null) {
        throw new RuntimeException('Пользователь не найден.');
    }
    $sub = trim((string)($profile['sub'] ?? ''));
    $email = mb_strtolower(trim((string)($profile['email'] ?? '')));
    if ($sub === '' || !genesisIsValidEmail($email)) {
        throw new InvalidArgumentException('Google-профиль дополнительного аккаунта неполон.');
    }
    genesisAssertIdentityAllowed($sub, $email);
    if (hash_equals((string)$owner['google_sub'], $sub)) {
        throw new DomainException('Этот Google-аккаунт уже является основным.');
    }
    if (!genesisGoogleTokenHasScopes($tokens, GENESIS_GOOGLE_SERVICE_SCOPES)) {
        throw new DomainException('Google не предоставил доступ к Calendar и Tasks.');
    }
    $existing = genesisFindLinkedGoogleAccountBySub($sub);
    if ($existing !== null && !hash_equals((string)$existing['owner_user_id'], $ownerUserId)) {
        throw new DomainException('Этот Google-аккаунт уже связан с другим пространством GENESIS.');
    }
    $standalone = genesisDb()->prepare('SELECT id FROM users WHERE google_sub = :sub AND id <> :owner LIMIT 1');
    $standalone->execute(['sub' => $sub, 'owner' => $ownerUserId]);
    if ($standalone->fetchColumn() !== false) {
        throw new DomainException('У этого Google-аккаунта уже есть отдельное пространство GENESIS. Объединение существующих пространств требует отдельного переноса данных.');
    }
    $refresh = !empty($tokens['refresh_token'])
        ? genesisEncrypt((string)$tokens['refresh_token'])
        : ($existing['refresh_token_enc'] ?? null);
    if (empty($refresh)) {
        throw new RuntimeException('Google не вернул токен для фоновой синхронизации. Повторите подключение и подтвердите доступ.');
    }
    $id = $existing['id'] ?? genesisUuid();
    $now = genesisNow();
    $positionStatement = genesisDb()->prepare('SELECT COALESCE(MAX(position), 0) + 1 FROM linked_google_accounts WHERE owner_user_id = :owner_user_id');
    $positionStatement->execute(['owner_user_id' => $ownerUserId]);
    $nextPosition = (int)$positionStatement->fetchColumn();
    genesisDb()->prepare('INSERT INTO linked_google_accounts (id, owner_user_id, google_sub, email, display_name, avatar_url, access_token_enc, refresh_token_enc, token_expires_at, granted_scopes, google_calendar_id, position, created_at, updated_at) VALUES (:id, :owner_user_id, :google_sub, :email, :display_name, :avatar_url, :access_token_enc, :refresh_token_enc, :token_expires_at, :granted_scopes, :google_calendar_id, :position, :created_at, :updated_at) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, avatar_url = excluded.avatar_url, access_token_enc = excluded.access_token_enc, refresh_token_enc = excluded.refresh_token_enc, token_expires_at = excluded.token_expires_at, granted_scopes = excluded.granted_scopes, updated_at = excluded.updated_at')->execute([
        'id' => (string)$id,
        'owner_user_id' => $ownerUserId,
        'google_sub' => $sub,
        'email' => $email,
        'display_name' => mb_substr((string)($profile['name'] ?? $email), 0, 160),
        'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
        'access_token_enc' => genesisEncrypt((string)$tokens['access_token']),
        'refresh_token_enc' => $refresh,
        'token_expires_at' => time() + genesisClampInt($tokens['expires_in'] ?? 3600, 60, 86400, 3600) - 60,
        'granted_scopes' => (string)($tokens['scope'] ?? ''),
        'google_calendar_id' => $existing['google_calendar_id'] ?? null,
        'position' => $existing['position'] ?? $nextPosition,
        'created_at' => $existing['created_at'] ?? $now,
        'updated_at' => $now,
    ]);
    $account = genesisFindLinkedGoogleAccount((string)$id);
    if ($account === null) {
        throw new RuntimeException('Дополнительный аккаунт не удалось сохранить.');
    }
    return genesisEnsureGoogleCalendar($account);
}

function genesisSetPassword(string $userId, string $password, ?string $currentPassword = null): void
{
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new RuntimeException('Пользователь не найден.');
    }
    if (!genesisIsValidEmail((string)$user['email']) || empty($user['refresh_token_enc'])) {
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
    if (!genesisIsValidEmail($email)) {
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
    $clientManaged = ($user['workspace_key_mode'] ?? 'legacy') === 'client' && empty($user['workspace_key_enc']);
    $key = null;
    if (!$clientManaged) {
        $user = genesisEnsureWorkspaceKey($user);
        $key = genesisDecrypt($user['workspace_key_enc'] ?? null);
        if (!is_string($key) || $key === '') {
            throw new RuntimeException('Workspace encryption key is unavailable.');
        }
    }
    $statement = genesisDb()->prepare('SELECT ciphertext, iv, version, updated_at FROM workspace_blobs WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => (string)$user['id']]);
    $blob = $statement->fetch();
    return [
        'key' => $key,
        'keyMode' => $clientManaged ? (empty($user['workspace_key_wrapped']) ? 'new' : 'client') : 'account',
        'wrappedKey' => $clientManaged ? ($user['workspace_key_wrapped'] ?: null) : null,
        'wrappedKeyIv' => $clientManaged ? ($user['workspace_key_iv'] ?: null) : null,
        'envelope' => is_array($blob) ? [
            'ciphertext' => (string)$blob['ciphertext'],
            'iv' => (string)$blob['iv'],
            'version' => (int)$blob['version'],
            'updatedAt' => (string)$blob['updated_at'],
        ] : null,
    ];
}

function genesisSaveClientWorkspaceKey(string $userId, array $payload): array
{
    $key = trim((string)($payload['key'] ?? ''));
    $wrappedKey = trim((string)($payload['wrappedKey'] ?? ''));
    $iv = trim((string)($payload['iv'] ?? ''));
    $decodedPlainKey = base64_decode($key, true);
    $decodedKey = base64_decode($wrappedKey, true);
    $decodedIv = base64_decode($iv, true);
    if (!is_string($decodedPlainKey) || strlen($decodedPlainKey) !== 32) {
        throw new InvalidArgumentException('Workspace key is invalid.');
    }
    if (!is_string($decodedKey) || strlen($decodedKey) < 48 || strlen($decodedKey) > 96) {
        throw new InvalidArgumentException('Wrapped workspace key is invalid.');
    }
    if (!is_string($decodedIv) || strlen($decodedIv) !== 12) {
        throw new InvalidArgumentException('Wrapped workspace key IV is invalid.');
    }
    genesisDb()->prepare('UPDATE users SET workspace_key_mode = :mode, workspace_key_wrapped = :wrapped_key, workspace_key_iv = :iv, workspace_key_enc = :workspace_key, updated_at = :updated_at WHERE id = :id')->execute([
        'mode' => 'account',
        'wrapped_key' => $wrappedKey,
        'iv' => $iv,
        'workspace_key' => genesisEncrypt($key),
        'updated_at' => genesisNow(),
        'id' => $userId,
    ]);
    return ['keyMode' => 'account'];
}

function genesisSaveWorkspaceEnvelope(string $userId, array $payload): array
{
    $ciphertext = trim((string)($payload['ciphertext'] ?? ''));
    $iv = trim((string)($payload['iv'] ?? ''));
    if ($ciphertext === '' || strlen($ciphertext) > 10_000_000 || !preg_match('/^[A-Za-z0-9+\/=]+$/', $ciphertext)) {
        throw new InvalidArgumentException('Encrypted workspace is invalid.');
    }
    if ($iv === '' || strlen($iv) > 128 || !preg_match('/^[A-Za-z0-9+\/=]+$/', $iv)) {
        throw new InvalidArgumentException('Workspace IV is invalid.');
    }
    $hasExpectedVersion = array_key_exists('expectedVersion', $payload);
    $expectedVersion = genesisClampInt($payload['expectedVersion'] ?? 0, 0, 9_000_000_000_000_000, 0);
    $db = genesisDb();
    $ownsTransaction = !$db->inTransaction();
    if ($ownsTransaction) {
        $db->exec('BEGIN IMMEDIATE');
    }
    try {
        $statement = $db->prepare('SELECT version FROM workspace_blobs WHERE user_id = :user_id LIMIT 1');
        $statement->execute(['user_id' => $userId]);
        $storedVersion = $statement->fetchColumn();
        $currentVersion = $storedVersion === false ? 0 : (int)$storedVersion;
        if ($hasExpectedVersion && $expectedVersion !== $currentVersion) {
            throw new GenesisWorkspaceConflictException($currentVersion);
        }
        $version = $currentVersion + 1;
        $now = genesisNow();
        $db->prepare('INSERT INTO workspace_blobs (user_id, ciphertext, iv, version, updated_at) VALUES (:user_id, :ciphertext, :iv, :version, :updated_at) ON CONFLICT(user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, version = excluded.version, updated_at = excluded.updated_at')->execute([
            'user_id' => $userId,
            'ciphertext' => $ciphertext,
            'iv' => $iv,
            'version' => $version,
            'updated_at' => $now,
        ]);
        if ($ownsTransaction) {
            $db->exec('COMMIT');
        }
        return ['version' => $version, 'updatedAt' => $now];
    } catch (Throwable $error) {
        if ($ownsTransaction) {
            $db->exec('ROLLBACK');
        }
        throw $error;
    }
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
        'habit_count' => genesisClampInt($metrics['habitCount'] ?? 0, 0, 100_000, 0),
    ];
    $values['user_id'] = $userId;
    $values['updated_at'] = genesisNow();
    genesisDb()->prepare('INSERT INTO user_metrics (user_id, project_count, task_count, open_task_count, completed_task_count, google_synced_count, habit_count, updated_at) VALUES (:user_id, :project_count, :task_count, :open_task_count, :completed_task_count, :google_synced_count, :habit_count, :updated_at) ON CONFLICT(user_id) DO UPDATE SET project_count = excluded.project_count, task_count = excluded.task_count, open_task_count = excluded.open_task_count, completed_task_count = excluded.completed_task_count, google_synced_count = excluded.google_synced_count, habit_count = excluded.habit_count, updated_at = excluded.updated_at')->execute($values);
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
    $rows = genesisDb()->query('SELECT u.id, u.email, u.display_name, u.created_at, u.last_login_at, u.last_seen_at, u.login_count, u.password_hash IS NOT NULL AS password_enabled, u.google_calendar_id IS NOT NULL AS calendar_connected, COALESCE(m.project_count, 0) AS project_count, COALESCE(m.task_count, 0) AS task_count, COALESCE(m.open_task_count, 0) AS open_task_count, COALESCE(m.completed_task_count, 0) AS completed_task_count, COALESCE(m.google_synced_count, 0) AS google_synced_count, COALESCE(m.habit_count, 0) AS habit_count, m.updated_at AS metrics_updated_at FROM users u LEFT JOIN user_metrics m ON m.user_id = u.id ORDER BY COALESCE(u.last_seen_at, u.created_at) DESC')->fetchAll();
    return [
        'users' => array_map(static fn(array $row): array => [
            'id' => (string)$row['id'],
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
            'habitCount' => (int)$row['habit_count'],
            'isAdmin' => mb_strtolower((string)$row['email']) === genesisAdminEmail(),
            'metricsUpdatedAt' => $row['metrics_updated_at'] ?: null,
        ], $rows),
        'totals' => [
            'users' => count($rows),
            'projects' => array_sum(array_map(static fn(array $row): int => (int)$row['project_count'], $rows)),
            'tasks' => array_sum(array_map(static fn(array $row): int => (int)$row['task_count'], $rows)),
            'completedTasks' => array_sum(array_map(static fn(array $row): int => (int)$row['completed_task_count'], $rows)),
            'habits' => array_sum(array_map(static fn(array $row): int => (int)$row['habit_count'], $rows)),
            'blockedIdentities' => (int)genesisDb()->query('SELECT COUNT(*) FROM blocked_identities')->fetchColumn(),
        ],
    ];
}

function genesisAssertIdentityAllowed(string $googleSub, string $email): void
{
    $statement = genesisDb()->prepare('SELECT 1 FROM blocked_identities WHERE google_sub_hash = :google_sub_hash OR email_hash = :email_hash LIMIT 1');
    $statement->execute([
        'google_sub_hash' => genesisIdentifierHash('google-sub', $googleSub),
        'email_hash' => genesisIdentifierHash('email', $email),
    ]);
    if ($statement->fetchColumn() !== false) {
        throw new DomainException('Этот аккаунт заблокирован администратором GENESIS.');
    }
}

function genesisBlockUserIdentity(array $user): void
{
    $googleSub = trim((string)($user['google_sub'] ?? ''));
    $email = trim((string)($user['email'] ?? ''));
    $statement = genesisDb()->prepare('INSERT OR IGNORE INTO blocked_identities (id, google_sub_hash, email_hash, created_at) VALUES (:id, :google_sub_hash, :email_hash, :created_at)');
    $statement->execute([
        'id' => genesisUuid(),
        'google_sub_hash' => $googleSub !== '' ? genesisIdentifierHash('google-sub', $googleSub) : null,
        'email_hash' => $email !== '' ? genesisIdentifierHash('email', $email) : null,
        'created_at' => genesisNow(),
    ]);
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
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new DomainException('Пользователь не найден.');
    }
    if (!empty($user['stoicheion_divination_disabled'])) {
        throw new DomainException('Гадания по картам отключены в личном кабинете.');
    }
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
        if (!is_array($saved)) {
            throw new RuntimeException('Расклад не удалось сохранить.');
        }
        $db->exec('COMMIT');
        genesisTouchUser($userId);
        return genesisStoicheionDrawForClient($saved);
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}

function genesisUpdateAccountPreferences(string $userId, array $payload): array
{
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new RuntimeException('Пользователь не найден.');
    }
    $updates = [];
    $values = ['updated_at' => genesisNow(), 'id' => $userId];
    $hasThemePreference = array_key_exists('theme', $payload);
    if (array_key_exists('stoicheionDivinationDisabled', $payload)) {
        if (!is_bool($payload['stoicheionDivinationDisabled'])) {
            throw new InvalidArgumentException('Настройка гаданий указана неверно.');
        }
        $updates[] = 'stoicheion_divination_disabled = :divination_disabled';
        $values['divination_disabled'] = $payload['stoicheionDivinationDisabled'] ? 1 : 0;
    }
    if (array_key_exists('calendarMode', $payload)) {
        $calendarMode = trim((string)$payload['calendarMode']);
        if (!in_array($calendarMode, ['profane', 'sacred', 'lunar'], true)) {
            throw new InvalidArgumentException('Неизвестный режим календаря.');
        }
        $updates[] = 'calendar_mode = :calendar_mode';
        $values['calendar_mode'] = $calendarMode;
    }
    if (array_key_exists('taskCalendarMode', $payload)) {
        $taskCalendarMode = trim((string)$payload['taskCalendarMode']);
        if (!in_array($taskCalendarMode, ['profane', 'sacred', 'lunar'], true)) {
            throw new InvalidArgumentException('Неизвестный календарь постановки задач.');
        }
        $updates[] = 'task_calendar_mode = :task_calendar_mode';
        $values['task_calendar_mode'] = $taskCalendarMode;
    }
    if (array_key_exists('timeFormat', $payload)) {
        $timeFormat = trim((string)$payload['timeFormat']);
        if (!in_array($timeFormat, ['24h', '12h'], true)) {
            throw new InvalidArgumentException('Неизвестный формат времени.');
        }
        $updates[] = 'time_format = :time_format';
        $values['time_format'] = $timeFormat;
    }
    if (array_key_exists('weekStart', $payload)) {
        $weekStart = trim((string)$payload['weekStart']);
        if (!in_array($weekStart, ['sunday', 'monday'], true)) {
            throw new InvalidArgumentException('Неизвестное начало недели.');
        }
        $updates[] = 'week_start = :week_start';
        $values['week_start'] = $weekStart;
    }
    if (array_key_exists('gregorianYearStart', $payload)) {
        $yearStart = trim((string)$payload['gregorianYearStart']);
        if (!in_array($yearStart, ['january', 'march'], true)) {
            throw new InvalidArgumentException('Неизвестное начало григорианского года.');
        }
        $updates[] = 'gregorian_year_start = :gregorian_year_start';
        $values['gregorian_year_start'] = $yearStart;
    }
    if ($hasThemePreference) {
        $theme = trim((string)$payload['theme']);
        if (!in_array($theme, ['standart', 'experimental'], true)) {
            throw new InvalidArgumentException('Неизвестная тема интерфейса.');
        }
        $expectedThemeRevision = filter_var($payload['expectedThemeRevision'] ?? null, FILTER_VALIDATE_INT);
        if ($expectedThemeRevision === false || (int)$expectedThemeRevision < 0) {
            throw new InvalidArgumentException('Не указана версия настройки темы.');
        }
        $currentThemeRevision = max(0, (int)($user['theme_revision'] ?? 0));
        if ((int)$expectedThemeRevision !== $currentThemeRevision) {
            throw new DomainException('Настройка темы уже изменилась на другом устройстве. Обновите данные и повторите попытку.');
        }
        $updates[] = 'theme = :theme';
        $updates[] = 'theme_revision = :theme_revision';
        $values['theme'] = $theme;
        $values['theme_revision'] = $currentThemeRevision + 1;
        $values['expected_theme_revision'] = $currentThemeRevision;
    }
    if (array_key_exists('language', $payload)) {
        $language = trim((string)$payload['language']);
        if (!in_array($language, ['ru', 'en'], true)) {
            throw new InvalidArgumentException('Неизвестный язык интерфейса.');
        }
        $updates[] = 'language = :language';
        $values['language'] = $language;
    }
    $hasSyncPreference = array_key_exists('syncRouting', $payload);
    if ($hasSyncPreference) {
        if (!genesisMultiAccountEnabled($user) || !is_array($payload['syncRouting'])) {
            throw new DomainException('Маршрутизация по аккаунтам недоступна.');
        }
        $routing = $payload['syncRouting'];
        $mode = trim((string)($routing['mode'] ?? ''));
        if (!in_array($mode, ['fixed', 'choose', 'category'], true)) {
            throw new InvalidArgumentException('Неизвестный режим синхронизации.');
        }
        $validAccountIds = array_map(static fn(array $account): string => (string)$account['id'], genesisGoogleAccountsForUser($user));
        $targets = array_values(array_filter(
            genesisDecodeStringListJson($routing['defaultAccountIds'] ?? []),
            static fn(string $id): bool => in_array($id, $validAccountIds, true),
        ));
        if ($targets === []) {
            $targets = [(string)$user['id']];
        }
        $categoryMap = genesisCategorySyncMap($routing['categoryAccountIds'] ?? []);
        foreach ($categoryMap as $categoryId => $accountIds) {
            $categoryMap[$categoryId] = array_values(array_filter(
                $accountIds,
                static fn(string $id): bool => in_array($id, $validAccountIds, true),
            ));
        }
        $updates[] = 'sync_routing_mode = :sync_routing_mode';
        $updates[] = 'sync_target_account_ids = :sync_target_account_ids';
        $updates[] = 'category_sync_map = :category_sync_map';
        $values['sync_routing_mode'] = $mode;
        $values['sync_target_account_ids'] = json_encode($targets, JSON_THROW_ON_ERROR);
        $values['category_sync_map'] = json_encode($categoryMap, JSON_THROW_ON_ERROR);
    }
    if ($updates === []) {
        throw new InvalidArgumentException('Нет настроек для сохранения.');
    }
    $updates[] = 'updated_at = :updated_at';
    $where = 'id = :id';
    if ($hasThemePreference) {
        $where .= ' AND theme_revision = :expected_theme_revision';
    }
    $statement = genesisDb()->prepare('UPDATE users SET ' . implode(', ', $updates) . ' WHERE ' . $where);
    $statement->execute($values);
    if ($hasThemePreference && $statement->rowCount() !== 1) {
        throw new DomainException('Настройка темы уже изменилась на другом устройстве. Обновите данные и повторите попытку.');
    }
    $updated = genesisFindUser($userId);
    if ($updated === null) throw new RuntimeException('Настройки аккаунта не удалось сохранить.');
    return $updated;
}

function genesisAccountDataLocations(): array
{
    return [
        'categories' => 'user_id',
        'projects' => 'user_id',
        'tasks' => 'user_id',
        'task_links' => 'user_id',
        'workspace_blobs' => 'user_id',
        'user_metrics' => 'user_id',
        'stoicheion_draws' => 'user_id',
        'linked_google_accounts' => 'owner_user_id',
        'users' => 'id',
    ];
}

function genesisAccountDataCounts(string $userId): array
{
    $counts = [];
    foreach (genesisAccountDataLocations() as $table => $column) {
        $statement = genesisDb()->prepare("SELECT COUNT(*) FROM {$table} WHERE {$column} = :user_id");
        $statement->execute(['user_id' => $userId]);
        $counts[$table] = (int)$statement->fetchColumn();
    }
    return $counts;
}

function genesisRevokeAccountTokens(array $user): void
{
    foreach (genesisLinkedGoogleAccounts((string)$user['id']) as $account) {
        try {
            genesisRevokeGoogleToken($account);
        } catch (Throwable $error) {
            genesisLogError('Linked Google token revocation failed during account deletion.', $error);
        }
    }
    try {
        genesisRevokeGoogleToken($user);
    } catch (Throwable $error) {
        genesisLogError('Google token revocation failed during account deletion.', $error);
    }
}

function genesisDeleteAccountRows(string $userId): array
{
    $purged = genesisAccountDataCounts($userId);
    $statement = genesisDb()->prepare('DELETE FROM users WHERE id = :id');
    $statement->execute(['id' => $userId]);
    if ($statement->rowCount() !== 1) {
        throw new RuntimeException('Аккаунт не удалось удалить.');
    }
    $remaining = genesisAccountDataCounts($userId);
    if (array_sum($remaining) !== 0) {
        throw new RuntimeException('Не все данные аккаунта были удалены. Операция отменена.');
    }
    return $purged;
}

function genesisDeleteAccount(string $userId): array
{
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new DomainException('Аккаунт не найден или уже удалён.');
    }
    genesisRevokeAccountTokens($user);
    $db = genesisDb();
    $ownsTransaction = !$db->inTransaction();
    if ($ownsTransaction) {
        $db->beginTransaction();
    }
    try {
        $purged = genesisDeleteAccountRows($userId);
        if ($ownsTransaction) {
            $db->commit();
        }
        return $purged;
    } catch (Throwable $error) {
        if ($ownsTransaction && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function genesisAdminDeleteUser(string $adminUserId, string $targetUserId, bool $blacklist): array
{
    $admin = genesisFindUser($adminUserId);
    $target = genesisFindUser($targetUserId);
    if ($admin === null || mb_strtolower((string)$admin['email']) !== genesisAdminEmail()) {
        throw new DomainException('Недостаточно прав для удаления пользователя.');
    }
    if ($target === null) {
        throw new DomainException('Пользователь не найден или уже удалён.');
    }
    if ($adminUserId === $targetUserId || mb_strtolower((string)$target['email']) === genesisAdminEmail()) {
        throw new DomainException('Администратор не может удалить собственный аккаунт через панель модерации.');
    }

    $linkedIdentities = genesisLinkedGoogleAccounts($targetUserId);
    genesisRevokeAccountTokens($target);
    $db = genesisDb();
    $ownsTransaction = !$db->inTransaction();
    if ($ownsTransaction) {
        $db->beginTransaction();
    }
    try {
        if ($blacklist) {
            genesisBlockUserIdentity($target);
            foreach ($linkedIdentities as $linkedIdentity) {
                genesisBlockUserIdentity($linkedIdentity);
            }
        }
        $purged = genesisDeleteAccountRows($targetUserId);
        if ($ownsTransaction) {
            $db->commit();
        }
        return ['deleted' => true, 'blacklisted' => $blacklist, 'purged' => $purged];
    } catch (Throwable $error) {
        if ($ownsTransaction && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function genesisRemoveLinkedGoogleAccount(string $ownerUserId, string $accountId): void
{
    $owner = genesisFindUser($ownerUserId);
    if ($owner === null || !genesisMultiAccountEnabled($owner)) {
        throw new DomainException('Дополнительные аккаунты недоступны.');
    }
    $account = genesisGoogleAccountForUser($ownerUserId, $accountId);
    if ($account === null || empty($account['_linked_account'])) {
        throw new InvalidArgumentException('Дополнительный аккаунт не найден.');
    }
    try {
        genesisRevokeGoogleToken($account);
    } catch (Throwable $error) {
        genesisLogError('Linked Google token revocation failed.', $error);
    }
    genesisDb()->prepare('DELETE FROM linked_google_accounts WHERE id = :id AND owner_user_id = :owner_user_id')->execute([
        'id' => $accountId,
        'owner_user_id' => $ownerUserId,
    ]);
}

function genesisDisconnectGoogleServices(string $userId): array
{
    $user = genesisFindUser($userId);
    if ($user === null) {
        throw new RuntimeException('Пользователь не найден.');
    }
    genesisRevokeGoogleToken($user);
    genesisDb()->prepare("UPDATE users SET access_token_enc = NULL, refresh_token_enc = NULL, token_expires_at = NULL, granted_scopes = '', updated_at = :updated_at WHERE id = :id")->execute([
        'updated_at' => genesisNow(),
        'id' => $userId,
    ]);
    $updated = genesisFindUser($userId);
    if ($updated === null) {
        throw new RuntimeException('Не удалось отключить Google Calendar и Tasks.');
    }
    return $updated;
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
