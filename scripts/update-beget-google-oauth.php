<?php
declare(strict_types=1);

if ($argc !== 2) {
    fwrite(STDERR, "Usage: php update-beget-google-oauth.php /absolute/config.php < credentials.json\n");
    exit(2);
}

$configPath = $argv[1];
$expectedPath = '/home/h/haiirodw/genesis-calendar/server/config.php';
if ($configPath !== $expectedPath) {
    fwrite(STDERR, "Refusing to update an unexpected config path.\n");
    exit(3);
}

$payload = fgets(STDIN);
if ($payload === false) {
    fwrite(STDERR, "Credentials were not received on standard input.\n");
    exit(4);
}
$credentials = json_decode($payload, true);
if (!is_array($credentials)) {
    fwrite(STDERR, "Credentials must be a JSON object.\n");
    exit(5);
}

$clientId = trim((string)($credentials['client_id'] ?? ''));
$clientSecret = trim((string)($credentials['client_secret'] ?? ''));
if (!preg_match('/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/', $clientId)) {
    fwrite(STDERR, "The Google OAuth client ID is invalid.\n");
    exit(6);
}
if (strlen($clientSecret) < 20) {
    fwrite(STDERR, "The Google OAuth client secret is invalid.\n");
    exit(7);
}
if (!is_file($configPath)) {
    fwrite(STDERR, "Config file not found.\n");
    exit(8);
}

$config = require $configPath;
if (!is_array($config)) {
    fwrite(STDERR, "Config file did not return an array.\n");
    exit(9);
}

$backupPath = $configPath . '.bak-' . gmdate('Ymd-His');
if (!copy($configPath, $backupPath) || !chmod($backupPath, 0600)) {
    fwrite(STDERR, "Could not create a protected config backup.\n");
    exit(10);
}

$config['google_client_id'] = $clientId;
$config['google_client_secret'] = $clientSecret;
$temporaryPath = $configPath . '.tmp-' . bin2hex(random_bytes(4));
$updatedConfig = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";

if (file_put_contents($temporaryPath, $updatedConfig, LOCK_EX) === false || !chmod($temporaryPath, 0600)) {
    @unlink($temporaryPath);
    fwrite(STDERR, "Could not write the updated config.\n");
    exit(11);
}
if (!rename($temporaryPath, $configPath)) {
    @unlink($temporaryPath);
    fwrite(STDERR, "Could not replace the config atomically.\n");
    exit(12);
}

printf(
    "google_client_id_configured=yes\ngoogle_client_secret_configured=yes\nbackup=%s\n",
    $backupPath,
);
