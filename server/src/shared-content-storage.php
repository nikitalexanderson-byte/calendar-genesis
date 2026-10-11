<?php
declare(strict_types=1);

// ACLs still apply in the repositories. Content is encrypted at rest with the server key;
// membership, dates, positions and revisions remain indexed relational metadata.
const GENESIS_SHARED_CONTENT_FIELDS = [
    'shared_tasks' => ['title', 'description', 'tags_json'],
    'shared_comments' => ['body'],
    'shared_audit_events' => ['details_json'],
];
const GENESIS_SHARED_CONTENT_PREFIX = 'genesis-content-v1:';

function genesisSharedContentDecrypt(?string $value): ?string
{
    if ($value === null || !str_starts_with($value, GENESIS_SHARED_CONTENT_PREFIX)) return $value;
    $plain = genesisDecrypt(substr($value, strlen(GENESIS_SHARED_CONTENT_PREFIX)));
    if ($plain === null) throw new RuntimeException('Shared content authentication failed.');
    return $plain;
}

function genesisSharedContentEncrypt(?string $value): ?string
{
    if ($value === null || $value === '') return $value;
    if (str_starts_with($value, GENESIS_SHARED_CONTENT_PREFIX)) {
        try { if (genesisSharedContentDecrypt($value) !== null) return $value; } catch (Throwable) { /* Literal user text. */ }
    }
    return GENESIS_SHARED_CONTENT_PREFIX . genesisEncrypt($value);
}

function genesisRegisterSharedContentFunctions(PDO $db): void
{
    $db->sqliteCreateFunction('genesis_content_encrypt', 'genesisSharedContentEncrypt', 1);
    $db->sqliteCreateFunction('genesis_content_decrypt', 'genesisSharedContentDecrypt', 1);
}

/** Runs once after migration 043, inside one transaction; CI saves a consistent pre-deploy DB. */
function genesisInitializeSharedContentStorage(PDO $db): void
{
    if ($db->query('SELECT 1 FROM shared_content_storage WHERE version = 1')->fetchColumn() !== false) return;
    $db->beginTransaction();
    try {
        // Serialize first-use initialization across PHP workers.
        $db->exec('INSERT OR IGNORE INTO shared_content_storage (version, initialized_at) VALUES (1, CURRENT_TIMESTAMP)');
        if ((int)$db->query('SELECT changes()')->fetchColumn() === 0) { $db->commit(); return; }
        foreach (GENESIS_SHARED_CONTENT_FIELDS as $table => $fields) {
            $db->exec('UPDATE ' . $table . ' SET ' . implode(', ', array_map(
                static fn(string $field): string => $field . ' = genesis_content_encrypt(' . $field . ')', $fields)));
            $columns = $db->query('PRAGMA table_info(' . $table . ')')->fetchAll(PDO::FETCH_ASSOC);
            $projection = array_map(static fn(array $column): string => in_array($column['name'], $fields, true)
                ? 'genesis_content_decrypt("' . $column['name'] . '") AS "' . $column['name'] . '"' : '"' . $column['name'] . '"', $columns);
            $db->exec('CREATE VIEW ' . $table . '_read AS SELECT ' . implode(', ', $projection) . ' FROM ' . $table);
            $assignments = implode(', ', array_map(static fn(string $field): string =>
                $field . ' = genesis_content_encrypt(NEW.' . $field . ')', $fields));
            foreach (['INSERT', 'UPDATE OF ' . implode(', ', $fields)] as $index => $event) {
                $db->exec('CREATE TRIGGER ' . $table . '_content_' . $index . ' AFTER ' . $event . ' ON ' . $table
                    . ' BEGIN UPDATE ' . $table . ' SET ' . $assignments . ' WHERE id = NEW.id; END');
            }
        }
        $db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
}

/** Explicit, tested forward rollback. Never run automatically against production. */
function genesisRollbackSharedContentStorage(PDO $db): void
{
    $db->beginTransaction();
    try {
        foreach (GENESIS_SHARED_CONTENT_FIELDS as $table => $fields) {
            foreach ([0, 1] as $index) $db->exec('DROP TRIGGER IF EXISTS ' . $table . '_content_' . $index);
            $db->exec('DROP VIEW IF EXISTS ' . $table . '_read');
            $db->exec('UPDATE ' . $table . ' SET ' . implode(', ', array_map(
                static fn(string $field): string => $field . ' = genesis_content_decrypt(' . $field . ')', $fields)));
        }
        $db->exec('DELETE FROM shared_content_storage');
        $db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
}
