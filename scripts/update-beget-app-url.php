<?php
declare(strict_types=1);

if ($argc !== 3) {
    fwrite(STDERR, "Usage: php update-beget-app-url.php /absolute/config.php https://example.com\n");
    exit(2);
}

$configPath = $argv[1];
$appUrl = rtrim($argv[2], '/');
$allowedRoot = '/home/h/haiirodw/genesis-calendar/server/';

if (!str_starts_with($configPath, $allowedRoot) || basename($configPath) !== 'config.php') {
    fwrite(STDERR, "Refusing to update an unexpected config path.\n");
    exit(3);
}

if (filter_var($appUrl, FILTER_VALIDATE_URL) === false || parse_url($appUrl, PHP_URL_SCHEME) !== 'https') {
    fwrite(STDERR, "The application URL must be an absolute HTTPS URL.\n");
    exit(4);
}

if (!is_file($configPath)) {
    fwrite(STDERR, "Config file not found.\n");
    exit(5);
}

$config = require $configPath;
if (!is_array($config)) {
    fwrite(STDERR, "Config file did not return an array.\n");
    exit(6);
}

$backupPath = $configPath . '.bak-' . gmdate('Ymd-His');
if (!copy($configPath, $backupPath) || !chmod($backupPath, 0600)) {
    fwrite(STDERR, "Could not create a protected config backup.\n");
    exit(7);
}

$config['app_url'] = $appUrl;
$config['cookie_secure'] = true;
$temporaryPath = $configPath . '.tmp-' . bin2hex(random_bytes(4));
$payload = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";

if (file_put_contents($temporaryPath, $payload, LOCK_EX) === false || !chmod($temporaryPath, 0600)) {
    @unlink($temporaryPath);
    fwrite(STDERR, "Could not write the updated config.\n");
    exit(8);
}

if (!rename($temporaryPath, $configPath)) {
    @unlink($temporaryPath);
    fwrite(STDERR, "Could not replace the config atomically.\n");
    exit(9);
}

printf(
    "app_url=%s\ngoogle_client_id_configured=%s\nbackup=%s\n",
    $config['app_url'],
    empty($config['google_client_id']) ? 'no' : 'yes',
    $backupPath,
);
