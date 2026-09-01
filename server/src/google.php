<?php
declare(strict_types=1);

const GENESIS_GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.app.created',
];

function genesisBase64Url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function genesisGoogleRedirectUri(): string
{
    return rtrim((string)genesisConfig()['app_url'], '/') . '/api/auth/google/callback';
}

function genesisGoogleAuthUrl(string $state, string $challenge): string
{
    $config = genesisConfig();
    if (empty($config['google_client_id'])) {
        throw new RuntimeException('Google OAuth client is not configured.');
    }
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => (string)$config['google_client_id'],
        'redirect_uri' => genesisGoogleRedirectUri(),
        'response_type' => 'code',
        'scope' => implode(' ', GENESIS_GOOGLE_SCOPES),
        'access_type' => 'offline',
        'include_granted_scopes' => 'true',
        'prompt' => 'consent select_account',
        'state' => $state,
        'code_challenge' => $challenge,
        'code_challenge_method' => 'S256',
    ], '', '&', PHP_QUERY_RFC3986);
}

function genesisCurl(string $url, array $options = []): array
{
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER => true,
        CURLOPT_USERAGENT => 'GENESIS-Calendar/2.0',
    ] + $options);
    $raw = curl_exec($handle);
    if ($raw === false) {
        $message = curl_error($handle);
        curl_close($handle);
        throw new RuntimeException('Google connection failed: ' . $message);
    }
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $headerSize = (int)curl_getinfo($handle, CURLINFO_HEADER_SIZE);
    curl_close($handle);
    $body = substr((string)$raw, $headerSize);
    $decoded = json_decode($body, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($decoded)
            ? (string)($decoded['error_description'] ?? $decoded['error']['message'] ?? $decoded['error'] ?? 'Google API error')
            : 'Google API error';
        throw new RuntimeException($message . ' (' . $status . ')');
    }
    return is_array($decoded) ? $decoded : [];
}

