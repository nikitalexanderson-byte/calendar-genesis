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
        CURLOPT_USERAGENT => 'GENESIS-Calendar/1.0',
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
        'description' => 'Задачи и напоминания сакрального календаря GENESIS',
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

function genesisGoogleEventPayload(array $task): array
{
    $timezoneName = (string)(genesisConfig()['timezone'] ?? 'Europe/Moscow');
    $timezone = new DateTimeZone($timezoneName);
    $summary = (!empty($task['done']) ? '✓ ' : '') . (string)$task['title'];
    $description = trim(implode("\n", array_filter([
        (string)($task['description'] ?? ''),
        !empty($task['project_label']) ? 'Проект: ' . $task['project_label'] : '',
        !empty($task['tags_json']) ? implode(' ', array_map(static fn(string $tag): string => '#' . $tag, genesisDecodeList($task['tags_json']))) : '',
        'Создано в GENESIS',
    ])));
    $event = [
        'summary' => $summary,
        'description' => $description,
        'extendedProperties' => [
            'private' => ['genesisTaskId' => (string)$task['id']],
        ],
        'reminders' => $task['reminder_minutes'] !== null
            ? ['useDefault' => false, 'overrides' => [['method' => 'popup', 'minutes' => (int)$task['reminder_minutes']]]]
            : ['useDefault' => true],
    ];
    if (!empty($task['time_value'])) {
        $start = new DateTimeImmutable((string)$task['due_date'] . ' ' . (string)$task['time_value'], $timezone);
        $event['start'] = ['dateTime' => $start->format(DATE_RFC3339), 'timeZone' => $timezoneName];
        $event['end'] = ['dateTime' => $start->modify('+1 hour')->format(DATE_RFC3339), 'timeZone' => $timezoneName];
    } else {
        $date = new DateTimeImmutable((string)$task['due_date'] . ' 12:00:00', $timezone);
        $event['start'] = ['date' => $date->format('Y-m-d')];
        $event['end'] = ['date' => $date->modify('+1 day')->format('Y-m-d')];
    }
    return $event;
}

function genesisSyncTaskToGoogle(string $userId, string $taskId): void
{
    $db = genesisDb();
    $taskStatement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id');
    $taskStatement->execute(['id' => $taskId, 'user_id' => $userId]);
    $task = $taskStatement->fetch();
    if (!is_array($task) || empty($task['sync_to_google'])) {
        return;
    }
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['refresh_token_enc'])) {
        return;
    }
    $user = genesisEnsureGoogleCalendar($user);
    $calendarId = rawurlencode((string)$user['google_calendar_id']);
    $event = genesisGoogleEventPayload($task);
    if (!empty($task['google_event_id'])) {
        genesisGoogleApi('PUT', '/calendars/' . $calendarId . '/events/' . rawurlencode((string)$task['google_event_id']), $user, $event);
        return;
    }
    $created = genesisGoogleApi('POST', '/calendars/' . $calendarId . '/events', $user, $event);
    if (!empty($created['id'])) {
        $db->prepare('UPDATE tasks SET google_event_id = :event_id, updated_at = :updated_at WHERE id = :id AND user_id = :user_id')->execute([
            'event_id' => (string)$created['id'],
            'updated_at' => genesisNow(),
            'id' => $taskId,
            'user_id' => $userId,
        ]);
    }
}

function genesisDeleteGoogleTaskEvent(string $userId, array $task): void
{
    if (empty($task['google_event_id'])) {
        return;
    }
    $user = genesisFindUser($userId);
    if ($user === null || empty($user['google_calendar_id']) || empty($user['refresh_token_enc'])) {
        return;
    }
    try {
        genesisGoogleApi('DELETE', '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events/' . rawurlencode((string)$task['google_event_id']), $user);
    } catch (RuntimeException $error) {
        if (!str_contains($error->getMessage(), '(404)') && !str_contains($error->getMessage(), '(410)')) {
            throw $error;
        }
    }
}

