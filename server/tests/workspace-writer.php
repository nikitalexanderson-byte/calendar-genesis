<?php
declare(strict_types=1);

if (getenv('GENESIS_IMPROVEMENTS_TEST') !== 'isolated' && !getenv('GENESIS_SMOKE_ROOT')) {
    throw new RuntimeException('This test requires an explicit isolated environment.');
}
require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';

$db = genesisDb();
$db->beginTransaction();
try {
    $userId = 'test-workspace-writer-protocol';
    $now = genesisNow();
    $db->prepare('INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$userId, $userId, 'writer@example.invalid', 'Synthetic Writer', $now, $now]);
    $body = ['ciphertext'=>base64_encode('opaque test ciphertext'), 'iv'=>base64_encode(random_bytes(12))];
    $legacy = genesisSaveWorkspaceEnvelope($userId, $body);
    if ($legacy['version'] !== 1) throw new RuntimeException('Unchanged legacy workspaces must remain writable.');
    $enabled = genesisSaveWorkspaceEnvelope($userId, $body + ['expectedVersion'=>1, 'writerProtocol'=>2, 'minimumWriterProtocol'=>2]);
    if ($enabled['version'] !== 2) throw new RuntimeException('Activation failed.');
    foreach ([$body, $body + ['expectedVersion'=>2]] as $oldWriter) {
        try { genesisSaveWorkspaceEnvelope($userId, $oldWriter); throw new RuntimeException('Legacy overwrite accepted.'); }
        catch (DomainException $error) { if ($error->getMessage() !== 'WORKSPACE_UPGRADE_REQUIRED') throw $error; }
    }
    // The pre-feature SQL used by a rolled-back server cannot bypass the database guard.
    try {
        $db->prepare('UPDATE workspace_blobs SET ciphertext=?, version=version+1 WHERE user_id=?')->execute([base64_encode('lost data'), $userId]);
        throw new RuntimeException('Old server SQL bypassed the guard.');
    } catch (PDOException $error) {
        if (!str_contains($error->getMessage(), 'WORKSPACE_UPGRADE_REQUIRED')) throw $error;
    }
    $new = genesisSaveWorkspaceEnvelope($userId, $body + ['expectedVersion'=>2, 'writerProtocol'=>2]);
    if ($new['version'] !== 3) throw new RuntimeException('Current writer failed.');
    $stored = $db->query("SELECT version, minimum_writer_protocol, writer_protocol_version FROM workspace_blobs WHERE user_id='test-workspace-writer-protocol'")->fetch();
    if ((int)$stored['minimum_writer_protocol'] !== 2 || (int)$stored['writer_protocol_version'] !== 3)
        throw new RuntimeException('Protection was downgraded.');
    echo "Workspace writer: legacy compatibility, activation, rejection, rollback guard and current writes passed.\n";
} finally {
    $db->rollBack();
}
