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
require $serverRoot . '/src/ads.php';
require $serverRoot . '/src/google.php';
require $serverRoot . '/src/yandex.php';
require $serverRoot . '/src/yandex-calendar.php';
require $serverRoot . '/src/local-accounts.php';
require $serverRoot . '/src/native-auth.php';
require $serverRoot . '/src/gemini.php';
require $serverRoot . '/src/shared-projects.php';
require $serverRoot . '/src/shared-google.php';

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

function genesisFinishSession(array $payload = ['ok' => true]): never
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
    }
    session_destroy();
    genesisJson($payload);
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

function genesisObserveAndroid(callable $record): void
{
    try {
        $record();
    } catch (Throwable $error) {
        genesisLogError('Android activity observation failed.', $error);
    }
}

function genesisRequireGoogleUser(string $userId): array
{
    $user = genesisFindUser($userId);
    if ($user === null || genesisUserProvider($user) !== 'google') {
        genesisJson(['error' => 'GOOGLE_ACCOUNT_REQUIRED'], 403);
    }
    return $user;
}

function genesisRequireYandexUser(string $userId): array
{
    $user = genesisFindUser($userId);
    if ($user === null || genesisUserProvider($user) !== 'yandex') {
        genesisJson(['error' => 'YANDEX_ACCOUNT_REQUIRED'], 403);
    }
    return $user;
}

