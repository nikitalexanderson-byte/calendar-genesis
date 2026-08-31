<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/google.php';

$users = genesisDb()->query("SELECT * FROM users WHERE google_calendar_id IS NOT NULL AND refresh_token_enc IS NOT NULL")->fetchAll();
$success = 0;
$failed = 0;
foreach ($users as $user) {
    try {
        genesisPullGoogleChanges($user);
        $success++;
    } catch (Throwable $error) {
        $failed++;
        error_log('[GENESIS cron] ' . $error->getMessage());
    }
}

echo json_encode(['ok' => $success, 'failed' => $failed, 'time' => genesisNow()], JSON_UNESCAPED_SLASHES) . PHP_EOL;
