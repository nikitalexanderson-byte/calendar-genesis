<?php
declare(strict_types=1);

function genesisRoot(): string
{
    return dirname(__DIR__);
}

function genesisConfig(): array
{
    static $config;
    if (is_array($config)) {
        return $config;
    }

    $path = genesisRoot() . '/config.php';
    if (!is_file($path)) {
        throw new RuntimeException('GENESIS server is not configured.');
    }
    $config = require $path;
    if (!is_array($config)) {
        throw new RuntimeException('Invalid GENESIS configuration.');
    }
    date_default_timezone_set((string)($config['timezone'] ?? 'Europe/Moscow'));
    return $config;
}

function genesisEnsureDirectory(string $path, int $mode = 0700): void
{
    if (!is_dir($path) && !mkdir($path, $mode, true) && !is_dir($path)) {
        throw new RuntimeException('Cannot create server data directory.');
    }
    @chmod($path, $mode);
}

function genesisStartSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $config = genesisConfig();
    $sessionPath = (string)$config['session_path'];
    genesisEnsureDirectory($sessionPath);
    session_save_path($sessionPath);
    session_name('GENESISSESSID');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => (bool)($config['cookie_secure'] ?? true),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
}

function genesisDb(): PDO
{
    static $db;
    if ($db instanceof PDO) {
        return $db;
    }
    $config = genesisConfig();
    $path = (string)$config['db_path'];
    genesisEnsureDirectory(dirname($path));
    $db = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('PRAGMA busy_timeout = 5000');

    $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    $migrationFiles = glob(genesisRoot() . '/migrations/*.sql') ?: [];
    sort($migrationFiles, SORT_STRING);
    $alreadyApplied = $db->prepare('SELECT 1 FROM schema_migrations WHERE name = :name LIMIT 1');
    $markApplied = $db->prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (:name, :applied_at)');
    foreach ($migrationFiles as $migrationFile) {
        $name = basename($migrationFile);
        $alreadyApplied->execute(['name' => $name]);
        if ($alreadyApplied->fetchColumn() !== false) {
            continue;
        }
        $migration = file_get_contents($migrationFile);
        if ($migration === false) {
            throw new RuntimeException('Database migration is unreadable: ' . $name);
        }
        $db->beginTransaction();
        try {
            $db->exec($migration);
            $markApplied->execute(['name' => $name, 'applied_at' => genesisNow()]);
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }
    return $db;
}

function genesisJson(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function genesisReadJson(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($value)) {
        throw new InvalidArgumentException('JSON object expected.');
    }
    return $value;
}

function genesisUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function genesisNow(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function genesisLogError(string $message, ?Throwable $error = null): void
{
    $logLine = sprintf(
        "[%s] %s%s\n",
        gmdate('Y-m-d\TH:i:s\Z'),
        $message,
        $error !== null ? sprintf(" in %s:%d\n%s", $error->getFile(), $error->getLine(), $error->getTraceAsString()) : '',
    );
    $logPath = dirname((string)genesisConfig()['db_path']) . '/app-error.log';
    @file_put_contents($logPath, $logLine, FILE_APPEND | LOCK_EX);
}

function genesisClientTimeZone(): DateTimeZone
{
    $fallback = (string)(genesisConfig()['timezone'] ?? 'Europe/Moscow');
    $requested = trim((string)($_SERVER['HTTP_X_GENESIS_TIME_ZONE'] ?? ''));
    try {
        return new DateTimeZone($requested !== '' ? $requested : $fallback);
    } catch (Throwable) {
        return new DateTimeZone($fallback);
    }
}

function genesisClientDayKey(): string
{
    return (new DateTimeImmutable('now', genesisClientTimeZone()))->format('Y-m-d');
}

function genesisCurrentUserId(): ?string
{
    return isset($_SESSION['user_id']) ? (string)$_SESSION['user_id'] : null;
}

function genesisRequireUserId(): string
{
    $id = genesisCurrentUserId();
    if ($id === null) {
        genesisJson(['error' => 'AUTH_REQUIRED'], 401);
    }
    return $id;
}

function genesisRequireCsrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $known = $_SESSION['csrf'] ?? '';
    if (!is_string($sent) || !is_string($known) || $known === '' || !hash_equals($known, $sent)) {
        genesisJson(['error' => 'CSRF token mismatch.'], 403);
    }
}

function genesisEncrypt(?string $plain): ?string
{
    if ($plain === null || $plain === '') {
        return null;
    }
    $key = base64_decode((string)genesisConfig()['crypto_key'], true);
    if (!is_string($key) || strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
        throw new RuntimeException('Invalid encryption key.');
    }
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    return base64_encode($nonce . sodium_crypto_secretbox($plain, $nonce, $key));
}

function genesisDecrypt(?string $encoded): ?string
{
    if ($encoded === null || $encoded === '') {
        return null;
    }
    $key = base64_decode((string)genesisConfig()['crypto_key'], true);
    $blob = base64_decode($encoded, true);
    if (!is_string($key) || strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES || !is_string($blob)) {
        return null;
    }
    $nonce = substr($blob, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = substr($blob, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain = sodium_crypto_secretbox_open($cipher, $nonce, $key);
    return is_string($plain) ? $plain : null;
}

function genesisClampInt(mixed $value, int $min, int $max, int $fallback): int
{
    if (!is_numeric($value)) {
        return $fallback;
    }
    return max($min, min($max, (int)$value));
}

genesisStartSession();