function genesisGoogleTokenRequest(array $fields): array
{
    return genesisCurl('https://oauth2.googleapis.com/token', [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
}

function genesisExchangeGoogleCode(string $code, string $verifier): array
{
    $config = genesisConfig();
    return genesisGoogleTokenRequest([
        'code' => $code,
        'client_id' => (string)$config['google_client_id'],
        'client_secret' => (string)$config['google_client_secret'],
        'redirect_uri' => genesisGoogleRedirectUri(),
        'grant_type' => 'authorization_code',
        'code_verifier' => $verifier,
    ]);
}

function genesisGoogleUserInfo(string $accessToken): array
{
    return genesisCurl('https://openidconnect.googleapis.com/v1/userinfo', [
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    ]);
}

function genesisGoogleAccessToken(array $user): string
{
    $current = genesisDecrypt($user['access_token_enc'] ?? null);
    if ($current && (int)($user['token_expires_at'] ?? 0) > time() + 60) {
        return $current;
    }
    $refresh = genesisDecrypt($user['refresh_token_enc'] ?? null);
    if (!$refresh) {
        throw new RuntimeException('Google Calendar authorization must be renewed.');
    }
    $config = genesisConfig();
    $tokens = genesisGoogleTokenRequest([
        'client_id' => (string)$config['google_client_id'],
        'client_secret' => (string)$config['google_client_secret'],
        'refresh_token' => $refresh,
        'grant_type' => 'refresh_token',
    ]);
    $access = (string)$tokens['access_token'];
    genesisDb()->prepare('UPDATE users SET access_token_enc = :access, token_expires_at = :expires_at, updated_at = :updated_at WHERE id = :id')->execute([
        'access' => genesisEncrypt($access),
        'expires_at' => time() + genesisClampInt($tokens['expires_in'] ?? 3600, 60, 86400, 3600) - 60,
        'updated_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
    return $access;
}

function genesisGoogleApi(string $method, string $path, array $user, ?array $payload = null): array
{
    $headers = [
        'Authorization: Bearer ' . genesisGoogleAccessToken($user),
        'Accept: application/json',
    ];
    $options = [CURLOPT_CUSTOMREQUEST => $method];
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
    $options[CURLOPT_HTTPHEADER] = $headers;
    return genesisCurl('https://www.googleapis.com/calendar/v3' . $path, $options);
}

function genesisEnsureGoogleCalendar(array $user): array
{
    if (!empty($user['google_calendar_id'])) {
        return $user;
    }
    $calendar = genesisGoogleApi('POST', '/calendars', $user, [
        'summary' => 'GENESIS',
        'description' => 'Задачи и напоминания приложения GENESIS. Содержание хранится в Google Calendar, а не в базе GENESIS.',
        'timeZone' => (string)(genesisConfig()['timezone'] ?? 'Europe/Moscow'),
    ]);
    if (empty($calendar['id'])) {
        throw new RuntimeException('Google Calendar could not be created.');
    }
    genesisDb()->prepare('UPDATE users SET google_calendar_id = :calendar_id, updated_at = :updated_at WHERE id = :id')->execute([
        'calendar_id' => (string)$calendar['id'],
        'updated_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
    $user['google_calendar_id'] = (string)$calendar['id'];
    return $user;
}

function genesisStringList(mixed $value, int $limit = 50): array
{
    if (!is_array($value)) {
        return [];
    }
    $result = [];
    foreach ($value as $item) {
        $clean = mb_substr(trim((string)$item), 0, 100);
        if ($clean !== '' && !in_array($clean, $result, true)) {
            $result[] = $clean;
        }
        if (count($result) >= $limit) {
            break;
        }
    }
    return $result;
}

function genesisTaskPayloadForGoogle(string $taskId, array $task): array
{
    $timezoneName = (string)(genesisConfig()['timezone'] ?? 'Europe/Moscow');
    $timezone = new DateTimeZone($timezoneName);
    $title = mb_substr(trim((string)($task['title'] ?? '')), 0, 500);
    if ($title === '') {
        throw new InvalidArgumentException('Название задачи обязательно.');
    }
    $dueDate = (string)($task['dueDate'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        throw new InvalidArgumentException('Дата задачи указана неверно.');
    }
    $timeValue = preg_match('/^\d{2}:\d{2}$/', (string)($task['time'] ?? '')) ? (string)$task['time'] : '';
    $done = !empty($task['done']);
    $tags = genesisStringList($task['tags'] ?? [], 10);
    $dependsOn = genesisStringList($task['dependsOnIds'] ?? [], 30);
    $recurrence = in_array($task['recurrence'] ?? '', ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'], true) ? (string)$task['recurrence'] : 'none';
    $project = mb_substr(trim((string)($task['project'] ?? '')), 0, 300);
    $description = mb_substr(trim((string)($task['description'] ?? '')), 0, 5000);
    $metadataDescription = trim(implode("\n", array_filter([
        $project !== '' ? 'Проект: ' . $project : '',
        $tags ? implode(' ', array_map(static fn(string $tag): string => '#' . $tag, $tags)) : '',
        'Создано в GENESIS',
    ])));
    $visibleDescription = trim($description . ($metadataDescription !== '' ? "\n\n— GENESIS —\n" . $metadataDescription : ''));
    $private = [
        'genesisTaskId' => $taskId,
        'genesisDone' => $done ? '1' : '0',
        'genesisCompletedAt' => mb_substr((string)($task['completedAt'] ?? ''), 0, 40),
        'genesisProjectId' => mb_substr((string)($task['projectId'] ?? ''), 0, 100),
        'genesisProject' => $project,
        'genesisCategoryId' => mb_substr((string)($task['categoryId'] ?? ''), 0, 100),
        'genesisTags' => genesisBase64Url(json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)),
        'genesisDependsOn' => genesisBase64Url(json_encode($dependsOn, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)),
        'genesisRecurrence' => $recurrence,
        'genesisInterval' => (string)genesisClampInt($task['recurrenceInterval'] ?? 1, 1, 99, 1),
        'genesisUpdatedAt' => (string)genesisClampInt($task['updatedAt'] ?? (int)(microtime(true) * 1000), 0, PHP_INT_MAX, (int)(microtime(true) * 1000)),
    ];
    $event = [
        'summary' => ($done ? '✓ ' : '') . $title,
        'description' => $visibleDescription,
        'extendedProperties' => ['private' => $private],
        'reminders' => isset($task['reminderMinutes']) && $task['reminderMinutes'] !== null
            ? ['useDefault' => false, 'overrides' => [['method' => 'popup', 'minutes' => genesisClampInt($task['reminderMinutes'], 0, 40320, 30)]]]
            : ['useDefault' => true],
    ];
    if ($timeValue !== '') {
        $start = new DateTimeImmutable($dueDate . ' ' . $timeValue, $timezone);
        $event['start'] = ['dateTime' => $start->format(DATE_RFC3339), 'timeZone' => $timezoneName];
        $event['end'] = ['dateTime' => $start->modify('+1 hour')->format(DATE_RFC3339), 'timeZone' => $timezoneName];
    } else {
        $date = new DateTimeImmutable($dueDate . ' 12:00:00', $timezone);
        $event['start'] = ['date' => $date->format('Y-m-d')];
        $event['end'] = ['date' => $date->modify('+1 day')->format('Y-m-d')];
    }
    return $event;
}

function genesisDecodeBase64Json(string $value): array
{
    $padding = (4 - strlen($value) % 4) % 4;
    $decoded = base64_decode(strtr($value . str_repeat('=', $padding), '-_', '+/'), true);
    $json = is_string($decoded) ? json_decode($decoded, true) : null;
    return is_array($json) ? array_values(array_filter($json, 'is_string')) : [];
}

function genesisGoogleEventForClient(array $event): ?array
{
    $private = $event['extendedProperties']['private'] ?? [];
    $taskId = is_array($private) ? trim((string)($private['genesisTaskId'] ?? '')) : '';
    if ($taskId === '' || ($event['status'] ?? '') === 'cancelled') {
        return null;
    }
    $summary = (string)($event['summary'] ?? 'Без названия');
    $done = ($private['genesisDone'] ?? '') === '1' || str_starts_with($summary, '✓ ');
    $title = $done && str_starts_with($summary, '✓ ') ? mb_substr($summary, 2) : $summary;
    $timezone = new DateTimeZone((string)(genesisConfig()['timezone'] ?? 'Europe/Moscow'));
    $dateTime = $event['start']['dateTime'] ?? null;
    $date = $event['start']['date'] ?? null;
    $dueDate = date('Y-m-d');
    $time = '';
    if (is_string($dateTime) && $dateTime !== '') {
        $start = (new DateTimeImmutable($dateTime))->setTimezone($timezone);
        $dueDate = $start->format('Y-m-d');
        $time = $start->format('H:i');
    } elseif (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $dueDate = $date;
    }
    $sacred = genesisSacredFromDate($dueDate);
    $rawDescription = (string)($event['description'] ?? '');
    $description = trim(explode("\n\n— GENESIS —\n", $rawDescription, 2)[0]);
    $reminder = null;
    if (($event['reminders']['useDefault'] ?? true) === false) {
        $first = $event['reminders']['overrides'][0]['minutes'] ?? null;
        $reminder = is_numeric($first) ? (int)$first : null;
    }
    return [
        'id' => $taskId,
        'sacredYear' => $sacred['sacredYear'],
        'monthIndex' => $sacred['monthIndex'],
        'day' => $sacred['day'],
        'dueDate' => $dueDate,
        'title' => mb_substr($title, 0, 500),
        'description' => $description,
        'time' => $time,
        'project' => (string)($private['genesisProject'] ?? ''),
        'projectId' => ($private['genesisProjectId'] ?? '') !== '' ? (string)$private['genesisProjectId'] : null,
        'categoryId' => ($private['genesisCategoryId'] ?? '') !== '' ? (string)$private['genesisCategoryId'] : null,
        'tags' => genesisDecodeBase64Json((string)($private['genesisTags'] ?? '')),
        'dependsOnIds' => genesisDecodeBase64Json((string)($private['genesisDependsOn'] ?? '')),
        'done' => $done,
        'completedAt' => ($private['genesisCompletedAt'] ?? '') !== '' ? (string)$private['genesisCompletedAt'] : null,
        'reminderMinutes' => $reminder,
        'recurrence' => (string)($private['genesisRecurrence'] ?? 'none'),
        'recurrenceInterval' => genesisClampInt($private['genesisInterval'] ?? 1, 1, 99, 1),
        'syncToGoogle' => true,
        'googleEventId' => (string)($event['id'] ?? ''),
        'updatedAt' => genesisClampInt($private['genesisUpdatedAt'] ?? (strtotime((string)($event['updated'] ?? 'now')) * 1000), 0, PHP_INT_MAX, (int)(microtime(true) * 1000)),
    ];
}

function genesisFindGoogleEvent(array $user, string $taskId): ?array
{
    $user = genesisEnsureGoogleCalendar($user);
    $query = http_build_query([
        'privateExtendedProperty' => 'genesisTaskId=' . $taskId,
        'showDeleted' => 'false',
        'maxResults' => 2,
    ], '', '&', PHP_QUERY_RFC3986);
    $result = genesisGoogleApi('GET', '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events?' . $query, $user);
    foreach ($result['items'] ?? [] as $event) {
        if (is_array($event) && ($event['extendedProperties']['private']['genesisTaskId'] ?? null) === $taskId) {
            return $event;
        }
    }
    return null;
}

function genesisSyncTaskToGoogle(string $userId, string $taskId, array $task): array
{
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc'])) {
        throw new RuntimeException('Google Calendar не подключён.');
    }
    $user = genesisEnsureGoogleCalendar($user);
    $eventPayload = genesisTaskPayloadForGoogle($taskId, $task);
    $eventId = trim((string)($task['googleEventId'] ?? ''));
    if ($eventId === '') {
        $existing = genesisFindGoogleEvent($user, $taskId);
        $eventId = is_array($existing) ? (string)($existing['id'] ?? '') : '';
    }
    $calendarPath = '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events';
    $event = $eventId !== ''
        ? genesisGoogleApi('PUT', $calendarPath . '/' . rawurlencode($eventId), $user, $eventPayload)
        : genesisGoogleApi('POST', $calendarPath, $user, $eventPayload);
    $clientTask = genesisGoogleEventForClient($event);
    if ($clientTask === null) {
        throw new RuntimeException('Google Calendar did not return the saved task.');
    }
    genesisTouchUser($userId);
    return $clientTask;
}

function genesisDeleteGoogleTaskEvent(string $userId, string $taskId): void
{
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['google_calendar_id']) || empty($user['refresh_token_enc'])) {
        return;
    }
    $event = genesisFindGoogleEvent($user, $taskId);
    if (!is_array($event) || empty($event['id'])) {
        return;
    }
    try {
        genesisGoogleApi('DELETE', '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events/' . rawurlencode((string)$event['id']), $user);
    } catch (RuntimeException $error) {
        if (!str_contains($error->getMessage(), '(404)') && !str_contains($error->getMessage(), '(410)')) {
            throw $error;
        }
    }
    genesisTouchUser($userId);
}

function genesisListGoogleTasks(array $user): array
{
    if (empty($user['refresh_token_enc'])) {
        return [];
    }
    $user = genesisEnsureGoogleCalendar($user);
    $tasks = [];
    $pageToken = null;
    do {
        $query = [
            'singleEvents' => 'true',
            'showDeleted' => 'false',
            'maxResults' => 2500,
        ];
        if (is_string($pageToken) && $pageToken !== '') {
            $query['pageToken'] = $pageToken;
        }
        $result = genesisGoogleApi('GET', '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986), $user);
        foreach ($result['items'] ?? [] as $event) {
            if (!is_array($event)) {
                continue;
            }
            $task = genesisGoogleEventForClient($event);
            if ($task !== null) {
                $tasks[] = $task;
            }
        }
        $pageToken = $result['nextPageToken'] ?? null;
    } while (is_string($pageToken) && $pageToken !== '' && count($tasks) < 10_000);
    genesisDb()->prepare('UPDATE users SET last_calendar_sync_at = :synced_at, last_seen_at = :synced_at WHERE id = :id')->execute([
        'synced_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
    return $tasks;
}
