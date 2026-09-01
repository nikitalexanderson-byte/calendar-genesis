<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/google.php';

$inactiveBefore = gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * 365 * 2);
$statement = genesisDb()->prepare('DELETE FROM user_metrics WHERE user_id IN (SELECT id FROM users WHERE last_seen_at IS NOT NULL AND last_seen_at < :inactive_before)');
$statement->execute(['inactive_before' => $inactiveBefore]);

echo json_encode([
    'ok' => true,
    'prunedMetrics' => $statement->rowCount(),
    'time' => genesisNow(),
], JSON_UNESCAPED_SLASHES) . PHP_EOL;