function genesisPullGoogleChanges(array $user): void
{
    if (empty($user['google_calendar_id']) || empty($user['refresh_token_enc'])) {
        return;
    }
    $updatedMin = $user['last_calendar_sync_at'] ?: gmdate('c', time() - 86400 * 30);
    $path = '/calendars/' . rawurlencode((string)$user['google_calendar_id']) . '/events?' . http_build_query([
        'singleEvents' => 'true',
        'showDeleted' => 'true',
        'updatedMin' => $updatedMin,
        'maxResults' => 250,
    ], '', '&', PHP_QUERY_RFC3986);
    $result = genesisGoogleApi('GET', $path, $user);
    $db = genesisDb();
    foreach ($result['items'] ?? [] as $event) {
        if (!is_array($event)) {
            continue;
        }
        $taskId = $event['extendedProperties']['private']['genesisTaskId'] ?? null;
        if (!is_string($taskId) || $taskId === '') {
            continue;
        }
        if (($event['status'] ?? '') === 'cancelled') {
            $db->prepare('UPDATE tasks SET sync_to_google = 0, google_event_id = NULL, updated_at = :updated_at WHERE id = :id AND user_id = :user_id')->execute(['updated_at' => genesisNow(), 'id' => $taskId, 'user_id' => (string)$user['id']]);
            continue;
        }
        $taskStatement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id LIMIT 1');
        $taskStatement->execute(['id' => $taskId, 'user_id' => (string)$user['id']]);
        $existingTask = $taskStatement->fetch();
        if (!is_array($existingTask)) {
            continue;
        }
        $summary = (string)($event['summary'] ?? '');
        $done = str_starts_with($summary, '✓ ');
        $title = $done ? mb_substr($summary, 2) : $summary;
        $timezone = new DateTimeZone((string)(genesisConfig()['timezone'] ?? 'Europe/Moscow'));
        $dateTimeValue = $event['start']['dateTime'] ?? null;
        $dateValue = $event['start']['date'] ?? null;
        $dueDate = (string)$existingTask['due_date'];
        $timeValue = (string)$existingTask['time_value'];
        if (is_string($dateTimeValue) && $dateTimeValue !== '') {
            $start = (new DateTimeImmutable($dateTimeValue))->setTimezone($timezone);
            $dueDate = $start->format('Y-m-d');
            $timeValue = $start->format('H:i');
        } elseif (is_string($dateValue) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateValue)) {
            $dueDate = $dateValue;
            $timeValue = '';
        }
        $sacred = genesisSacredFromDate($dueDate);
        $reminderMinutes = $existingTask['reminder_minutes'];
        if (($event['reminders']['useDefault'] ?? true) === false) {
            foreach ($event['reminders']['overrides'] ?? [] as $reminder) {
                if (is_array($reminder) && isset($reminder['minutes'])) {
                    $reminderMinutes = genesisClampInt($reminder['minutes'], 0, 40320, 30);
                    break;
                }
            }
        }
        $db->prepare('UPDATE tasks SET title = :title, due_date = :due_date, time_value = :time_value, sacred_year = :sacred_year, month_index = :month_index, sacred_day = :sacred_day, reminder_minutes = :reminder_minutes, done = :done, completed_at = :completed_at, updated_at = :updated_at WHERE id = :id AND user_id = :user_id')->execute([
            'title' => mb_substr($title, 0, 500),
            'due_date' => $dueDate,
            'time_value' => $timeValue,
            'sacred_year' => $sacred['sacredYear'],
            'month_index' => $sacred['monthIndex'],
            'sacred_day' => $sacred['day'],
            'reminder_minutes' => $reminderMinutes,
            'done' => $done ? 1 : 0,
            'completed_at' => $done ? genesisNow() : null,
            'updated_at' => genesisNow(),
            'id' => $taskId,
            'user_id' => (string)$user['id'],
        ]);
        if (empty($existingTask['done']) && $done && (string)$existingTask['recurrence'] !== 'none') {
            $updatedStatement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id');
            $updatedStatement->execute(['id' => $taskId, 'user_id' => (string)$user['id']]);
            $updatedTask = $updatedStatement->fetch();
            if (is_array($updatedTask)) {
                $next = genesisSpawnNextOccurrence((string)$user['id'], $updatedTask);
                if (is_array($next)) {
                    genesisSyncTaskToGoogle((string)$user['id'], (string)$next['id']);
                }
            }
        }
    }
    genesisDb()->prepare('UPDATE users SET last_calendar_sync_at = :synced_at, updated_at = :updated_at WHERE id = :id')->execute([
        'synced_at' => gmdate('c', time() - 60),
        'updated_at' => genesisNow(),
        'id' => (string)$user['id'],
    ]);
}
