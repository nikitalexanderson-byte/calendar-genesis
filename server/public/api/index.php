<?php
declare(strict_types=1);

$serverRoot = '';
$cursor = __DIR__;
for ($depth = 0; $depth < 7; $depth++) {
    foreach ([$cursor . '/server', $cursor . '/genesis-app/server'] as $candidate) {
        if (is_file($candidate . '/src/bootstrap.php')) {
            $serverRoot = $candidate;
            break 2;
        }
    }
    $parent = dirname($cursor);
    if ($parent === $cursor) {
        break;
    }
    $cursor = $parent;
}
if ($serverRoot === '') {
    http_response_code(503);
    exit('GENESIS server files are unavailable.');
}
require $serverRoot . '/src/bootstrap.php';
require $serverRoot . '/src/repository.php';
require $serverRoot . '/src/google.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = trim((string)($_GET['path'] ?? $_SERVER['PATH_INFO'] ?? ''), '/');
$segments = $path === '' ? [] : explode('/', $path);

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function genesisFinishSession(): never
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
    }
    session_destroy();
    genesisJson(['ok' => true]);
}

try {
    if ($method === 'GET' && $path === 'health') {
        genesisJson(['ok' => true, 'service' => 'GENESIS', 'privacyModel' => 2, 'time' => genesisNow()]);
    }

    if ($method === 'GET' && $path === 'session') {
        $userId = genesisCurrentUserId();
        $user = $userId ? genesisFindUser($userId) : null;
        if ($userId && $user === null) {
            unset($_SESSION['user_id']);
        }
        genesisJson([
            'user' => $user ? genesisUserForClient($user) : null,
            'csrf' => (string)$_SESSION['csrf'],
        ]);
    }

    if ($method === 'GET' && $path === 'bootstrap') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null) {
            unset($_SESSION['user_id']);
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        $tasks = [];
        $syncWarning = null;
        try {
            $tasks = genesisListGoogleTasks($user);
            $user = genesisFindUser($userId) ?? $user;
        } catch (Throwable $googleError) {
            $syncWarning = $googleError->getMessage();
        }
        genesisJson([
            'user' => genesisUserForClient($user),
            'csrf' => (string)$_SESSION['csrf'],
            'tasks' => $tasks,
            'workspace' => genesisWorkspaceForClient($user),
            'syncWarning' => $syncWarning,
        ]);
    }

    if ($method === 'GET' && $path === 'sync/tasks') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null) {
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        genesisJson(['tasks' => genesisListGoogleTasks($user), 'syncedAt' => genesisNow()]);
    }

    if ($method === 'GET' && $path === 'auth/google/start') {
        $returnTo = (string)($_GET['return_to'] ?? '/');
        if (!str_starts_with($returnTo, '/') || str_starts_with($returnTo, '//')) {
            $returnTo = '/';
        }
        $state = genesisBase64Url(random_bytes(32));
        $verifier = genesisBase64Url(random_bytes(64));
        $_SESSION['oauth_state'] = $state;
        $_SESSION['oauth_verifier'] = $verifier;
        $_SESSION['oauth_return_to'] = $returnTo;
        header('Cache-Control: no-store');
        header('Location: ' . genesisGoogleAuthUrl($state, genesisBase64Url(hash('sha256', $verifier, true))), true, 302);
        exit;
    }

    if ($method === 'GET' && $path === 'auth/google/callback') {
        $state = (string)($_GET['state'] ?? '');
        $code = (string)($_GET['code'] ?? '');
        if ($state === '' || $code === '' || empty($_SESSION['oauth_state']) || !hash_equals((string)$_SESSION['oauth_state'], $state)) {
            throw new RuntimeException('Google authorization state is invalid.');
        }
        $tokens = genesisExchangeGoogleCode($code, (string)($_SESSION['oauth_verifier'] ?? ''));
        if (empty($tokens['access_token'])) {
            throw new RuntimeException('Google did not return an access token.');
        }
        $profile = genesisGoogleUserInfo((string)$tokens['access_token']);
        if (empty($profile['sub']) || empty($profile['email'])) {
            throw new RuntimeException('Google profile is incomplete.');
        }
        $user = genesisUpsertGoogleUser($profile, $tokens);
        $_SESSION['user_id'] = (string)$user['id'];
        session_regenerate_id(true);
        try {
            genesisEnsureGoogleCalendar($user);
        } catch (Throwable $calendarError) {
            $_SESSION['calendar_error'] = $calendarError->getMessage();
        }
        $returnTo = (string)($_SESSION['oauth_return_to'] ?? '/');
        unset($_SESSION['oauth_state'], $_SESSION['oauth_verifier'], $_SESSION['oauth_return_to']);
        header('Location: ' . rtrim((string)genesisConfig()['app_url'], '/') . $returnTo, true, 302);
        exit;
    }

    if ($method === 'POST' && $path === 'auth/password/login') {
        genesisJson(['error' => 'Вход по паролю отключён. Используйте безопасную авторизацию Google OAuth.'], 410);
    }

    if ($method === 'POST' && $path === 'auth/password/set') {
        genesisJson(['error' => 'Пароли GENESIS отключены. Авторизация выполняется только через Google OAuth.'], 410);
    }

    if ($method === 'POST' && $path === 'auth/logout') {
        genesisRequireCsrf();
        genesisFinishSession();
    }

    if ($method === 'PUT' && $path === 'workspace') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $payload = genesisReadJson();
        $saved = genesisSaveWorkspaceEnvelope($userId, $payload);
        genesisSaveMetrics($userId, $payload);
        genesisJson(['ok' => true, 'workspace' => $saved]);
    }

    if ($method === 'POST' && $path === 'metrics') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisSaveMetrics($userId, genesisReadJson());
        genesisJson(['ok' => true]);
    }

    if ($method === 'GET' && $path === 'admin/stats') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null) {
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        genesisRequireAdmin($user);
        genesisJson(genesisAdminStats());
    }

    if ($method === 'DELETE' && $path === 'account') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisDeleteAccount($userId);
        genesisFinishSession();
    }

    if (count($segments) === 2 && $segments[0] === 'tasks') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $id = mb_substr((string)$segments[1], 0, 100);
        if ($id === '') {
            throw new InvalidArgumentException('Task identifier is required.');
        }
        if ($method === 'PUT') {
            genesisJson(['task' => genesisSyncTaskToGoogle($userId, $id, genesisReadJson())]);
        }
        if ($method === 'DELETE') {
            genesisDeleteGoogleTaskEvent($userId, $id);
            genesisJson(['ok' => true]);
        }
    }

    genesisJson(['error' => 'NOT_FOUND'], 404);
} catch (JsonException | InvalidArgumentException $error) {
    genesisJson(['error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    error_log('[GENESIS] ' . $error->getMessage());
    genesisJson(['error' => 'Server error. Please try again.'], 500);
}