try {
    $sessionUserId = genesisCurrentUserId();
    if ($sessionUserId !== null) {
        $sessionUser = genesisFindUser($sessionUserId);
        if ($sessionUser !== null && genesisUserProvider($sessionUser) === 'unsupported') {
            unset($_SESSION['user_id'], $_SESSION['csrf'], $_SESSION['pending_local_link']);
        }
    }
    if ($method === 'GET' && $path === 'health') {
        genesisJson(['ok' => true, 'service' => 'GENESIS', 'privacyModel' => 2, 'time' => genesisNow()]);
    }

    if ($method === 'GET' && $path === 'auth/providers') {
        genesisJson(['google' => true, 'yandex' => genesisYandexConfigured()]);
    }

    if ($method === 'GET' && $path === 'ads/today') {
        genesisRequireUserId();
        $language = substr((string)($_GET['language'] ?? 'ru'), 0, 2);
        $country = strtoupper(substr((string)($_GET['country'] ?? ''), 0, 2));
        $platform = (string)($_GET['platform'] ?? 'web');
        genesisJson(['ads' => genesisTodayAds($language, $country, $platform)]);
    }

    if ($method === 'GET' && $path === 'android/download') {
        $publicRoot = dirname(__DIR__);
        $manifest = @file_get_contents($publicRoot . '/android-update.json');
        $release = $manifest === false ? null : json_decode($manifest, true);
        $version = is_array($release) ? ($release['versionName'] ?? null) : null;
        if (!is_string($version) || !preg_match('/\A[0-9]+(?:\.[0-9]+){1,3}\z/', $version)) {
            genesisJson(['error' => 'ANDROID_RELEASE_UNAVAILABLE'], 503);
        }
        $apkUrl = '/downloads/GENESIS-Android-Native-' . $version . '.apk';
        if (!is_file($publicRoot . $apkUrl)) {
            genesisJson(['error' => 'ANDROID_RELEASE_UNAVAILABLE'], 503);
        }
        $userId = genesisCurrentUserId();
        if ($userId !== null && genesisFindUser($userId) !== null) {
            genesisObserveAndroid(static fn() => genesisRecordAndroidDownload($userId, $version));
        }
        header('Cache-Control: no-store');
        header('Location: ' . $apkUrl, true, 302);
        exit;
    }

    if ($method === 'GET' && $path === 'session') {
        $userId = genesisCurrentUserId();
        $user = $userId ? genesisFindUser($userId) : null;
        if ($userId && $user === null) {
            unset($_SESSION['user_id']);
        }
        if ($user !== null) genesisObserveAndroid(static fn() => genesisReportAndroidClient((string)$user['id']));
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
        // Long Google enumeration must not lock sign-in/settings requests from
        // this device. Authentication and CSRF are already in this request's memory.
        session_write_close();
        $tasks = [];
        $syncWarning = null;
        try {
            if (genesisUserProvider($user) !== 'google') {
                $tasks = genesisLocalTasksForClient($user);
            } else {
                $tasks = genesisListAllGoogleTasks($user);
                $syncWarning = genesisGoogleTasksSyncWarning();
            }
        } catch (Throwable $googleError) {
            $syncWarning = $googleError->getMessage();
        }
        // A failed Google refresh can revoke the stored authorization. Always
        // return the post-sync connection state so clients can offer reconnect.
        $user = genesisFindUser($userId) ?? $user;
        $clientUser = genesisUserForClient($user);
        $response = [
            'user' => $clientUser,
            'csrf' => (string)$_SESSION['csrf'],
            'tasks' => $tasks,
            'tasksDeferred' => genesisUserProvider($user) === 'yandex'
                && !array_reduce(genesisLocalAccountMembers($user),
                    static fn(bool $found, array $account): bool => $found || !empty($account['tasksConnected']), false),
            'taskLists' => genesisGoogleTaskListsForClient(),
            'workspace' => genesisWorkspaceForClient($user),
            'syncWarning' => $syncWarning,
        ];
        genesisObserveAndroid(static fn() => genesisReportAndroidClient($userId, 'ok', $syncWarning !== null ? 'warning'
            : (!empty($clientUser['googleTasksImportReady']) || !empty($clientUser['calendarConnected'])
                ? 'ok' : 'disconnected')));
        genesisJson($response);
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
        session_write_close();
        $provider = genesisUserProvider($user);
        $local = $provider !== 'google';
        $tasks = $local ? genesisLocalTasksForClient($user) : genesisListAllGoogleTasks($user);
        genesisJson([
            'tasks' => $tasks,
            'taskLists' => $local ? [] : genesisGoogleTaskListsForClient(),
            'syncedAt' => genesisNow(),
            'syncWarning' => $local ? null : genesisGoogleTasksSyncWarning(),
        ]);
    }

    if ($method === 'POST' && $path === 'auth/google/native/challenge') {
        genesisRequireCsrf();
        $clientId = trim((string)(genesisConfig()['google_client_id'] ?? ''));
        if ($clientId === '') {
            throw new GenesisNativeAuthException(503, 'NATIVE_AUTH_NOT_CONFIGURED');
        }
        header('Cache-Control: no-store');
        genesisJson([
            'nonce' => genesisNativeChallenge($_SESSION, time()),
            'expiresIn' => 300,
            'serverClientId' => $clientId,
        ]);
    }

    if ($method === 'POST' && $path === 'auth/google/native') {
        genesisRequireCsrf();
        header('Cache-Control: no-store');
        $now = time();
        $challenge = genesisNativeConsumeChallenge($_SESSION, $now);
        $raw = file_get_contents('php://input', false, null, 0, 20001);
        if (!is_string($raw) || strlen($raw) > 20000) {
            throw new GenesisNativeAuthException(400, 'NATIVE_AUTH_INVALID_REQUEST');
        }
        try {
            $payload = json_decode($raw, true, 4, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new GenesisNativeAuthException(400, 'NATIVE_AUTH_INVALID_REQUEST');
        }
        if (!is_array($payload) || !is_string($payload['idToken'] ?? null)) {
            throw new GenesisNativeAuthException(400, 'NATIVE_AUTH_INVALID_REQUEST');
        }
        $profile = genesisVerifyNativeGoogleToken(
            $payload['idToken'],
            trim((string)(genesisConfig()['google_client_id'] ?? '')),
            $challenge,
            $now,
            static function () use ($now): array { return genesisNativeGoogleCertificates($_SESSION, $now); },
        );
        $linkAction = genesisFindUserByGoogleSub((string)$profile['sub']) !== null
            || genesisFindLinkedGoogleAccountBySub((string)$profile['sub']) !== null
            ? 'found'
            : 'created';
        $user = genesisUpsertGoogleUser($profile, [], false);
        if (!session_regenerate_id(true)) {
            throw new GenesisNativeAuthException(503, 'NATIVE_AUTH_TEMPORARILY_UNAVAILABLE');
        }
        $_SESSION['user_id'] = (string)$user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        unset($_SESSION['oauth_request']);
        genesisObserveAndroid(static fn() => genesisReportAndroidClient((string)$user['id']));
        genesisLogError('[AuthFlow] ' . ($linkAction === 'created' ? 'GOOGLE_LINK_CREATED' : 'GOOGLE_LINK_FOUND'));
        genesisJson([
            'user' => genesisUserForClient($user),
            'csrf' => (string)$_SESSION['csrf'],
            'googleLinkAction' => $linkAction,
        ]);
    }

    if ($method === 'POST' && $path === 'auth/google/native/services/config') {
        genesisRequireCsrf();
        genesisRequireGoogleUser(genesisRequireUserId());
        $clientId = trim((string)(genesisConfig()['google_client_id'] ?? ''));
        if ($clientId === '') throw new GenesisNativeAuthException(503, 'NATIVE_AUTH_NOT_CONFIGURED');
        genesisJson(['serverClientId' => $clientId]);
    }

    if ($method === 'POST' && $path === 'auth/google/native/services') {
        genesisRequireCsrf();
        $userId = genesisRequireUserId();
        genesisRequireGoogleUser($userId);
        $payload = genesisReadJson();
        $code = is_string($payload['serverAuthCode'] ?? null) ? trim($payload['serverAuthCode']) : '';
        if ($code === '' || strlen($code) > 8192) {
            throw new InvalidArgumentException('Некорректный код авторизации Google.');
        }
        $tokens = genesisExchangeNativeGoogleCode($code);
        if (empty($tokens['access_token'])) throw new RuntimeException('Google не вернул токен доступа.');
        $profile = genesisGoogleUserInfo((string)$tokens['access_token']);
        $user = genesisPersistPrimaryGoogleAuthorization($userId, $profile, $tokens);
        $calendarWarning = null;
        if (genesisGoogleScopeGranted($user, GENESIS_GOOGLE_CALENDAR_SCOPE)) {
            try {
                $user = genesisEnsureGoogleCalendar($user);
                genesisLogError('[AuthFlow] CALENDAR_SCOPE_GRANTED');
            } catch (Throwable $calendarError) {
                $calendarWarning = 'Разрешение Calendar сохранено, но создание календаря пока не завершилось.';
                genesisLogError('[AuthFlow] CALENDAR_SCOPE_GRANTED; calendar initialization pending', $calendarError);
            }
        }
        if (genesisGoogleScopeGranted($user, GENESIS_GOOGLE_TASKS_SCOPE)) {
            genesisLogError('[AuthFlow] TASKS_SCOPE_GRANTED');
        }
        $user = genesisFindUser($userId) ?? $user;
        genesisJson([
            'user' => genesisUserForClient($user),
            'csrf' => (string)$_SESSION['csrf'],
            'syncWarning' => $calendarWarning,
        ]);
    }

    if ($method === 'GET' && $path === 'auth/yandex/start') {
        if (!genesisYandexConfigured()) genesisJson(['error' => 'YANDEX_NOT_CONFIGURED'], 503);
        $purpose = (string)($_GET['purpose'] ?? 'login') === 'link' ? 'link' : 'login';
        $linkOwner = null;
        if ($purpose === 'link') {
            $linkOwner = genesisRequireUserId();
            $owner = genesisFindUser($linkOwner);
            if ($owner === null || genesisUserProvider($owner) !== 'yandex') {
                genesisJson(['error' => 'LOCAL_ACCOUNT_REQUIRED'], 403);
            }
        }
        $returnTo = genesisSafeReturnTo((string)($_GET['return_to'] ?? '/'));
        $state = genesisBase64Url(random_bytes(32));
        $verifier = genesisBase64Url(random_bytes(64));
        $_SESSION['yandex_oauth_request'] = [
            'state' => $state,
            'verifier' => $verifier,
            'return_to' => $returnTo,
            'purpose' => $purpose,
            'owner_id' => $linkOwner,
            'issued_at' => time(),
        ];
        header('Cache-Control: no-store');
        header('Location: ' . genesisYandexAuthUrl(
            $state, genesisBase64Url(hash('sha256', $verifier, true)),
        ), true, 302);
        exit;
    }

    if ($method === 'GET' && $path === 'auth/yandex/calendar/start') {
        if (!genesisYandexConfigured()) genesisJson(['error' => 'YANDEX_NOT_CONFIGURED'], 503);
        $ownerId = genesisRequireUserId();
        $accountId = trim((string)($_GET['account_id'] ?? $ownerId));
        $member = genesisLocalMemberForOwner($ownerId, $accountId);
        if ($member === null || $member['provider'] !== 'yandex') genesisJson(['error' => 'YANDEX_ACCOUNT_REQUIRED'], 403);
        $state = genesisBase64Url(random_bytes(32));
        $verifier = genesisBase64Url(random_bytes(64));
        $_SESSION['yandex_oauth_request'] = [
            'state' => $state, 'verifier' => $verifier,
            'return_to' => genesisSafeReturnTo((string)($_GET['return_to'] ?? '/')),
            'purpose' => 'calendar', 'owner_id' => $ownerId, 'account_id' => $accountId,
            'issued_at' => time(),
        ];
        header('Cache-Control: no-store');
        header('Location: ' . genesisYandexAuthUrl(
            $state, genesisBase64Url(hash('sha256', $verifier, true)), true,
        ), true, 302);
        exit;
    }

    if ($method === 'POST' && $path === 'auth/yandex/native') {
        genesisRequireCsrf();
        if (!genesisYandexConfigured()) genesisJson(['error' => 'YANDEX_NOT_CONFIGURED'], 503);
        $payload = genesisReadJson();
        $token = is_string($payload['accessToken'] ?? null) ? trim($payload['accessToken']) : '';
        if ($token === '' || strlen($token) > 16384) genesisJson(['error' => 'INVALID_TOKEN'], 400);
        try {
            $profile = genesisYandexUserInfo($token);
            $newAccount = genesisFindUserByYandexUid((string)$profile['id']) === null;
            $user = genesisUpsertYandexUser($profile);
        } catch (DomainException $error) {
            genesisJson(['error' => 'ACCOUNT_CONFLICT'], 409);
        }
        if (!session_regenerate_id(true)) genesisJson(['error' => 'SESSION_UNAVAILABLE'], 503);
        $_SESSION['user_id'] = (string)$user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        genesisObserveAndroid(static fn() => genesisReportAndroidClient((string)$user['id']));
        genesisJson(['user' => genesisUserForClient($user), 'csrf' => (string)$_SESSION['csrf'],
            'newAccount' => $newAccount]);
    }

    if ($method === 'GET' && $path === 'auth/yandex/callback') {
        $request = $_SESSION['yandex_oauth_request'] ?? null;
        unset($_SESSION['yandex_oauth_request']);
        $state = (string)($_GET['state'] ?? '');
        if (!is_array($request) || $state === '' || !hash_equals((string)($request['state'] ?? ''), $state)
            || (int)($request['issued_at'] ?? 0) < time() - 600) {
            genesisOAuthRedirect('/', 'yandex_invalid_state');
        }
        $returnTo = genesisSafeReturnTo((string)($request['return_to'] ?? '/'));
        if (trim((string)($_GET['error'] ?? '')) !== '') {
            genesisOAuthRedirect($returnTo, ($_GET['error'] ?? '') === 'access_denied' ? 'yandex_access_denied' : 'yandex_oauth_failed');
        }
        $code = trim((string)($_GET['code'] ?? ''));
        if ($code === '' || strlen($code) > 8192) genesisOAuthRedirect($returnTo, 'yandex_oauth_failed');
        try {
            $tokens = genesisExchangeYandexCode($code, (string)($request['verifier'] ?? ''));
            $profile = genesisYandexUserInfo((string)($tokens['access_token'] ?? ''));
            if (($request['purpose'] ?? 'login') === 'calendar') {
                $ownerId = (string)($request['owner_id'] ?? '');
                $accountId = (string)($request['account_id'] ?? '');
                if ($ownerId === '' || genesisCurrentUserId() !== $ownerId
                    || genesisLocalMemberForOwner($ownerId, $accountId) === null) {
                    genesisOAuthRedirect($returnTo, 'session_expired');
                }
                genesisYandexCalendarConnectOauth($accountId, $tokens);
                genesisOAuthRedirect($returnTo);
            }
            if (($request['purpose'] ?? 'login') === 'link') {
                $ownerId = (string)($request['owner_id'] ?? '');
                if ($ownerId === '' || genesisCurrentUserId() !== $ownerId) {
                    genesisOAuthRedirect($returnTo, 'session_expired');
                }
                genesisBeginLocalLink($ownerId, 'yandex', $profile);
                genesisOAuthRedirect($returnTo);
            }
            $user = genesisUpsertYandexUser($profile);
            if (!session_regenerate_id(true)) throw new RuntimeException('Session could not be renewed.');
            $_SESSION['user_id'] = (string)$user['id'];
            $_SESSION['csrf'] = bin2hex(random_bytes(24));
        } catch (DomainException $error) {
            genesisLogError('Yandex account conflict.', $error);
            genesisOAuthRedirect($returnTo, ($request['purpose'] ?? '') === 'calendar'
                ? 'yandex_calendar_failed' : 'account_conflict');
        } catch (Throwable $error) {
            genesisLogError('Yandex OAuth callback failed.', $error);
            genesisOAuthRedirect($returnTo, ($request['purpose'] ?? '') === 'calendar'
                ? 'yandex_calendar_failed' : 'yandex_oauth_failed');
        }
        genesisOAuthRedirect($returnTo);
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
            if (genesisUserProvider($requestUser) !== 'google') genesisOAuthRedirect($returnTo, 'account_mismatch');
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

    if (($segments[0] ?? null) === 'shared') {
        $userId = genesisRequireUserId();
        if ($method !== 'GET') genesisRequireCsrf();
        if ($method === 'GET' && $path === 'shared/spaces') {
            genesisJson(['spaces' => genesisSharedSpaces($userId)]);
        }
        if ($method === 'POST' && $path === 'shared/spaces') {
            genesisJson(['space' => genesisSharedCreateSpace($userId, genesisReadJson())], 201);
        }
        if ($method === 'GET' && $path === 'shared/invitations') {
            genesisJson(['invitations' => genesisSharedInvitations($userId)]);
        }
        if ($method === 'GET' && $path === 'shared/notifications') {
            genesisJson(['notifications' => genesisSharedNotifications($userId)]);
        }
        if ($method === 'POST' && $path === 'shared/notifications/read') {
            genesisSharedReadNotifications($userId, genesisReadJson());
            genesisJson(['ok' => true]);
        }
        if ($method === 'GET' && $path === 'shared/calendar/tasks') {
            genesisJson(['tasks' => genesisSharedCalendarTasks($userId,
                (string)($_GET['from'] ?? ''), (string)($_GET['to'] ?? ''))]);
        }
        if ($method === 'POST' && $path === 'shared/invitations/accept') {
            genesisJson(genesisSharedAcceptInvite($userId, genesisReadJson()));
        }
        if ($method === 'POST' && count($segments) === 3 && $segments[1] === 'invitations'
            && $segments[2] !== 'accept') {
            genesisSharedRejectInvite($userId, $segments[2]);
            genesisJson(['ok' => true]);
        }
        if (count($segments) === 4 && $segments[1] === 'spaces' && $segments[3] === 'projects') {
            if ($method === 'GET') genesisJson(['projects' => genesisSharedProjects($userId, $segments[2])]);
            if ($method === 'POST') genesisJson(['project' => genesisSharedCreateProject($userId, $segments[2], genesisReadJson())], 201);
        }
        if (count($segments) === 4 && $segments[1] === 'spaces' && $segments[3] === 'import-project'
            && $method === 'POST') {
            genesisJson(['receipt' => genesisSharedImportProjectTree($userId, $segments[2], genesisReadJson())], 201);
        }
        if (count($segments) === 4 && $segments[1] === 'spaces' && $segments[3] === 'archived-projects'
            && $method === 'GET') {
            genesisJson(['projects' => genesisSharedArchivedProjects($userId, $segments[2])]);
        }
        if (count($segments) === 5 && $segments[1] === 'spaces' && $segments[3] === 'members'
            && in_array($method, ['PATCH', 'POST'], true)) {
            genesisSharedSetSpaceRole($userId, $segments[2], $segments[4], genesisReadJson());
            genesisJson(['ok' => true]);
        }
        if (count($segments) === 3 && $segments[1] === 'projects' && $method === 'GET') {
            genesisJson(genesisSharedProjectSnapshot($userId, $segments[2]));
        }
        if (count($segments) === 4 && $segments[1] === 'projects' && $segments[3] === 'google') {
            if ($method === 'GET') genesisJson(['settings' => genesisSharedGoogleSettings($userId, $segments[2])]);
            if (in_array($method, ['PATCH', 'POST'], true)) genesisJson(['settings' => genesisSharedSetGoogleSettings($userId, $segments[2], genesisReadJson())]);
        }
        if (count($segments) === 5 && $segments[1] === 'projects' && $segments[3] === 'google'
            && $segments[4] === 'sync' && $method === 'POST') {
            genesisJson(genesisSharedSyncGoogle($userId, $segments[2]));
        }
        if (count($segments) === 3 && $segments[1] === 'projects' && in_array($method, ['PATCH', 'POST'], true)) {
            genesisJson(['project' => genesisSharedUpdateProject($userId, $segments[2], genesisReadJson())]);
        }
        if (count($segments) === 4 && $segments[1] === 'projects'
            && in_array($segments[3], ['archive', 'restore'], true) && $method === 'POST') {
            genesisSharedSetArchived($userId, $segments[2], $segments[3] === 'archive');
            genesisJson(['ok' => true]);
        }
        if (count($segments) === 4 && $segments[1] === 'projects' && $segments[3] === 'statuses'
            && $method === 'POST') {
            genesisJson(['status' => genesisSharedCreateStatus($userId, $segments[2], genesisReadJson())], 201);
        }
        if (count($segments) === 5 && $segments[1] === 'projects' && $segments[3] === 'statuses') {
            if (in_array($method, ['PATCH', 'POST'], true)) {
                genesisJson(['status' => genesisSharedUpdateStatus($userId, $segments[2], $segments[4], genesisReadJson())]);
            }
            if ($method === 'DELETE') {
                genesisSharedDeleteStatus($userId, $segments[2], $segments[4], genesisReadJson());
                genesisJson(['ok' => true]);
            }
        }
        if (count($segments) === 4 && $segments[1] === 'projects' && $segments[3] === 'categories'
            && $method === 'POST') {
            genesisJson(['category' => genesisSharedCreateCategory($userId, $segments[2], genesisReadJson())], 201);
        }
        if (count($segments) === 5 && $segments[1] === 'projects' && $segments[3] === 'categories') {
            if (in_array($method, ['PATCH', 'POST'], true)) {
                genesisJson(['category' => genesisSharedUpdateCategory($userId, $segments[2], $segments[4], genesisReadJson())]);
            }
            if ($method === 'DELETE') {
                genesisSharedDeleteCategory($userId, $segments[2], $segments[4], genesisReadJson());
                genesisJson(['ok' => true]);
            }
        }
        if (count($segments) === 5 && $segments[1] === 'projects' && $segments[3] === 'members') {
            if (in_array($method, ['PATCH', 'POST'], true)) {
                genesisSharedSetMemberRole($userId, $segments[2], $segments[4], genesisReadJson());
                genesisJson(['ok' => true]);
            }
            if ($method === 'DELETE') {
                genesisSharedRemoveMember($userId, $segments[2], $segments[4]);
                genesisJson(['ok' => true]);
            }
        }
        if (count($segments) === 4 && $segments[1] === 'projects' && $segments[3] === 'invitations'
            && $method === 'POST') {
            genesisJson(['invitation' => genesisSharedInvite($userId, $segments[2], genesisReadJson())], 201);
        }
        if (count($segments) === 4 && $segments[1] === 'projects' && $segments[3] === 'tasks'
            && $method === 'POST') {
            genesisJson(['task' => genesisSharedTask($userId, $segments[2], genesisReadJson())], 201);
        }
        if (count($segments) === 5 && $segments[1] === 'projects' && $segments[3] === 'tasks'
            && in_array($method, ['PATCH', 'POST'], true)) {
            genesisJson(['task' => genesisSharedTask($userId, $segments[2], genesisReadJson(), $segments[4])]);
        }
        if (count($segments) === 6 && $segments[1] === 'projects' && $segments[3] === 'tasks'
            && $segments[5] === 'move' && $method === 'POST') {
            genesisJson(['task' => genesisSharedMoveTask($userId, $segments[2], $segments[4], genesisReadJson())]);
        }
        if (count($segments) === 6 && $segments[1] === 'projects' && $segments[3] === 'tasks'
            && $segments[5] === 'comments') {
            if ($method === 'GET') genesisJson(['comments' => genesisSharedComments($userId, $segments[2], $segments[4])]);
            if ($method === 'POST') genesisJson(['comment' => genesisSharedAddComment($userId, $segments[2], $segments[4], genesisReadJson())], 201);
        }
    }

    if ($method === 'GET' && $path === 'workspace') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null) {
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        genesisJson(['workspace' => genesisWorkspaceForClient($user)]);
    }

    if ($method === 'PUT' && $path === 'workspace') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $payload = genesisReadJson();
        $saved = genesisSaveWorkspaceEnvelope($userId, $payload);
        // Encrypted-only native writes omit aggregate metrics. Keep the last
        // complete web census instead of accidentally resetting it to zero.
        if (array_key_exists('metrics', $payload)) {
            genesisSaveMetrics($userId, $payload);
        }
        genesisJson(['ok' => true, 'workspace' => $saved]);
    }

    if ($method === 'PUT' && $path === 'workspace/key') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisJson(['ok' => true, 'workspace' => genesisSaveClientWorkspaceKey($userId, genesisReadJson())]);
    }

    if ($method === 'POST' && $path === 'metrics') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisSaveMetrics($userId, genesisReadJson());
        genesisJson(['ok' => true]);
    }

    if ($method === 'POST' && $path === 'task-lists') {
        $userId = genesisRequireUserId();
        genesisRequireGoogleUser($userId);
        genesisRequireCsrf();
        $payload = genesisReadJson();
        genesisJson(['taskList' => genesisCreateGoogleTaskList($userId, (string)($payload['title'] ?? ''), isset($payload['accountId']) ? (string)$payload['accountId'] : null)]);
    }

    if (count($segments) === 2 && $segments[0] === 'task-lists') {
        $userId = genesisRequireUserId();
        genesisRequireGoogleUser($userId);
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

    if ($path === 'admin/ads' || (count($segments) === 3 && $segments[0] === 'admin'
        && $segments[1] === 'ads')) {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null) genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        genesisRequireAdmin($user);
        if ($method === 'GET' && $path === 'admin/ads') genesisJson(['ads' => genesisAdList()]);
        genesisRequireCsrf();
        if ($method === 'POST' && $path === 'admin/ads') genesisJson(['ad' => genesisSaveAd(genesisReadJson())], 201);
        if (count($segments) === 3 && preg_match('/^[a-f0-9-]{36}$/', $segments[2])) {
            if ($method === 'PUT') genesisJson(['ad' => genesisSaveAd(genesisReadJson(), $segments[2])]);
            if ($method === 'DELETE') {
                genesisDeleteAd($segments[2]);
                genesisJson(['deleted' => true]);
            }
        }
        genesisJson(['error' => 'NOT_FOUND'], 404);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'users') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $user = genesisFindUser($userId);
        if ($user === null) {
            genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        }
        genesisRequireAdmin($user);
        $targetUserId = mb_substr(trim((string)$segments[2]), 0, 100);
        if ($targetUserId === '') {
            throw new InvalidArgumentException('Не указан пользователь для удаления.');
        }
        $payload = genesisReadJson();
        genesisJson(genesisAdminDeleteUser($userId, $targetUserId, ($payload['blacklist'] ?? false) === true));
    }

    if ($method === 'DELETE' && $path === 'account') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisDeleteAccount($userId);
        genesisFinishSession(['ok' => true, 'deleted' => true]);
    }

    if ($method === 'GET' && $path === 'account/local-link/pending') {
        $userId = genesisRequireUserId();
        header('Cache-Control: no-store');
        genesisJson(['pending' => genesisPendingLocalLink($userId)]);
    }

    if ($method === 'POST' && $path === 'account/local-link/commit') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisJson(['user' => genesisUserForClient(genesisCommitLocalLink($userId, genesisReadJson()))]);
    }

    if ($method === 'POST' && $path === 'account/local-link/cancel') {
        genesisRequireUserId();
        genesisRequireCsrf();
        unset($_SESSION['pending_local_link']);
        genesisJson(['ok' => true]);
    }

    if ($method === 'POST' && $path === 'account/google-services/disconnect') {
        $userId = genesisRequireUserId();
        genesisRequireGoogleUser($userId);
        genesisRequireCsrf();
        $user = genesisDisconnectGoogleServices($userId);
        genesisJson(['user' => genesisUserForClient($user)]);
    }

    if ($method === 'POST' && $path === 'account/yandex-calendar/connect') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null || genesisUserProvider($user) !== 'yandex') genesisJson(['error' => 'LOCAL_ACCOUNT_REQUIRED'], 403);
        genesisRequireCsrf();
        $payload = genesisReadJson();
        $accountId = trim((string)($payload['accountId'] ?? $userId));
        $member = genesisLocalMemberForOwner($userId, $accountId);
        if ($member === null || $member['provider'] !== 'yandex') genesisJson(['error' => 'YANDEX_ACCOUNT_REQUIRED'], 403);
        genesisYandexCalendarConnectOauth($accountId, [
            'access_token' => is_string($payload['accessToken'] ?? null) ? $payload['accessToken'] : '',
            'expires_in' => max(0, min(31536000, (int)($payload['expiresIn'] ?? 0))),
        ]);
        genesisJson(['user' => genesisUserForClient($user)]);
    }

    if ($method === 'POST' && $path === 'account/yandex-calendar/disconnect') {
        $userId = genesisRequireUserId();
        $user = genesisFindUser($userId);
        if ($user === null || genesisUserProvider($user) !== 'yandex') genesisJson(['error' => 'LOCAL_ACCOUNT_REQUIRED'], 403);
        genesisRequireCsrf();
        $payload = genesisReadJson();
        $accountId = trim((string)($payload['accountId'] ?? $userId));
        $member = genesisLocalMemberForOwner($userId, $accountId);
        if ($member === null || $member['provider'] !== 'yandex') genesisJson(['error' => 'YANDEX_ACCOUNT_REQUIRED'], 403);
        genesisYandexCalendarDisconnect($accountId);
        genesisJson(['user' => genesisUserForClient($user)]);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'account' && $segments[1] === 'google-accounts') {
        $userId = genesisRequireUserId();
        genesisRequireGoogleUser($userId);
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
        $user = genesisFindUser($userId);
        if ($user === null) genesisJson(['error' => 'AUTH_REQUIRED'], 401);
        genesisRequireCsrf();
        $id = mb_substr((string)$segments[1], 0, 100);
        if ($id === '') {
            throw new InvalidArgumentException('Task identifier is required.');
        }
        if ($method === 'PUT') {
            $task = genesisReadJson();
            genesisJson(['task' => genesisUserProvider($user) === 'google'
                ? genesisSyncTaskToGoogle($userId, $id, $task)
                : genesisSyncTaskToLocalGroup($user, $id, $task)]);
        }
        if ($method === 'DELETE') {
            if (genesisUserProvider($user) === 'google') genesisDeleteGoogleTaskEvent($userId, $id, genesisReadJson());
            else genesisDeleteTaskFromLocalGroup($user, $id);
            genesisJson(['ok' => true]);
        }
    }

    genesisJson(['error' => 'NOT_FOUND'], 404);
} catch (GenesisSharedAccessException $error) {
    genesisJson(['error' => $error->getMessage()], $error->status);
} catch (GenesisNativeAuthException $error) {
    header('Cache-Control: no-store');
    if ($error->status === 429) {
        header('Retry-After: 60');
    }
    genesisJson(['error' => $error->getMessage()], $error->status);
} catch (GenesisWorkspaceConflictException $error) {
    genesisJson(['error' => $error->getMessage(), 'currentVersion' => $error->currentVersion], 409);
} catch (DomainException $error) {
    genesisJson(['error' => $error->getMessage()], 409);
} catch (JsonException | InvalidArgumentException $error) {
    genesisJson(['error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    genesisLogError($error->getMessage(), $error);
    genesisJson(['error' => 'Server error. Please try again.'], 500);
}
