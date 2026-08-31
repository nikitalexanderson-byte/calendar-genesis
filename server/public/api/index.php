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
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = trim((string)($_GET['path'] ?? $_SERVER['PATH_INFO'] ?? ''), '/');
$segments = $path === '' ? [] : explode('/', $path);

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($method === 'GET' && $path === 'health') {
        genesisJson(['ok' => true, 'service' => 'GENESIS', 'time' => genesisNow()]);
    }

    if ($method === 'GET' && $path === 'session') {
        $userId = genesisCurrentUserId();
        $user = $userId ? genesisFindUser($userId) : null;
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
        genesisJson([
            'user' => genesisUserForClient($user),
            'csrf' => (string)$_SESSION['csrf'],
            'tasks' => genesisTasksForUser($userId),
            'projects' => genesisProjectsForUser($userId),
            'categories' => genesisCategoriesForUser($userId),
        ]);
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
        $verifier = (string)($_SESSION['oauth_verifier'] ?? '');
        $tokens = genesisExchangeGoogleCode($code, $verifier);
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

    if ($method === 'POST' && $path === 'auth/logout') {
        genesisRequireCsrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
        }
        session_destroy();
        genesisJson(['ok' => true]);
    }

    if ($method === 'POST' && $path === 'tasks/import') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $payload = genesisReadJson();
        $tasks = is_array($payload['tasks'] ?? null) ? array_slice($payload['tasks'], 0, 5000) : [];
        foreach ($tasks as $task) {
            if (!is_array($task) || empty($task['id'])) {
                continue;
            }
            $id = mb_substr((string)$task['id'], 0, 100);
            genesisSaveTask($userId, $id, $task);
            try {
                genesisSyncTaskToGoogle($userId, $id);
            } catch (Throwable $syncError) {
                // Local data import remains authoritative even if Google is temporarily unavailable.
            }
        }
        genesisJson(['ok' => true]);
    }

    if ($method === 'POST' && $path === 'workspace/import') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        genesisJson(['ok' => true, 'imported' => genesisImportWorkspace($userId, genesisReadJson())]);
    }

    if (count($segments) === 2 && $segments[0] === 'tasks') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $id = mb_substr((string)$segments[1], 0, 100);
        if ($method === 'PUT') {
            $db = genesisDb();
            $beforeStatement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id');
            $beforeStatement->execute(['id' => $id, 'user_id' => $userId]);
            $before = $beforeStatement->fetch();
            $task = genesisSaveTask($userId, $id, genesisReadJson());
            $afterStatement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id');
            $afterStatement->execute(['id' => $id, 'user_id' => $userId]);
            $after = $afterStatement->fetch();
            try {
                genesisSyncTaskToGoogle($userId, $id);
            } catch (Throwable $syncError) {
                $task['syncWarning'] = $syncError->getMessage();
            }
            if (is_array($after) && empty($before['done']) && !empty($after['done']) && $after['recurrence'] !== 'none') {
                $next = genesisSpawnNextOccurrence($userId, $after);
                if (is_array($next)) {
                    try {
                        genesisSyncTaskToGoogle($userId, (string)$next['id']);
                    } catch (Throwable $syncError) {
                        // The next occurrence remains queued in GENESIS.
                    }
                }
            }
            genesisJson(['task' => $task]);
        }
        if ($method === 'DELETE') {
            $task = genesisDeleteTask($userId, $id);
            if ($task) {
                try {
                    genesisDeleteGoogleTaskEvent($userId, $task);
                } catch (Throwable $syncError) {
                    // Deletion in GENESIS must not be blocked by a temporary Google error.
                }
            }
            genesisJson(['ok' => true]);
        }
    }

    if (count($segments) === 2 && $segments[0] === 'projects') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $id = mb_substr((string)$segments[1], 0, 100);
        if ($method === 'PUT') {
            genesisJson(['project' => genesisSaveProject($userId, $id, genesisReadJson())]);
        }
        if ($method === 'DELETE') {
            genesisDb()->prepare('DELETE FROM projects WHERE id = :id AND user_id = :user_id')->execute(['id' => $id, 'user_id' => $userId]);
            genesisJson(['ok' => true]);
        }
    }

    if (count($segments) === 2 && $segments[0] === 'categories' && $method === 'PUT') {
        $userId = genesisRequireUserId();
        genesisRequireCsrf();
        $id = mb_substr((string)$segments[1], 0, 100);
        genesisJson(['category' => genesisSaveCategory($userId, $id, genesisReadJson())]);
    }

    genesisJson(['error' => 'NOT_FOUND'], 404);
} catch (JsonException | InvalidArgumentException $error) {
    genesisJson(['error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    error_log('[GENESIS] ' . $error->getMessage());
    genesisJson(['error' => 'Server error. Please try again.'], 500);
}
