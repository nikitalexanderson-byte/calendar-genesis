<?php
declare(strict_types=1);

const GENESIS_GOOGLE_IDENTITY_SCOPES = [
    'openid',
    'email',
    'profile',
];

const GENESIS_GOOGLE_SERVICE_SCOPES = [
    'https://www.googleapis.com/auth/calendar.app.created',
    'https://www.googleapis.com/auth/tasks',
];

const GENESIS_GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.app.created',
    'https://www.googleapis.com/auth/tasks',
];

const GENESIS_GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

function genesisBase64Url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function genesisGoogleRedirectUri(): string
{
    return rtrim((string)genesisConfig()['app_url'], '/') . '/api/auth/google/callback';
}

function genesisGoogleAuthUrl(string $state, string $challenge, string $purpose = 'login', ?string $loginHint = null): string
{
    $config = genesisConfig();
    if (empty($config['google_client_id'])) {
        throw new RuntimeException('Google OAuth client is not configured.');
    }
    if (!in_array($purpose, ['login', 'services'], true)) {
        throw new InvalidArgumentException('Google OAuth purpose is invalid.');
    }
    $connectServices = $purpose === 'services';
    $parameters = [
        'client_id' => (string)$config['google_client_id'],
        'redirect_uri' => genesisGoogleRedirectUri(),
        'response_type' => 'code',
        'scope' => implode(' ', $connectServices ? GENESIS_GOOGLE_SCOPES : GENESIS_GOOGLE_IDENTITY_SCOPES),
        'access_type' => $connectServices ? 'offline' : 'online',
        'include_granted_scopes' => 'true',
        'prompt' => $connectServices ? 'consent' : 'select_account',
        'state' => $state,
        'code_challenge' => $challenge,
        'code_challenge_method' => 'S256',
    ];
    if ($connectServices && is_string($loginHint) && $loginHint !== '') {
        $parameters['login_hint'] = $loginHint;
    }
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
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

function genesisGoogleTokenHasScopes(array $tokens, array $requiredScopes): bool
{
    $grantedScopes = preg_split('/\s+/', trim((string)($tokens['scope'] ?? ''))) ?: [];
    foreach ($requiredScopes as $requiredScope) {
        if (!in_array($requiredScope, $grantedScopes, true)) {
            return false;
        }
    }
    return true;
}

function genesisRevokeGoogleToken(array $user): void
{
    $token = genesisDecrypt($user['refresh_token_enc'] ?? null)
        ?: genesisDecrypt($user['access_token_enc'] ?? null);
    if (!is_string($token) || $token === '') {
        return;
    }

    $handle = curl_init('https://oauth2.googleapis.com/revoke');
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['token' => $token], '', '&', PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_USERAGENT => 'GENESIS-Calendar/2.0',
    ]);
    $result = curl_exec($handle);
    if ($result === false) {
        $message = curl_error($handle);
        curl_close($handle);
        throw new RuntimeException('Google token revocation failed: ' . $message);
    }
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if (!in_array($status, [200, 400], true)) {
        throw new RuntimeException('Google token revocation failed (' . $status . ').');
    }
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

function genesisGoogleTasksApi(string $method, string $path, array $user, ?array $payload = null): array
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
    return genesisCurl('https://tasks.googleapis.com/tasks/v1' . $path, $options);
}

function genesisGoogleScopeGranted(array $user, string $scope): bool
{
    $granted = preg_split('/\s+/', trim((string)($user['granted_scopes'] ?? ''))) ?: [];
    return in_array($scope, $granted, true);
}

