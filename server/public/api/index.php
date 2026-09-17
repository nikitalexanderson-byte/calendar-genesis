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
require $serverRoot . '/src/gemini.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(self), geolocation=()');
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

function genesisSafeReturnTo(string $value): string
{
    $returnTo = trim($value);
    if (
        $returnTo === ''
        || !str_starts_with($returnTo, '/')
        || str_starts_with($returnTo, '//')
        || str_contains($returnTo, '\\')
        || preg_match('/[\x00-\x1F\x7F]/', $returnTo)
    ) {
        return '/';
    }
    return mb_substr($returnTo, 0, 2000);
}

function genesisOAuthRedirect(string $returnTo, ?string $error = null): never
{
    $safeReturnTo = genesisSafeReturnTo($returnTo);
    if ($error !== null && $error !== '') {
        $fragmentPosition = strpos($safeReturnTo, '#');
        $fragment = $fragmentPosition === false ? '' : substr($safeReturnTo, $fragmentPosition);
        $base = $fragmentPosition === false ? $safeReturnTo : substr($safeReturnTo, 0, $fragmentPosition);
        $separator = str_contains($base, '?') ? '&' : '?';
        $safeReturnTo = $base . $separator . 'auth_error=' . rawurlencode($error) . $fragment;
    }
    header('Cache-Control: no-store');
    header('Location: ' . rtrim((string)genesisConfig()['app_url'], '/') . $safeReturnTo, true, 302);
    exit;
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
            $tasks = genesisListAllGoogleTasks($user);
            $syncWarning = genesisGoogleTasksSyncWarning();
            $user = genesisFindUser($userId) ?? $user;
        } catch (Throwable $googleError) {
            $syncWarning = $googleError->getMessage();
        }
        genesisJson([
            'user' => genesisUserForClient($user),
            'csrf' => (string)$_SESSION['csrf'],
            'tasks' => $tasks,
            'taskLists' => genesisGoogleTaskListsForClient(),
            'workspace' => genesisWorkspaceForClient($user),
            'syncWarning' => $syncWarning,
        ]);
    }

    if ($method === 'GET' && $path === 'assistant/status') {
        genesisRequireUserId();
        genesisJson([
            'available' => genesisAssistantAvailable(),
            'provider' => genesisAssistantProvider(),
            'model' => genesisAssistantModel(),
            'audioAvailable' => genesisAssistantAvailable(),
        ]);
    }

    if ($method === 'POST' && $path === 'assistant/plan') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $user = genesisFindUser($userId);
        if ($user === null) {
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        genesisJson(genesisCreateAssistantPlan(genesisReadJson()));
    }

    if ($method === 'GET' && $path === 'sync/tasks') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null) {
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        $tasks = genesisListAllGoogleTasks($user);
        genesisJson([
            'tasks' => $tasks,
            'taskLists' => genesisGoogleTaskListsForClient(),
            'syncedAt' => genesisNow(),
            'syncWarning' => genesisGoogleTasksSyncWarning(),
        ]);
    }

    if ($method === 'GET' && $path === 'auth/google/start') {
        $requestedPurpose = (string)($_GET['purpose'] ?? 'login');
        $purpose = in_array($requestedPurpose, ['services', 'link'], true) ? $requestedPurpose : 'login';
        $returnTo = genesisSafeReturnTo((string)($_GET['return_to'] ?? '/'));
        $loginHint = null;
        $requestUserId = null;
        if (in_array($purpose, ['services', 'link'], true)) {
            $requestUserId = genesisRequireUserId();
            $requestUser = genesisFindUser($requestUserId);
            if ($requestUser === null) {
                unset($_SESSION['user_id']);
                genesisOAuthRedirect($returnTo, 'session_expired');
            }
            if ($purpose === 'services') {
                $loginHint = (string)$requestUser['email'];
            }
        }
        $state = genesisBase64Url(random_bytes(32));
        $verifier = genesisBase64Url(random_bytes(64));
        $_SESSION['oauth_request'] = [
            'state' => $state,
            'verifier' => $verifier,
            'return_to' => $returnTo,
            'purpose' => $purpose,
            'user_id' => $requestUserId,
            'issued_at' => time(),
        ];
        header('Cache-Control: no-store');
        header('Location: ' . genesisGoogleAuthUrl(
            $state,
            genesisBase64Url(hash('sha256', $verifier, true)),
            $purpose,
            $loginHint,
        ), true, 302);
        exit;
    }

    if ($method === 'GET' && $path === 'auth/google/callback') {
        $request = $_SESSION['oauth_request'] ?? null;
        $state = (string)($_GET['state'] ?? '');
        $requestState = is_array($request) ? (string)($request['state'] ?? '') : '';
        $issuedAt = is_array($request) ? (int)($request['issued_at'] ?? 0) : 0;
        if ($state === '' || $requestState === '' || !hash_equals($requestState, $state) || $issuedAt < time() - 600) {
            unset($_SESSION['oauth_request']);
            genesisOAuthRedirect('/', 'invalid_state');
        }
        unset($_SESSION['oauth_request']);

        $returnTo = genesisSafeReturnTo((string)($request['return_to'] ?? '/'));
        $googleError = trim((string)($_GET['error'] ?? ''));
        if ($googleError !== '') {
            genesisOAuthRedirect($returnTo, $googleError === 'access_denied' ? 'access_denied' : 'oauth_failed');
        }
        $code = (string)($_GET['code'] ?? '');
        if ($code === '') {
            genesisOAuthRedirect($returnTo, 'oauth_failed');
        }

        try {
            $tokens = genesisExchangeGoogleCode($code, (string)($request['verifier'] ?? ''));
            if (empty($tokens['access_token'])) {
                throw new RuntimeException('Google did not return an access token.');
            }
            $profile = genesisGoogleUserInfo((string)$tokens['access_token']);
            if (empty($profile['sub']) || empty($profile['email'])) {
                throw new RuntimeException('Google profile is incomplete.');
            }

            $purpose = (string)($request['purpose'] ?? 'login');
            if (in_array($purpose, ['services', 'link'], true)) {
                $requestUserId = (string)($request['user_id'] ?? '');
                $currentUserId = genesisCurrentUserId();
                $currentUser = $currentUserId ? genesisFindUser($currentUserId) : null;
                if ($requestUserId === '' || $currentUserId !== $requestUserId || $currentUser === null) {
                    genesisOAuthRedirect($returnTo, 'session_expired');
                }
                if ($purpose === 'services' && !hash_equals((string)$currentUser['google_sub'], (string)$profile['sub'])) {
                    genesisOAuthRedirect($returnTo, 'account_mismatch');
                }
                if (!genesisGoogleTokenHasScopes($tokens, GENESIS_GOOGLE_SERVICE_SCOPES)) {
                    genesisOAuthRedirect($returnTo, 'missing_permissions');
                }
                if ($purpose === 'services' && empty($tokens['refresh_token']) && empty($currentUser['refresh_token_enc'])) {
                    throw new RuntimeException('Google did not return a refresh token for offline synchronization.');
                }
                if ($purpose === 'link') {
                    genesisLinkGoogleAccount($requestUserId, $profile, $tokens);
                    $_SESSION['user_id'] = $requestUserId;
                    session_regenerate_id(true);
                } else {
                    $user = genesisUpsertGoogleUser($profile, $tokens, true);
                    $_SESSION['user_id'] = (string)$user['id'];
                    session_regenerate_id(true);
                    try {
                        genesisEnsureGoogleCalendar($user);
                    } catch (Throwable $calendarError) {
                        $_SESSION['calendar_error'] = $calendarError->getMessage();
                    }
                }
            } else {
                $user = genesisUpsertGoogleUser($profile, $tokens, false);
                $_SESSION['user_id'] = (string)$user['id'];
                session_regenerate_id(true);
            }
        } catch (Throwable $oauthError) {
            genesisLogError('Google OAuth callback failed.', $oauthError);
            genesisOAuthRedirect($returnTo, 'oauth_failed');
        }
        genesisOAuthRedirect($returnTo);
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

    if ($method === 'POST' && $path === 'task-lists') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $payload = genesisReadJson();
        genesisJson(['taskList' => genesisCreateGoogleTaskList($userId, (string)($payload['title'] ?? ''), isset($payload['accountId']) ? (string)$payload['accountId'] : null)]);
    }

    if (count($segments) === 2 && $segments[0] === 'task-lists') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $id = mb_substr(trim((string)$segments[1]), 0, 500);
        if ($id === '') {
            throw new InvalidArgumentException('Идентификатор списка обязателен.');
        }
        if ($method === 'PATCH') {
            $payload = genesisReadJson();
            genesisJson(['taskList' => genesisUpdateGoogleTaskList($userId, $id, (string)($payload['title'] ?? ''), isset($payload['accountId']) ? (string)$payload['accountId'] : null)]);
        }
        if ($method === 'DELETE') {
            $payload = genesisReadJson();
            genesisDeleteGoogleTaskList($userId, $id, isset($payload['accountId']) ? (string)$payload['accountId'] : null);
            genesisJson(['ok' => true]);
        }
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

    if ($method === 'POST' && $path === 'account/google-services/disconnect') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $user = genesisDisconnectGoogleServices($userId);
        genesisJson(['user' => genesisUserForClient($user)]);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'account' && $segments[1] === 'google-accounts') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisRemoveLinkedGoogleAccount($userId, mb_substr(trim((string)$segments[2]), 0, 100));
        $user = genesisFindUser($userId);
        if ($user === null) genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        genesisJson(['user' => genesisUserForClient($user)]);
    }

    if ($method === 'PUT' && $path === 'account/preferences') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $user = genesisUpdateAccountPreferences($userId, genesisReadJson());
        genesisJson(['user' => genesisUserForClient($user)]);
    }

    if ($method === 'GET' && $path === 'stoicheion/draws') {
        genesisJson(genesisStoicheionDraws(genesisRequireUserId()));
    }

    if ($method === 'POST' && $path === 'stoicheion/draws') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $payload = genesisReadJson();
        $kind = trim((string)($payload['kind'] ?? ''));
        $seed = filter_var($payload['seed'] ?? null, FILTER_VALIDATE_INT);
        if ($seed === false) {
            throw new InvalidArgumentException('Зерно расклада указано неверно.');
        }
        genesisJson(['draw' => genesisSaveStoicheionDraw($userId, $kind, (int)$seed)]);
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
            genesisDeleteGoogleTaskEvent($userId, $id, genesisReadJson());
            genesisJson(['ok' => true]);
        }
    }

    genesisJson(['error' => 'NOT_FOUND'], 404);
} catch (DomainException $error) {
    genesisJson(['error' => $error->getMessage()], 409);
} catch (JsonException | InvalidArgumentException $error) {
    genesisJson(['error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    genesisLogError($error->getMessage(), $error);
    genesisJson(['error' => 'Server error. Please try again.'], 500);
}
