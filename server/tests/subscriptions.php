<?php
declare(strict_types=1);
// Standalone fixtures: never read server/config.php or open an application database.
if (PHP_SAPI !== 'cli') exit;
final class SubscriptionTestResponse extends RuntimeException {
    public function __construct(public readonly int $status) { parent::__construct('Fixture HTTP ' . $status); }
}
function genesisConfig(): array { return ['admin_email' => 'admin@example.invalid']; }
function genesisNow(): string { return gmdate('c'); }
function genesisCurrentUserId(): ?string { return $_SESSION['user_id'] ?? null; }
function genesisJson(array $payload, int $status = 200): never { throw new SubscriptionTestResponse($status); }
function genesisDb(): PDO { return $GLOBALS['subscriptionFixtureDb']; }
function checkSubscription(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
// Exercise the real primary-identity guard without loading configuration.
$bootstrap = file_get_contents(__DIR__ . '/../src/bootstrap.php');
if (!preg_match('/function genesisSessionIsPrimaryGoogleUser\(array \$user\): bool\s*\{.*?^\}/ms', $bootstrap, $match)) throw new RuntimeException('Primary identity guard missing');
eval($match[0]);
if (!preg_match('/function genesisSessionOwnsGoogleAccount\(array \$user\): bool\s*\{.*?^\}/ms', $bootstrap, $match)) throw new RuntimeException('Account identity guard missing');
eval($match[0]);
require __DIR__ . '/../src/repository.php';
require __DIR__ . '/../src/subscriptions.php';

$old = new SQLite3(':memory:');
$old->exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, display_name TEXT, auth_provider TEXT, google_sub TEXT, updated_at TEXT); CREATE TABLE workspace_blobs (user_id TEXT PRIMARY KEY, ciphertext TEXT);');
$old->exec("INSERT INTO users VALUES ('existing','existing@example.invalid','Existing','google','existing-sub','old'); INSERT INTO workspace_blobs VALUES ('existing','opaque-workspace');");
$backup = new SQLite3(':memory:');
checkSubscription($old->backup($backup), 'Isolated backup failed');
$migration = file_get_contents(__DIR__ . '/../migrations/050_user_subscription_status.sql');
checkSubscription($old->exec($migration), 'Migration failed');
checkSubscription($old->querySingle("SELECT subscription_plan FROM users WHERE id='existing'") === 'free', 'Existing account default changed');
checkSubscription($old->querySingle('SELECT ciphertext FROM workspace_blobs') === 'opaque-workspace', 'Encrypted content changed');
$restored = new SQLite3(':memory:');
checkSubscription($backup->backup($restored), 'Isolated restore failed');
checkSubscription($restored->querySingle('SELECT ciphertext FROM workspace_blobs') === 'opaque-workspace', 'Restored content changed');
checkSubscription(!str_contains((string)$restored->querySingle("SELECT sql FROM sqlite_master WHERE name='users'"), 'subscription_plan'), 'Backup was not pre-migration');

$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$GLOBALS['subscriptionFixtureDb'] = $db;
$db->exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, display_name TEXT, auth_provider TEXT, google_sub TEXT, updated_at TEXT);');
$db->exec($migration);
$db->exec("INSERT INTO users(id,email,display_name,auth_provider,google_sub,updated_at) VALUES ('admin','admin@example.invalid','Admin','google','admin-sub','old'), ('member','member@example.invalid','Member','google','member-sub','old'), ('yandex','admin@example.invalid','Other provider','yandex','other-sub','old');");
$_SESSION = ['user_id' => 'admin', 'auth_identity' => ['kind' => 'primary', 'sub' => 'admin-sub']];
$previous = 'free';
foreach (GENESIS_SUBSCRIPTION_PLANS as $plan) {
    $result = genesisAdminSetSubscription('admin', 'member', $plan, $previous);
    checkSubscription($result['subscriptionPlan'] === $plan && genesisFindUser('member')['subscription_plan'] === $plan, 'Plan did not persist');
    checkSubscription(!genesisIsAdminUser(genesisFindUser('member')), 'Plan granted administrator rights');
    $previous = $plan;
}
checkSubscription(genesisFindUser('member')['google_sub'] === 'member-sub', 'Identity changed');
foreach (['invalid', 'Premium4Life', 'standard', ''] as $plan) {
    try { genesisAdminSetSubscription('admin', 'member', $plan, 'premium4life'); throw new RuntimeException('Invalid plan accepted'); }
    catch (InvalidArgumentException $error) { checkSubscription($error->getMessage() === 'INVALID_SUBSCRIPTION_PLAN', 'Wrong validation failure'); }
}
try { genesisAdminSetSubscription('admin', 'member', 'free', 'standart'); throw new RuntimeException('Stale write accepted'); }
catch (DomainException $error) { checkSubscription($error->getMessage() === 'SUBSCRIPTION_STATUS_CONFLICT', 'Wrong conflict'); }
checkSubscription(genesisFindUser('member')['subscription_plan'] === 'premium4life', 'Conflict overwrote status');
try { genesisAdminSetSubscription('admin', 'missing', 'free', 'free'); throw new RuntimeException('Missing target accepted'); }
catch (DomainException $error) { checkSubscription($error->getMessage() === 'SUBSCRIPTION_USER_NOT_FOUND', 'Wrong missing target'); }
foreach ([['member','primary','member-sub'], ['admin','linked','admin-sub'], ['admin','primary','wrong-sub'], ['yandex','primary','other-sub']] as [$actor,$kind,$sub]) {
    $_SESSION = ['user_id' => $actor, 'auth_identity' => ['kind' => $kind, 'sub' => $sub]];
    try { genesisAdminSetSubscription($actor, 'member', 'free', 'premium4life'); throw new RuntimeException('Forbidden identity accepted'); }
    catch (SubscriptionTestResponse $error) { checkSubscription($error->status === 403, 'Wrong access response'); }
}
try { $db->exec("UPDATE users SET subscription_plan='unexpected' WHERE id='member'"); throw new RuntimeException('Database accepted invalid plan'); }
catch (PDOException) {}
checkSubscription(genesisFindUser('member')['subscription_plan'] === 'premium4life', 'Rejected write changed status');
echo "PASS subscription metadata: defaults, preservation, backup/restore, five plans, persistence, invalid values, conflicts, primary admin guard, provider isolation, no role escalation.\n";
