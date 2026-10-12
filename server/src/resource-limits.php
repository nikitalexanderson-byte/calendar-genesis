<?php
declare(strict_types=1);

final class GenesisResourceLimitException extends RuntimeException
{
    public function __construct(public readonly int $status, string $code)
    {
        parent::__construct($code);
    }
}

/** Acquire the SQLite writer before reading ACLs/counts, avoiding deferred-lock upgrade races. */
function genesisBeginWriteTransaction(PDO $db): void
{
    $db->beginTransaction();
    try { $db->exec("UPDATE resource_quota_limits SET amount=amount WHERE name='tasks_per_user'"); }
    catch (Throwable $error) { $db->rollBack(); throw $error; }
}

function genesisJsonBodyLimit(string $path): int
{
    // Include base64 overhead and metadata; decoded files retain their existing limits.
    if ($path === 'workspace') return 10_100_000;
    if (preg_match('~^mindmaps/[a-zA-Z0-9_-]+$~D', $path)) return 2_810_000;
    if (preg_match('~^shared/projects/[^/]+/tasks(?:/[^/]+)?$~D', $path)) return 19 * 1024 * 1024;
    if (preg_match('~^shared/spaces(?:/[^/]+)?$~D', $path)) return 5 * 1024 * 1024;
    if (preg_match('~^shared/spaces/[^/]+/import-project$~D', $path)) return 12 * 1024 * 1024;
    return 256 * 1024;
}

/** Reads at most limit+1, even with missing/incorrect Content-Length. */
function genesisBoundedBody($stream, int $limit, ?int $declaredLength = null): string
{
    if ($declaredLength !== null && $declaredLength > $limit) {
        throw new GenesisResourceLimitException(413, 'REQUEST_TOO_LARGE');
    }
    $raw = stream_get_contents($stream, $limit + 1);
    if ($raw === false) throw new InvalidArgumentException('REQUEST_UNREADABLE');
    if (strlen($raw) > $limit) throw new GenesisResourceLimitException(413, 'REQUEST_TOO_LARGE');
    return $raw;
}

/** A shared SQLite budget, independent of cookies/devices; never trusts forwarded IP headers. */
function genesisConsumeApiBudget(string $subject, string $bucket, int $countLimit, int $byteLimit,
    int $bytes = 0, ?int $now = null): void
{
    $now ??= time();
    $start = intdiv($now, 600) * 600;
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $db->prepare('DELETE FROM api_rate_budgets WHERE window_start < :expired')->execute(['expired' => $start - 1200]);
        $query = $db->prepare('INSERT INTO api_rate_budgets (subject, bucket, window_start, request_count, input_bytes)
            VALUES (:subject, :bucket, :start, 1, :bytes)
            ON CONFLICT(subject, bucket) DO UPDATE SET window_start = excluded.window_start,
                request_count = CASE WHEN api_rate_budgets.window_start = excluded.window_start
                    THEN api_rate_budgets.request_count + 1 ELSE 1 END,
                input_bytes = CASE WHEN api_rate_budgets.window_start = excluded.window_start
                    THEN api_rate_budgets.input_bytes + excluded.input_bytes ELSE excluded.input_bytes END
            RETURNING request_count, input_bytes');
        $query->execute(['subject' => hash('sha256', $subject), 'bucket' => $bucket, 'start' => $start, 'bytes' => $bytes]);
        $usage = $query->fetch();
        $query->closeCursor();
        // Retain rejected attempts in the counter; clients cannot evade the budget by retrying.
        $db->commit();
        if ((int)$usage['request_count'] > $countLimit || (int)$usage['input_bytes'] > $byteLimit) {
            throw new GenesisResourceLimitException(429, 'API_RATE_LIMIT');
        }
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function genesisEnforceApiBudget(string $method, string $path, ?string $userId): void
{
    if ($method === 'OPTIONS' || ($method === 'GET' && in_array($path, ['health', 'auth/providers'], true))) return;
    // Logout must remain possible even after exhausting a budget.
    if ($path === 'auth/logout') return;
    if ($userId === null) {
        genesisConsumeApiBudget('ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 'anonymous', 600, 16 * 1024 * 1024);
    } else {
        $write = !in_array($method, ['GET', 'HEAD'], true);
        genesisConsumeApiBudget('user:' . $userId, $write ? 'write' : 'read', $write ? 3000 : 15000, 256 * 1024 * 1024);
    }
}
