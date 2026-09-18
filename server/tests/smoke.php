<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/google.php';
require dirname(__DIR__) . '/src/gemini.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = genesisDb();
$db->beginTransaction();
try {
    $userId = 'test-private-workspace';
    $now = genesisNow();
    $db->prepare('INSERT OR REPLACE INTO users (id, google_sub, email, display_name, workspace_key_enc, created_at, updated_at) VALUES (:id, :sub, :email, :name, :workspace_key, :created_at, :updated_at)')->execute([
        'id' => $userId,
        'sub' => 'test-private-workspace-sub',
        'email' => 'genesis.smoke.test@gmail.com',
        'name' => 'Smoke Test',
        'workspace_key' => genesisEncrypt(base64_encode(random_bytes(32))),
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    $user = genesisFindUser($userId);
    expect(is_array($user), 'Test user was not created.');
    $user = genesisUpdateAccountPreferences($userId, ['calendarMode' => 'sacred', 'taskCalendarMode' => 'lunar', 'timeFormat' => '12h', 'language' => 'en']);
    expect(($user['calendar_mode'] ?? '') === 'sacred', 'Calendar preference was not stored.');
    expect((genesisUserForClient($user)['calendarMode'] ?? '') === 'sacred', 'Calendar preference was not exposed to the client.');
    expect(($user['task_calendar_mode'] ?? '') === 'lunar', 'Task calendar preference was not stored.');
    expect((genesisUserForClient($user)['taskCalendarMode'] ?? '') === 'lunar', 'Task calendar preference was not exposed to the client.');
    expect(($user['time_format'] ?? '') === '12h', 'Time format preference was not stored.');
    expect((genesisUserForClient($user)['timeFormat'] ?? '') === '12h', 'Time format preference was not exposed to the client.');
    expect(($user['language'] ?? '') === 'en', 'Language preference was not stored.');
    expect((genesisUserForClient($user)['language'] ?? '') === 'en', 'Language preference was not exposed to the client.');
    expect(genesisMultiAccountEnabled($user), 'Multi-account must be available to every authenticated user.');
    expect((genesisUserForClient($user)['multiAccountEnabled'] ?? false) === true, 'Multi-account availability was not exposed to a regular user.');
    $user = genesisUpdateAccountPreferences($userId, [
        'syncRouting' => [
            'mode' => 'choose',
            'defaultAccountIds' => [$userId],
            'categoryAccountIds' => [],
        ],
    ]);
    expect(($user['sync_routing_mode'] ?? '') === 'choose', 'A regular user could not save multi-account routing.');
    $workspace = genesisWorkspaceForClient($user);
    expect(is_string($workspace['key']) && strlen(base64_decode($workspace['key'], true)) === 32, 'Workspace key is invalid.');
    expect(($workspace['keyMode'] ?? '') === 'legacy', 'Legacy key migration mode was not exposed.');

    $saved = genesisSaveWorkspaceEnvelope($userId, [
        'ciphertext' => base64_encode(random_bytes(64)),
        'iv' => base64_encode(random_bytes(12)),
        'version' => 2,
    ]);
    expect($saved['version'] === 2, 'Encrypted envelope was not stored.');

    $wrappedKey = base64_encode(random_bytes(48));
    $wrappedIv = base64_encode(random_bytes(12));
    genesisSaveClientWorkspaceKey($userId, ['wrappedKey' => $wrappedKey, 'iv' => $wrappedIv]);
    $clientWorkspace = genesisWorkspaceForClient(genesisFindUser($userId) ?: []);
    expect(($clientWorkspace['keyMode'] ?? '') === 'client', 'Client-managed workspace key mode was not stored.');
    expect(($clientWorkspace['key'] ?? null) === null, 'The server exposed a client-managed plaintext key.');
    expect(($clientWorkspace['wrappedKey'] ?? '') === $wrappedKey, 'The wrapped recovery key was not returned intact.');
    $clientKeyRow = $db->prepare('SELECT workspace_key_enc FROM users WHERE id = :id');
    $clientKeyRow->execute(['id' => $userId]);
    expect($clientKeyRow->fetchColumn() === null, 'The server retained a decryptable workspace key after migration.');

    genesisSaveMetrics($userId, [
        'projectCount' => 4,
        'taskCount' => 9,
        'openTaskCount' => 5,
        'completedTaskCount' => 4,
        'googleSyncedCount' => 9,
    ]);
    $metrics = $db->prepare('SELECT * FROM user_metrics WHERE user_id = :user_id');
    $metrics->execute(['user_id' => $userId]);
    $row = $metrics->fetch();
    expect(is_array($row) && (int)$row['task_count'] === 9 && (int)$row['project_count'] === 4, 'Aggregate metrics were not stored.');
    expect((int)$db->query('SELECT COUNT(*) FROM tasks')->fetchColumn() === 0, 'Task content must not be stored in SQLite.');

    $assistantPlan = genesisNormalizeGeminiPlan([
        'request' => 'Create a launch project and one task.',
        'summary' => 'Draft ready.',
        'projects' => [[
            'title' => 'Launch',
            'description' => 'Prepare the release.',
            'parentProject' => '',
            'category' => 'Work',
            'tags' => ['release', 'release'],
        ]],
        'taskLists' => [],
        'tasks' => [[
            'title' => 'please create a task Prepare brief',
            'description' => '',
            'startDate' => '2026-09-11',
            'dueDate' => '2026-09-12',
            'time' => '09:30',
            'project' => 'Launch',
            'taskList' => '',
            'tags' => ['brief'],
            'priority' => 99,
            'reminderMinutes' => -10,
        ]],
    ]);
    expect(count($assistantPlan['projects']) === 1 && count($assistantPlan['tasks']) === 1, 'Gemini plan normalization lost valid actions.');
    expect($assistantPlan['tasks'][0]['title'] === 'Prepare brief', 'Assistant command words leaked into the task title.');
    expect($assistantPlan['tasks'][0]['priority'] === 10, 'Gemini task priority was not clamped.');
    expect($assistantPlan['tasks'][0]['reminderMinutes'] === 0, 'Gemini reminder was not clamped.');
    expect($assistantPlan['projects'][0]['tags'] === ['release'], 'Gemini plan tags were not normalized.');
    $gigaChatAudio = genesisGigaChatAudioFile([
        'mimeType' => 'audio/webm;codecs=opus',
        'data' => base64_encode('test-audio'),
    ]);
    expect($gigaChatAudio['mimeType'] === 'audio/webm' && $gigaChatAudio['extension'] === 'weba', 'GigaChat audio format was not normalized.');
    expect(strlen($gigaChatAudio['bytes']) === 10, 'GigaChat audio payload was not decoded.');
    expect(preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', genesisGigaChatUuid()) === 1, 'GigaChat request UUID is invalid.');
    expect((genesisGeminiPlanSchema()['additionalProperties'] ?? true) === false, 'Assistant JSON schema must reject unexpected properties.');

    $reminders = genesisNormalizeTaskReminders([
        ['kind' => 'relative', 'minutes' => 30],
        ['kind' => 'relative', 'minutes' => 30],
        ['kind' => 'absolute', 'at' => '2026-10-28T06:00:00+00:00'],
    ]);
    expect(count($reminders) === 2, 'Duplicate reminders were not removed.');
    $overrides = genesisTaskReminderOverrides(
        $reminders,
        new DateTimeImmutable('2026-10-28 10:00:00', new DateTimeZone('Europe/Moscow')),
    );
    expect($overrides === [
        ['method' => 'popup', 'minutes' => 30],
        ['method' => 'popup', 'minutes' => 60],
    ], 'Relative and absolute reminders were not converted for Google Calendar.');
    expect(genesisNormalizeTaskReminders([], 10) === [['kind' => 'relative', 'minutes' => 10]], 'Legacy reminders were not migrated.');

    $calendarRecurrence = genesisGoogleRecurrenceLines([
        'recurrenceMode' => 'genesis',
        'recurrenceSeriesId' => null,
        'recurrenceDates' => ['2026-10-01', '2026-10-06', '2026-10-11'],
    ], '2026-10-01', '09:00', 'Europe/Moscow');
    expect($calendarRecurrence === [
        'RDATE;TZID=Europe/Moscow:20261006T090000,20261011T090000',
    ], 'A Calendar recurrence must be represented by one native RDATE series.');
    expect(genesisGoogleRecurrenceLines([
        'recurrenceMode' => 'genesis',
        'recurrenceSeriesId' => 'expanded-for-google-tasks',
        'recurrenceDates' => ['2026-10-01', '2026-10-06'],
    ], '2026-10-01', '', 'Europe/Moscow') === [], 'Expanded task series must not become nested Calendar recurrences.');

    $db->rollBack();
    echo json_encode(['ok' => true, 'privacyModel' => 2, 'workspaceEncrypted' => true, 'taskRows' => 0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    throw $error;
}