function genesisEnsureGoogleCalendar(array $user): array
{
    if (!empty($user['google_calendar_id'])) {
        return $user;
    }
    $calendar = genesisGoogleApi('POST', '/calendars', $user, [
        'summary' => 'GENESIS',
        'description' => 'Задачи и напоминания приложения GENESIS. Содержание хранится в Google Calendar, а не в базе GENESIS.',
        'timeZone' => genesisClientTimeZone()->getName(),
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

function genesisTaskOrigin(mixed $value, string $fallback = 'genesis'): string
{
    $origin = trim((string)$value);
    return in_array($origin, ['genesis', 'google-calendar', 'google-tasks'], true) ? $origin : $fallback;
}

function genesisTaskOriginLabel(string $origin): string
{
    return match ($origin) {
        'google-calendar' => 'Создано в Google Calendar',
        'google-tasks' => 'Создано в Google Tasks',
        default => 'Создано в GENESIS',
    };
}

function genesisTaskPayloadForGoogle(string $taskId, array $task): array
{
    $timezone = genesisClientTimeZone();
    $timezoneName = $timezone->getName();
    $title = mb_substr(trim((string)($task['title'] ?? '')), 0, 500);
    if ($title === '') {
        throw new InvalidArgumentException('Название задачи обязательно.');
    }
    $dueDate = (string)($task['dueDate'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        throw new InvalidArgumentException('Дата задачи указана неверно.');
    }
    $endDate = (string)($task['endDate'] ?? $dueDate);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate) || $endDate < $dueDate) {
        throw new InvalidArgumentException('Срок выполнения задачи указан неверно.');
    }
    $timeValue = preg_match('/^\d{2}:\d{2}$/', (string)($task['time'] ?? '')) ? (string)$task['time'] : '';
    $done = !empty($task['done']);
    $tags = genesisStringList($task['tags'] ?? [], 10);
    $dependsOn = genesisStringList($task['dependsOnIds'] ?? [], 30);
    $priority = genesisClampInt($task['priority'] ?? 5, 1, 10, 5);
    $recurrence = in_array($task['recurrence'] ?? '', ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'], true) ? (string)$task['recurrence'] : 'none';
    $recurrenceMode = in_array($task['recurrenceMode'] ?? '', ['none', 'genesis', 'classic', 'lunar'], true) ? (string)$task['recurrenceMode'] : 'none';
    $recurrencePattern = in_array($task['recurrencePattern'] ?? '', ['none', 'daily', 'weekdays', 'monthly', 'yearly', 'pyata-days', 'month-days', 'lunar-days'], true) ? (string)$task['recurrencePattern'] : 'none';
    $recurrenceDays = array_values(array_unique(array_filter(
        array_map('intval', genesisStringList($task['recurrenceDays'] ?? [], 30)),
        static fn(int $day): bool => $day >= 1 && $day <= 30,
    )));
    sort($recurrenceDays);
    $recurrenceStartDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($task['recurrenceStartDate'] ?? '')) ? (string)$task['recurrenceStartDate'] : '';
    $recurrenceEndDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($task['recurrenceEndDate'] ?? '')) ? (string)$task['recurrenceEndDate'] : '';
    $recurrenceMonths = array_values(array_unique(array_filter(
        array_map('intval', genesisStringList($task['recurrenceMonths'] ?? [], 72)),
        static fn(int $month): bool => $month >= 1 && $month <= 72,
    )));
    sort($recurrenceMonths);
    $recurrencePyatas = array_values(array_unique(array_filter(
        array_map('intval', genesisStringList($task['recurrencePyatas'] ?? [], 6)),
        static fn(int $pyata): bool => $pyata >= 1 && $pyata <= 6,
    )));
    sort($recurrencePyatas);
    $recurrenceSeriesId = mb_substr(trim((string)($task['recurrenceSeriesId'] ?? '')), 0, 100);
    $project = mb_substr(trim((string)($task['project'] ?? '')), 0, 300);
    $description = mb_substr(trim((string)($task['description'] ?? '')), 0, 5000);
    $createdIn = genesisTaskOrigin($task['createdIn'] ?? null);
    $metadataDescription = trim(implode("\n", array_filter([
        genesisTaskOriginLabel($createdIn),
        'Срок: ' . $dueDate . ($endDate !== $dueDate ? ' — ' . $endDate : ''),
        $project !== '' ? 'Проект: ' . $project : '',
        $tags ? 'Теги: ' . implode(' ', array_map(static fn(string $tag): string => '#' . $tag, $tags)) : '',
        'Приоритет: ' . $priority,
        $dependsOn ? 'Связанных задач: ' . count($dependsOn) : '',
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
        'genesisCycleMode' => $recurrenceMode,
        'genesisCyclePattern' => $recurrencePattern,
        'genesisCycleDays' => genesisBase64Url(json_encode($recurrenceDays, JSON_THROW_ON_ERROR)),
        'genesisCycleStart' => $recurrenceStartDate,
        'genesisCycleEnd' => $recurrenceEndDate,
        'genesisCycleMonths' => genesisBase64Url(json_encode($recurrenceMonths, JSON_THROW_ON_ERROR)),
        'genesisCyclePyatas' => genesisBase64Url(json_encode($recurrencePyatas, JSON_THROW_ON_ERROR)),
        'genesisSeriesId' => $recurrenceSeriesId,
        'genesisPriority' => (string)$priority,
        'genesisSource' => $createdIn,
        'genesisEndDate' => $endDate,
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
        $end = new DateTimeImmutable($endDate . ' ' . $timeValue, $timezone);
        if ($end <= $start) {
            $end = $start->modify('+1 hour');
        }
        $event['start'] = ['dateTime' => $start->format(DATE_RFC3339), 'timeZone' => $timezoneName];
        $event['end'] = ['dateTime' => $end->format(DATE_RFC3339), 'timeZone' => $timezoneName];
    } else {
        $date = new DateTimeImmutable($dueDate . ' 12:00:00', $timezone);
        $rangeEnd = new DateTimeImmutable($endDate . ' 12:00:00', $timezone);
        $event['start'] = ['date' => $date->format('Y-m-d')];
        $event['end'] = ['date' => $rangeEnd->modify('+1 day')->format('Y-m-d')];
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

function genesisDecodeBase64IntJson(string $value, int $minimum = 1, int $maximum = 30): array
{
    $padding = (4 - strlen($value) % 4) % 4;
    $decoded = base64_decode(strtr($value . str_repeat('=', $padding), '-_', '+/'), true);
    $json = is_string($decoded) ? json_decode($decoded, true) : null;
    if (!is_array($json)) {
        return [];
    }
    $items = array_values(array_unique(array_filter(
        array_map('intval', $json),
        static fn(int $item): bool => $item >= $minimum && $item <= $maximum,
    )));
    sort($items);
    return $items;
}

function genesisDecodeTaskNotes(string $notes): array
{
    $parts = explode("\n\n— GENESIS —\n", $notes, 2);
    $metadata = [];
    if (isset($parts[1]) && preg_match('/^GENESIS-DATA:([A-Za-z0-9_-]+)$/m', $parts[1], $match)) {
        $value = $match[1];
        $padding = (4 - strlen($value) % 4) % 4;
        $decoded = base64_decode(strtr($value . str_repeat('=', $padding), '-_', '+/'), true);
        $parsed = is_string($decoded) ? json_decode($decoded, true) : null;
        $metadata = is_array($parsed) ? $parsed : [];
    }
    return [
        'description' => mb_substr(trim($parts[0]), 0, 5000),
        'metadata' => $metadata,
    ];
}

function genesisTaskNotesForGoogle(string $taskId, array $task): string
{
    $description = mb_substr(trim((string)($task['description'] ?? '')), 0, 5000);
    $project = mb_substr(trim((string)($task['project'] ?? '')), 0, 300);
    $tags = genesisStringList($task['tags'] ?? [], 10);
    $createdIn = genesisTaskOrigin($task['createdIn'] ?? null);
    $startDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($task['dueDate'] ?? '')) ? (string)$task['dueDate'] : '';
    $endDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($task['endDate'] ?? '')) ? (string)$task['endDate'] : $startDate;
    $data = [
        'taskId' => mb_substr($taskId, 0, 100),
        'createdIn' => $createdIn,
        'project' => $project,
        'projectId' => mb_substr((string)($task['projectId'] ?? ''), 0, 100),
        'categoryId' => mb_substr((string)($task['categoryId'] ?? ''), 0, 100),
        'tags' => $tags,
        'dependsOnIds' => genesisStringList($task['dependsOnIds'] ?? [], 30),
        'priority' => genesisClampInt($task['priority'] ?? 5, 1, 10, 5),
        'startDate' => $startDate,
        'endDate' => $endDate,
        'time' => preg_match('/^\d{2}:\d{2}$/', (string)($task['time'] ?? '')) ? (string)$task['time'] : '',
        'recurrenceInterval' => genesisClampInt($task['recurrenceInterval'] ?? 1, 1, 99, 1),
        'recurrenceMode' => in_array($task['recurrenceMode'] ?? '', ['none', 'genesis', 'classic', 'lunar'], true) ? (string)$task['recurrenceMode'] : 'none',
        'recurrencePattern' => in_array($task['recurrencePattern'] ?? '', ['none', 'daily', 'weekdays', 'monthly', 'yearly', 'pyata-days', 'month-days', 'lunar-days'], true) ? (string)$task['recurrencePattern'] : 'none',
        'recurrenceDays' => array_map('intval', genesisStringList($task['recurrenceDays'] ?? [], 30)),
        'recurrenceStartDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($task['recurrenceStartDate'] ?? '')) ? (string)$task['recurrenceStartDate'] : '',
        'recurrenceEndDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($task['recurrenceEndDate'] ?? '')) ? (string)$task['recurrenceEndDate'] : '',
        'recurrenceMonths' => array_map('intval', genesisStringList($task['recurrenceMonths'] ?? [], 72)),
        'recurrencePyatas' => array_map('intval', genesisStringList($task['recurrencePyatas'] ?? [], 6)),
        'recurrenceSeriesId' => mb_substr(trim((string)($task['recurrenceSeriesId'] ?? '')), 0, 100),
    ];
    $metadataLines = array_filter([
        genesisTaskOriginLabel($createdIn),
        $startDate !== '' ? 'Срок: ' . $startDate . ($endDate !== $startDate ? ' — ' . $endDate : '') : '',
        $project !== '' ? 'Проект: ' . $project : '',
        $tags ? 'Теги: ' . implode(' ', array_map(static fn(string $tag): string => '#' . $tag, $tags)) : '',
        'Приоритет: ' . $data['priority'],
        'GENESIS-DATA:' . genesisBase64Url(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)),
    ]);
    return mb_substr(trim($description . "\n\n— GENESIS —\n" . implode("\n", $metadataLines)), 0, 8192);
}

function genesisGoogleEventForClient(array $event): ?array
{
    $private = $event['extendedProperties']['private'] ?? [];
    if (($event['status'] ?? '') === 'cancelled') {
        return null;
    }
    $eventId = trim((string)($event['id'] ?? ''));
    if ($eventId === '') {
        return null;
    }
    $managedTaskId = is_array($private) ? trim((string)($private['genesisTaskId'] ?? '')) : '';
    $taskId = $managedTaskId !== ''
        ? $managedTaskId
        : 'google-event-' . substr(hash('sha256', $eventId), 0, 36);
    $createdIn = genesisTaskOrigin(
        is_array($private) ? ($private['genesisSource'] ?? null) : null,
        $managedTaskId !== '' ? 'genesis' : 'google-calendar',
    );
    $summary = (string)($event['summary'] ?? 'Без названия');
    $done = ($private['genesisDone'] ?? '') === '1' || str_starts_with($summary, '✓ ');
    $title = $done && str_starts_with($summary, '✓ ') ? mb_substr($summary, 2) : $summary;
    $timezone = genesisClientTimeZone();
    $dateTime = $event['start']['dateTime'] ?? null;
    $date = $event['start']['date'] ?? null;
    $endDateTime = $event['end']['dateTime'] ?? null;
    $exclusiveEndDate = $event['end']['date'] ?? null;
    $dueDate = date('Y-m-d');
    $endDate = $dueDate;
    $time = '';
    if (is_string($dateTime) && $dateTime !== '') {
        $start = (new DateTimeImmutable($dateTime))->setTimezone($timezone);
        $dueDate = $start->format('Y-m-d');
        $time = $start->format('H:i');
        if (is_string($endDateTime) && $endDateTime !== '') {
            $endDate = (new DateTimeImmutable($endDateTime))->setTimezone($timezone)->format('Y-m-d');
        } else {
            $endDate = $dueDate;
        }
    } elseif (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $dueDate = $date;
        if (is_string($exclusiveEndDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $exclusiveEndDate)) {
            $endDate = (new DateTimeImmutable($exclusiveEndDate . ' 12:00:00', $timezone))->modify('-1 day')->format('Y-m-d');
        } else {
            $endDate = $dueDate;
        }
    }
    if ($endDate < $dueDate) $endDate = $dueDate;
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
        'endDate' => $endDate,
        'title' => mb_substr($title, 0, 500),
        'description' => $description,
        'time' => $time,
        'project' => (string)($private['genesisProject'] ?? ''),
        'projectId' => ($private['genesisProjectId'] ?? '') !== '' ? (string)$private['genesisProjectId'] : null,
        'categoryId' => ($private['genesisCategoryId'] ?? '') !== '' ? (string)$private['genesisCategoryId'] : null,
        'tags' => genesisDecodeBase64Json((string)($private['genesisTags'] ?? '')),
        'dependsOnIds' => genesisDecodeBase64Json((string)($private['genesisDependsOn'] ?? '')),
        'priority' => genesisClampInt($private['genesisPriority'] ?? 5, 1, 10, 5),
        'done' => $done,
        'completedAt' => ($private['genesisCompletedAt'] ?? '') !== '' ? (string)$private['genesisCompletedAt'] : null,
        'reminderMinutes' => $reminder,
        'recurrence' => (string)($private['genesisRecurrence'] ?? 'none'),
        'recurrenceInterval' => genesisClampInt($private['genesisInterval'] ?? 1, 1, 99, 1),
        'recurrenceMode' => in_array($private['genesisCycleMode'] ?? '', ['none', 'genesis', 'classic', 'lunar'], true) ? (string)$private['genesisCycleMode'] : 'none',
        'recurrencePattern' => in_array($private['genesisCyclePattern'] ?? '', ['none', 'daily', 'weekdays', 'monthly', 'yearly', 'pyata-days', 'month-days', 'lunar-days'], true) ? (string)$private['genesisCyclePattern'] : 'none',
        'recurrenceDays' => genesisDecodeBase64IntJson((string)($private['genesisCycleDays'] ?? '')),
        'recurrenceStartDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($private['genesisCycleStart'] ?? '')) ? (string)$private['genesisCycleStart'] : null,
        'recurrenceEndDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($private['genesisCycleEnd'] ?? '')) ? (string)$private['genesisCycleEnd'] : null,
        'recurrenceMonths' => genesisDecodeBase64IntJson((string)($private['genesisCycleMonths'] ?? ''), 1, 72),
        'recurrencePyatas' => genesisDecodeBase64IntJson((string)($private['genesisCyclePyatas'] ?? ''), 1, 6),
        'recurrenceSeriesId' => ($private['genesisSeriesId'] ?? '') !== '' ? (string)$private['genesisSeriesId'] : null,
        'syncToGoogle' => true,
        'createdIn' => $createdIn,
        'googleEventId' => $eventId,
        'googleTaskId' => null,
        'googleTaskListId' => null,
        'googleTaskListTitle' => '',
        'googleReadOnly' => false,
        'updatedAt' => genesisClampInt($private['genesisUpdatedAt'] ?? (strtotime((string)($event['updated'] ?? 'now')) * 1000), 0, PHP_INT_MAX, (int)(microtime(true) * 1000)),
    ];
}

function genesisGoogleNativeTaskForClient(array $task, string $taskListId, string $taskListTitle): ?array
{
    if (!empty($task['deleted'])) {
        return null;
    }
    $googleTaskId = trim((string)($task['id'] ?? ''));
    $due = (string)($task['due'] ?? '');
    if ($googleTaskId === '' || !preg_match('/^(\d{4}-\d{2}-\d{2})T/', $due, $dueMatch)) {
        return null;
    }
    $notes = genesisDecodeTaskNotes((string)($task['notes'] ?? ''));
    $metadata = $notes['metadata'];
    $managedTaskId = trim((string)($metadata['taskId'] ?? ''));
    $taskId = $managedTaskId !== ''
        ? $managedTaskId
        : 'google-task-' . substr(hash('sha256', $taskListId . "\0" . $googleTaskId), 0, 36);
    $createdIn = genesisTaskOrigin($metadata['createdIn'] ?? null, $managedTaskId !== '' ? 'genesis' : 'google-tasks');
    $endDate = $dueMatch[1];
    $metadataStartDate = (string)($metadata['startDate'] ?? '');
    $dueDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', $metadataStartDate) && $metadataStartDate <= $endDate
        ? $metadataStartDate
        : $endDate;
    $time = preg_match('/^\d{2}:\d{2}$/', (string)($metadata['time'] ?? '')) ? (string)$metadata['time'] : '';
    $sacred = genesisSacredFromDate($dueDate);
    $done = ($task['status'] ?? '') === 'completed';
    $updatedAt = strtotime((string)($task['updated'] ?? ''));
    $completedAt = trim((string)($task['completed'] ?? ''));
    return [
        'id' => $taskId,
        'sacredYear' => $sacred['sacredYear'],
        'monthIndex' => $sacred['monthIndex'],
        'day' => $sacred['day'],
        'dueDate' => $dueDate,
        'endDate' => $endDate,
        'title' => mb_substr(trim((string)($task['title'] ?? '')) ?: 'Без названия', 0, 500),
        'description' => $notes['description'],
        'time' => $time,
        'project' => mb_substr(trim((string)($metadata['project'] ?? '')), 0, 300),
        'projectId' => ($metadata['projectId'] ?? '') !== '' ? mb_substr((string)$metadata['projectId'], 0, 100) : null,
        'categoryId' => ($metadata['categoryId'] ?? '') !== '' ? mb_substr((string)$metadata['categoryId'], 0, 100) : null,
        'tags' => genesisStringList($metadata['tags'] ?? [], 10),
        'dependsOnIds' => genesisStringList($metadata['dependsOnIds'] ?? [], 30),
        'priority' => genesisClampInt($metadata['priority'] ?? 5, 1, 10, 5),
        'done' => $done,
        'completedAt' => $completedAt !== '' ? $completedAt : null,
        'reminderMinutes' => null,
        'recurrence' => 'none',
        'recurrenceInterval' => genesisClampInt($metadata['recurrenceInterval'] ?? 1, 1, 99, 1),
        'recurrenceMode' => in_array($metadata['recurrenceMode'] ?? '', ['none', 'genesis', 'classic', 'lunar'], true) ? (string)$metadata['recurrenceMode'] : 'none',
        'recurrencePattern' => in_array($metadata['recurrencePattern'] ?? '', ['none', 'daily', 'weekdays', 'monthly', 'yearly', 'pyata-days', 'month-days', 'lunar-days'], true) ? (string)$metadata['recurrencePattern'] : 'none',
        'recurrenceDays' => array_values(array_filter(array_map('intval', is_array($metadata['recurrenceDays'] ?? null) ? $metadata['recurrenceDays'] : []), static fn(int $day): bool => $day >= 1 && $day <= 30)),
        'recurrenceStartDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($metadata['recurrenceStartDate'] ?? '')) ? (string)$metadata['recurrenceStartDate'] : null,
        'recurrenceEndDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($metadata['recurrenceEndDate'] ?? '')) ? (string)$metadata['recurrenceEndDate'] : null,
        'recurrenceMonths' => array_values(array_filter(array_map('intval', is_array($metadata['recurrenceMonths'] ?? null) ? $metadata['recurrenceMonths'] : []), static fn(int $month): bool => $month >= 1 && $month <= 72)),
        'recurrencePyatas' => array_values(array_filter(array_map('intval', is_array($metadata['recurrencePyatas'] ?? null) ? $metadata['recurrencePyatas'] : []), static fn(int $pyata): bool => $pyata >= 1 && $pyata <= 6)),
        'recurrenceSeriesId' => ($metadata['recurrenceSeriesId'] ?? '') !== '' ? mb_substr((string)$metadata['recurrenceSeriesId'], 0, 100) : null,
        'syncToGoogle' => true,
        'createdIn' => $createdIn,
        'googleEventId' => null,
        'googleTaskId' => $googleTaskId,
        'googleTaskListId' => $taskListId,
        'googleTaskListTitle' => mb_substr($taskListTitle, 0, 300),
        'googleReadOnly' => false,
        'updatedAt' => $updatedAt !== false ? $updatedAt * 1000 : (int)(microtime(true) * 1000),
    ];
}

function genesisDefaultGoogleTaskListId(array $user): string
{
    try {
        $taskList = genesisGoogleTasksApi('GET', '/users/@me/lists/@default', $user);
        return trim((string)($taskList['id'] ?? ''));
    } catch (RuntimeException) {
        return '';
    }
}

function genesisListGoogleTaskLists(array $user): array
{
    if (!genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        return [];
    }
    $taskLists = [];
    $defaultTaskListId = genesisDefaultGoogleTaskListId($user);
    $pageToken = null;
    do {
        $query = ['maxResults' => 100];
        if (is_string($pageToken) && $pageToken !== '') {
            $query['pageToken'] = $pageToken;
        }
        $result = genesisGoogleTasksApi('GET', '/users/@me/lists?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986), $user);
        foreach ($result['items'] ?? [] as $taskList) {
            if (is_array($taskList) && !empty($taskList['id'])) {
                $taskLists[] = [
                    'id' => (string)$taskList['id'],
                    'title' => mb_substr(trim((string)($taskList['title'] ?? 'Google Tasks')) ?: 'Google Tasks', 0, 300),
                    'updatedAt' => !empty($taskList['updated']) ? (string)$taskList['updated'] : null,
                    'isDefault' => $defaultTaskListId !== '' && hash_equals($defaultTaskListId, (string)$taskList['id']),
                ];
            }
            if (count($taskLists) >= 100) {
                break 2;
            }
        }
        $pageToken = $result['nextPageToken'] ?? null;
    } while (is_string($pageToken) && $pageToken !== '');

    return $taskLists;
}

function genesisGoogleTaskListsForClient(): array
{
    $taskLists = $GLOBALS['GENESIS_GOOGLE_TASK_LISTS'] ?? [];
    return is_array($taskLists) ? $taskLists : [];
}

function genesisListGoogleNativeTasks(array $user, array $taskLists): array
{
    if (!genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        return [];
    }

    $tasks = [];
    foreach ($taskLists as $taskList) {
        $taskListId = (string)$taskList['id'];
        $taskListTitle = trim((string)($taskList['title'] ?? 'Google Tasks')) ?: 'Google Tasks';
        $pageToken = null;
        do {
            $query = [
                'maxResults' => 100,
                'showCompleted' => 'true',
                'showDeleted' => 'false',
                'showHidden' => 'true',
                'showAssigned' => 'true',
            ];
            if (is_string($pageToken) && $pageToken !== '') {
                $query['pageToken'] = $pageToken;
            }
            $result = genesisGoogleTasksApi('GET', '/lists/' . rawurlencode($taskListId) . '/tasks?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986), $user);
            foreach ($result['items'] ?? [] as $task) {
                if (!is_array($task)) {
                    continue;
                }
                $clientTask = genesisGoogleNativeTaskForClient($task, $taskListId, $taskListTitle);
                if ($clientTask !== null) {
                    $tasks[] = $clientTask;
                }
                if (count($tasks) >= 5000) {
                    break 3;
                }
            }
            $pageToken = $result['nextPageToken'] ?? null;
        } while (is_string($pageToken) && $pageToken !== '');
    }
    return $tasks;
}

function genesisGoogleTasksSyncWarning(): ?string
{
    $warning = $GLOBALS['GENESIS_GOOGLE_TASKS_WARNING'] ?? null;
    return is_string($warning) && $warning !== '' ? $warning : null;
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

function genesisGoogleNativeTaskPayload(string $taskId, array $task): array
{
    $title = mb_substr(trim((string)($task['title'] ?? '')), 0, 500);
    if ($title === '') {
        throw new InvalidArgumentException('Название задачи обязательно.');
    }
    $dueDate = (string)($task['dueDate'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        throw new InvalidArgumentException('Дата задачи указана неверно.');
    }
    $endDate = (string)($task['endDate'] ?? $dueDate);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate) || $endDate < $dueDate) {
        throw new InvalidArgumentException('Срок выполнения задачи указан неверно.');
    }
    $done = !empty($task['done']);
    $payload = [
        'title' => $title,
        'notes' => genesisTaskNotesForGoogle($taskId, $task),
        'status' => $done ? 'completed' : 'needsAction',
        'due' => $endDate . 'T00:00:00.000Z',
    ];
    if ($done) {
        $completed = trim((string)($task['completedAt'] ?? ''));
        $payload['completed'] = $completed !== '' ? $completed : gmdate('c');
    }
    return $payload;
}

function genesisSyncNativeGoogleTask(array $user, string $userId, array $task): array
{
    if (!genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        throw new RuntimeException('Обновите доступ Google, чтобы синхронизировать списки Google Tasks.');
    }
    $taskId = trim((string)($task['googleTaskId'] ?? ''));
    $taskListId = trim((string)($task['googleTaskListId'] ?? ''));
    if ($taskId === '' || $taskListId === '') {
        throw new InvalidArgumentException('Google Task identifier is required.');
    }
    $saved = genesisGoogleTasksApi(
        'PATCH',
        '/lists/' . rawurlencode($taskListId) . '/tasks/' . rawurlencode($taskId),
        $user,
        genesisGoogleNativeTaskPayload((string)($task['id'] ?? ''), $task),
    );
    $listTitle = trim((string)($task['googleTaskListTitle'] ?? 'Google Tasks')) ?: 'Google Tasks';
    $clientTask = genesisGoogleNativeTaskForClient($saved, $taskListId, $listTitle);
    if ($clientTask === null) {
        throw new RuntimeException('Google Tasks did not return the saved task.');
    }
    genesisTouchUser($userId);
    return $clientTask;
}

function genesisCreateNativeGoogleTask(array $user, string $userId, string $taskId, array $task): array
{
    if (!genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        throw new RuntimeException('Обновите доступ Google, чтобы синхронизировать списки Google Tasks.');
    }
    $taskListId = trim((string)($task['googleTaskListId'] ?? ''));
    if ($taskListId === '') {
        throw new InvalidArgumentException('Выберите список Google Tasks.');
    }
    $saved = genesisGoogleTasksApi(
        'POST',
        '/lists/' . rawurlencode($taskListId) . '/tasks',
        $user,
        genesisGoogleNativeTaskPayload($taskId, $task),
    );
    $listTitle = trim((string)($task['googleTaskListTitle'] ?? 'Google Tasks')) ?: 'Google Tasks';
    $clientTask = genesisGoogleNativeTaskForClient($saved, $taskListId, $listTitle);
    if ($clientTask === null) {
        throw new RuntimeException('Google Tasks did not return the created task.');
    }
    genesisTouchUser($userId);
    return $clientTask;
}

function genesisCreateGoogleTaskList(string $userId, string $title): array
{
    $cleanTitle = mb_substr(trim($title), 0, 300);
    if ($cleanTitle === '') {
        throw new InvalidArgumentException('Название списка обязательно.');
    }
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc']) || !genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        throw new RuntimeException('Обновите доступ Google, чтобы создавать списки Google Tasks.');
    }
    $saved = genesisGoogleTasksApi('POST', '/users/@me/lists', $user, ['title' => $cleanTitle]);
    if (empty($saved['id'])) {
        throw new RuntimeException('Google Tasks did not return the created list.');
    }
    genesisTouchUser($userId);
    return [
        'id' => (string)$saved['id'],
        'title' => mb_substr(trim((string)($saved['title'] ?? $cleanTitle)), 0, 300),
        'updatedAt' => !empty($saved['updated']) ? (string)$saved['updated'] : null,
        'isDefault' => false,
    ];
}

function genesisUpdateGoogleTaskList(string $userId, string $taskListId, string $title): array
{
    $cleanTaskListId = trim($taskListId);
    $cleanTitle = mb_substr(trim($title), 0, 300);
    if ($cleanTaskListId === '') {
        throw new InvalidArgumentException('Идентификатор списка обязателен.');
    }
    if ($cleanTitle === '') {
        throw new InvalidArgumentException('Название списка обязательно.');
    }
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc']) || !genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        throw new RuntimeException('Обновите доступ Google, чтобы переименовывать списки Google Tasks.');
    }
    $saved = genesisGoogleTasksApi(
        'PATCH',
        '/users/@me/lists/' . rawurlencode($cleanTaskListId),
        $user,
        ['title' => $cleanTitle],
    );
    if (empty($saved['id'])) {
        throw new RuntimeException('Google Tasks did not return the updated list.');
    }
    $defaultTaskListId = genesisDefaultGoogleTaskListId($user);
    genesisTouchUser($userId);
    return [
        'id' => (string)$saved['id'],
        'title' => mb_substr(trim((string)($saved['title'] ?? $cleanTitle)), 0, 300),
        'updatedAt' => !empty($saved['updated']) ? (string)$saved['updated'] : null,
        'isDefault' => $defaultTaskListId !== '' && hash_equals($defaultTaskListId, (string)$saved['id']),
    ];
}

function genesisDeleteGoogleTaskList(string $userId, string $taskListId): void
{
    $cleanTaskListId = trim($taskListId);
    if ($cleanTaskListId === '') {
        throw new InvalidArgumentException('Идентификатор списка обязателен.');
    }
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc']) || !genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        throw new RuntimeException('Обновите доступ Google, чтобы удалять списки Google Tasks.');
    }
    $defaultTaskListId = genesisDefaultGoogleTaskListId($user);
    if ($defaultTaskListId !== '' && hash_equals($defaultTaskListId, $cleanTaskListId)) {
        throw new DomainException('Основной список Google Tasks нельзя удалить. Пустой основной список автоматически скрывается в GENESIS.');
    }
    try {
        genesisGoogleTasksApi(
            'DELETE',
            '/users/@me/lists/' . rawurlencode($cleanTaskListId),
            $user,
        );
    } catch (RuntimeException $error) {
        if (!str_contains($error->getMessage(), '(404)') && !str_contains($error->getMessage(), '(410)')) {
            throw $error;
        }
    }
    genesisTouchUser($userId);
}

function genesisSyncTaskToGoogle(string $userId, string $taskId, array $task): array
{
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc'])) {
        throw new RuntimeException('Google Calendar не подключён.');
    }
    if (!empty($task['googleTaskListId'])) {
        return !empty($task['googleTaskId'])
            ? genesisSyncNativeGoogleTask($user, $userId, $task)
            : genesisCreateNativeGoogleTask($user, $userId, $taskId, $task);
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

function genesisDeleteGoogleTaskEvent(string $userId, string $taskId, array $task = []): void
{
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc'])) {
        return;
    }
    $googleTaskId = trim((string)($task['googleTaskId'] ?? ''));
    $googleTaskListId = trim((string)($task['googleTaskListId'] ?? ''));
    if ($googleTaskId !== '' && $googleTaskListId !== '') {
        try {
            genesisGoogleTasksApi(
                'DELETE',
                '/lists/' . rawurlencode($googleTaskListId) . '/tasks/' . rawurlencode($googleTaskId),
                $user,
            );
        } catch (RuntimeException $error) {
            if (!str_contains($error->getMessage(), '(404)') && !str_contains($error->getMessage(), '(410)')) {
                throw $error;
            }
        }
        genesisTouchUser($userId);
        return;
    }
    if (empty($user['google_calendar_id'])) {
        return;
    }
    $eventId = trim((string)($task['googleEventId'] ?? ''));
    if ($eventId === '') {
        $event = genesisFindGoogleEvent($user, $taskId);
        $eventId = is_array($event) ? trim((string)($event['id'] ?? '')) : '';
    }
    if ($eventId === '') {
        return;
    }
    try {
        genesisGoogleApi('DELETE', '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events/' . rawurlencode($eventId), $user);
    } catch (RuntimeException $error) {
        if (!str_contains($error->getMessage(), '(404)') && !str_contains($error->getMessage(), '(410)')) {
            throw $error;
        }
    }
    genesisTouchUser($userId);
}

function genesisListGoogleTasks(array $user): array
{
    $GLOBALS['GENESIS_GOOGLE_TASKS_WARNING'] = null;
    $GLOBALS['GENESIS_GOOGLE_TASK_LISTS'] = [];
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
    if (genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
        try {
            $taskLists = genesisListGoogleTaskLists($user);
            $GLOBALS['GENESIS_GOOGLE_TASK_LISTS'] = $taskLists;
            $tasks = array_merge($tasks, genesisListGoogleNativeTasks($user, $taskLists));
        } catch (Throwable $tasksError) {
            $GLOBALS['GENESIS_GOOGLE_TASKS_WARNING'] = 'Импорт Google Tasks временно недоступен. Повторите попытку позже.';
            genesisLogError('[GoogleTasks] ' . $tasksError->getMessage(), $tasksError);
        }
    }
    usort($tasks, static fn(array $left, array $right): int => [
        (string)($left['dueDate'] ?? ''),
        (string)($left['time'] ?? ''),
        (string)($left['title'] ?? ''),
    ] <=> [
        (string)($right['dueDate'] ?? ''),
        (string)($right['time'] ?? ''),
        (string)($right['title'] ?? ''),
    ]);
    genesisDb()->prepare('UPDATE users SET last_calendar_sync_at = :synced_at, last_seen_at = :synced_at WHERE id = :id')->execute([
        'synced_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
    return $tasks;
}
