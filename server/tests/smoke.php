<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';

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
    $user = genesisUpdateAccountPreferences($userId, ['calendarMode' => 'lunar', 'language' => 'en']);
    expect(($user['calendar_mode'] ?? '') === 'lunar', 'Calendar preference was not stored.');
    expect((genesisUserForClient($user)['calendarMode'] ?? '') === 'lunar', 'Calendar preference was not exposed to the client.');
    expect(($user['language'] ?? '') === 'en', 'Language preference was not stored.');
    expect((genesisUserForClient($user)['language'] ?? '') === 'en', 'Language preference was not exposed to the client.');
    $workspace = genesisWorkspaceForClient($user);
    expect(is_string($workspace['key']) && strlen(base64_decode($workspace['key'], true)) === 32, 'Workspace key is invalid.');

    $saved = genesisSaveWorkspaceEnvelope($userId, [
        'ciphertext' => base64_encode(random_bytes(64)),
        'iv' => base64_encode(random_bytes(12)),
        'version' => 2,
    ]);
    expect($saved['version'] === 2, 'Encrypted envelope was not stored.');

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

    $db->rollBack();
    echo json_encode(['ok' => true, 'privacyModel' => 2, 'workspaceEncrypted' => true, 'taskRows' => 0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    throw $error;
}
