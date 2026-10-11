<?php
declare(strict_types=1);
// Included in security-lifecycle.php; all limits and data belong to the synthetic SQLite only.
foreach ([null, 32] as $declared) {
    $stream = fopen('php://temp', 'w+');
    fwrite($stream, str_repeat('x', 32)); rewind($stream);
    sharedExpect(strlen(genesisBoundedBody($stream, 32, $declared)) === 32, 'Exact body limit was rejected.');
    fclose($stream);
    $stream = fopen('php://temp', 'w+');
    fwrite($stream, str_repeat('x', 33)); rewind($stream);
    try { genesisBoundedBody($stream, 32, $declared); throw new RuntimeException('Oversized body was accepted.'); }
    catch (GenesisResourceLimitException $error) { sharedExpect($error->status === 413, 'Wrong body error.'); }
    fclose($stream);
}
sharedExpect(genesisJsonBodyLimit('workspace') > 10_000_000, 'Workspace envelope cap lost metadata overhead.');
sharedExpect(genesisJsonBodyLimit('shared/projects/test/tasks/test') > 18 * 1024 * 1024, 'Task attachments/image cap is too small.');
sharedExpect(genesisJsonBodyLimit('shared/spaces/test/import-project') > 10 * 1024 * 1024, 'Project import uses the small default cap.');
$subject = 'synthetic-budget-' . genesisUuid();
genesisConsumeApiBudget($subject, 'test', 2, 8, 4, 1200);
genesisConsumeApiBudget($subject, 'test', 2, 8, 4, 1201);
try { genesisConsumeApiBudget($subject, 'test', 2, 8, 0, 1202); throw new RuntimeException('Rate count cap was bypassed.'); }
catch (GenesisResourceLimitException $error) { sharedExpect($error->status === 429, 'Wrong rate error.'); }
genesisConsumeApiBudget($subject, 'test', 2, 8, 4, 1800); // Window resets.
try { genesisConsumeApiBudget($subject, 'test', 2, 8, 5, 1801); throw new RuntimeException('Rate byte cap was bypassed.'); }
catch (GenesisResourceLimitException $error) { sharedExpect($error->status === 429, 'Wrong byte error.'); }

$limits = $db->query('SELECT name, amount FROM resource_quota_limits')->fetchAll(PDO::FETCH_KEY_PAIR);
$setLimit = static function (string $name, int $amount) use ($db): void {
    $db->prepare('UPDATE resource_quota_limits SET amount=:amount WHERE name=:name')->execute(compact('name', 'amount'));
};
$quotaReject = static function (callable $operation): void {
    try { $operation(); } catch (PDOException $error) {
        sharedExpect(str_contains($error->getMessage(), 'GENESIS_QUOTA_EXCEEDED'), 'Unexpected database error.');
        sharedExpect(!genesisDb()->inTransaction(), 'Quota failure left a transaction open.');
        return;
    }
    throw new RuntimeException('Resource quota was bypassed.');
};
try {
    $setLimit('projects_per_space', 3); // Inbox and two existing projects.
    $quotaReject(static fn() => genesisSharedCreateProject($owner['id'], $space['id'], ['title' => 'Over quota']));
    sharedExpect(count(genesisSharedProjects($owner['id'], $space['id'])) === 3, 'Failed create left a partial project.');
    $setLimit('tasks_per_project', 1);
    $quotaReject(static fn() => genesisSharedTask($owner['id'], $private['id'], ['title' => 'Over quota', 'statusId' => $privateStatus]));
    $setLimit('comments_per_task', 1);
    genesisSharedAddComment($owner['id'], $private['id'], $task['id'], ['body' => 'Synthetic allowed comment']);
    $quotaReject(static fn() => genesisSharedAddComment($owner['id'], $private['id'], $task['id'], ['body' => 'Synthetic rejected comment']));
    $setLimit('media_bytes_per_user', 2);
    $current = genesisSharedProjectSnapshot($owner['id'], $private['id'])['tasks'][0];
    $quotaReject(static fn() => genesisSharedTask($owner['id'], $private['id'], ['title' => 'Should roll back',
        'statusId' => $privateStatus, 'expectedRevision' => $current['revision'],
        'attachments' => [['name' => 'synthetic.txt', 'data' => 'data:text/plain;base64,' . base64_encode('synthetic')]]], $task['id']));
    $after = genesisSharedProjectSnapshot($owner['id'], $private['id'])['tasks'][0];
    sharedExpect($after['title'] === $current['title'] && $after['revision'] === $current['revision'], 'Attachment quota did not roll back the task edit.');
    sharedExpect(genesisSharedTaskAttachments($task['id']) === [], 'Rejected attachment was persisted.');
} finally {
    foreach ($limits as $name => $amount) $setLimit($name, (int)$amount);
    $db->prepare('DELETE FROM api_rate_budgets WHERE subject = :subject')->execute(['subject' => hash('sha256', $subject)]);
}
echo "Resource limits: bounded reads, count/byte budgets and atomic quota rollback passed.\n";
