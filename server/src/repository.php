<?php
declare(strict_types=1);

function genesisDecodeList(?string $json): array
{
    $value = json_decode($json ?: '[]', true);
    return is_array($value) ? array_values(array_filter($value, 'is_string')) : [];
}

function genesisCleanTags(mixed $tags, int $limit = 10): array
{
    if (!is_array($tags)) {
        return [];
    }
    $result = [];
    foreach ($tags as $tag) {
        if (!is_string($tag)) {
            continue;
        }
        $tag = mb_substr(trim(ltrim($tag, '#')), 0, 40);
        if ($tag !== '' && !in_array($tag, $result, true)) {
            $result[] = $tag;
        }
        if (count($result) >= $limit) {
            break;
        }
    }
    return $result;
}

function genesisUserForClient(array $user): array
{
    return [
        'uid' => (string)$user['id'],
        'displayName' => (string)$user['display_name'],
        'email' => (string)$user['email'],
        'photoURL' => $user['avatar_url'] ?: null,
        'calendarConnected' => !empty($user['google_calendar_id']) && !empty($user['refresh_token_enc']),
    ];
}

function genesisFindUser(string $userId): ?array
{
    $statement = genesisDb()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();
    return is_array($user) ? $user : null;
}

function genesisUpsertGoogleUser(array $profile, array $tokens): array
{
    $db = genesisDb();
    $statement = $db->prepare('SELECT * FROM users WHERE google_sub = :sub LIMIT 1');
    $statement->execute(['sub' => (string)$profile['sub']]);
    $existing = $statement->fetch();
    $now = genesisNow();
    $id = is_array($existing) ? (string)$existing['id'] : genesisUuid();
    $refresh = isset($tokens['refresh_token']) && is_string($tokens['refresh_token'])
        ? genesisEncrypt($tokens['refresh_token'])
        : ($existing['refresh_token_enc'] ?? null);
    $access = isset($tokens['access_token']) && is_string($tokens['access_token'])
        ? genesisEncrypt($tokens['access_token'])
        : ($existing['access_token_enc'] ?? null);
    $expiresAt = time() + genesisClampInt($tokens['expires_in'] ?? 3600, 60, 86400, 3600) - 60;
    $scopes = (string)($tokens['scope'] ?? ($existing['granted_scopes'] ?? ''));

    $sql = 'INSERT INTO users (
                id, google_sub, email, display_name, avatar_url, access_token_enc,
                refresh_token_enc, token_expires_at, granted_scopes, created_at, updated_at
            ) VALUES (
                :id, :sub, :email, :display_name, :avatar_url, :access_token_enc,
                :refresh_token_enc, :token_expires_at, :granted_scopes, :created_at, :updated_at
            ) ON CONFLICT(google_sub) DO UPDATE SET
                email = excluded.email,
                display_name = excluded.display_name,
                avatar_url = excluded.avatar_url,
                access_token_enc = excluded.access_token_enc,
                refresh_token_enc = COALESCE(excluded.refresh_token_enc, users.refresh_token_enc),
                token_expires_at = excluded.token_expires_at,
                granted_scopes = excluded.granted_scopes,
                updated_at = excluded.updated_at';
    $db->prepare($sql)->execute([
        'id' => $id,
        'sub' => (string)$profile['sub'],
        'email' => mb_substr((string)$profile['email'], 0, 320),
        'display_name' => mb_substr((string)($profile['name'] ?? $profile['email']), 0, 160),
        'avatar_url' => isset($profile['picture']) ? mb_substr((string)$profile['picture'], 0, 1000) : null,
        'access_token_enc' => $access,
        'refresh_token_enc' => $refresh,
        'token_expires_at' => $expiresAt,
        'granted_scopes' => $scopes,
        'created_at' => is_array($existing) ? (string)$existing['created_at'] : $now,
        'updated_at' => $now,
    ]);

    genesisSeedCategories($id);
    $user = genesisFindUser($id);
    if ($user === null) {
        throw new RuntimeException('User profile could not be saved.');
    }
    return $user;
}

function genesisSeedCategories(string $userId): void
{
    $db = genesisDb();
    $count = $db->prepare('SELECT COUNT(*) FROM categories WHERE user_id = :user_id');
    $count->execute(['user_id' => $userId]);
    if ((int)$count->fetchColumn() > 0) {
        return;
    }
    $insert = $db->prepare('INSERT INTO categories (id, user_id, name, color, position, created_at, updated_at) VALUES (:id, :user_id, :name, :color, :position, :created_at, :updated_at)');
    $now = genesisNow();
    foreach ([
        ['Личное', '#a5543f'],
        ['Работа', '#2d6c68'],
        ['Тело и здоровье', '#b18b48'],
    ] as $position => [$name, $color]) {
        $insert->execute([
            'id' => genesisUuid(),
            'user_id' => $userId,
            'name' => $name,
            'color' => $color,
            'position' => $position,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}

function genesisTaskForClient(array $task, array $links = []): array
{
    return [
        'id' => (string)$task['id'],
        'sacredYear' => (int)$task['sacred_year'],
        'monthIndex' => (int)$task['month_index'],
        'day' => (int)$task['sacred_day'],
        'dueDate' => (string)$task['due_date'],
        'title' => (string)$task['title'],
        'description' => (string)$task['description'],
        'time' => (string)$task['time_value'],
        'project' => (string)$task['project_label'],
        'projectId' => $task['project_id'] ?: null,
        'categoryId' => $task['category_id'] ?: null,
        'tags' => genesisDecodeList($task['tags_json'] ?? null),
        'dependsOnIds' => $links[(string)$task['id']] ?? [],
        'done' => (bool)$task['done'],
        'completedAt' => $task['completed_at'] ?: null,
        'reminderMinutes' => $task['reminder_minutes'] !== null ? (int)$task['reminder_minutes'] : null,
        'recurrence' => (string)$task['recurrence'],
        'recurrenceInterval' => (int)$task['recurrence_interval'],
        'syncToGoogle' => (bool)$task['sync_to_google'],
        'googleEventId' => $task['google_event_id'] ?: null,
        'updatedAt' => strtotime((string)$task['updated_at']) * 1000,
    ];
}

function genesisTasksForUser(string $userId): array
{
    $statement = genesisDb()->prepare('SELECT * FROM tasks WHERE user_id = :user_id ORDER BY due_date, time_value, created_at');
    $statement->execute(['user_id' => $userId]);
    $tasks = $statement->fetchAll();
    $linkStatement = genesisDb()->prepare('SELECT task_id, depends_on_task_id FROM task_links WHERE user_id = :user_id');
    $linkStatement->execute(['user_id' => $userId]);
    $links = [];
    foreach ($linkStatement->fetchAll() as $link) {
        $links[(string)$link['task_id']][] = (string)$link['depends_on_task_id'];
    }
    return array_map(static fn(array $task): array => genesisTaskForClient($task, $links), $tasks);
}

function genesisProjectsForUser(string $userId): array
{
    $statement = genesisDb()->prepare('SELECT * FROM projects WHERE user_id = :user_id ORDER BY position, title');
    $statement->execute(['user_id' => $userId]);
    return array_map(static fn(array $project): array => [
        'id' => (string)$project['id'],
        'parentId' => $project['parent_id'] ?: null,
        'categoryId' => $project['category_id'] ?: null,
        'title' => (string)$project['title'],
        'description' => (string)$project['description'],
        'tags' => genesisDecodeList($project['tags_json'] ?? null),
        'status' => (string)$project['status'],
        'position' => (int)$project['position'],
    ], $statement->fetchAll());
}

function genesisCategoriesForUser(string $userId): array
{
    genesisSeedCategories($userId);
    $statement = genesisDb()->prepare('SELECT * FROM categories WHERE user_id = :user_id ORDER BY position, name');
    $statement->execute(['user_id' => $userId]);
    return array_map(static fn(array $category): array => [
        'id' => (string)$category['id'],
        'name' => (string)$category['name'],
        'color' => (string)$category['color'],
        'position' => (int)$category['position'],
    ], $statement->fetchAll());
}

function genesisSaveCategory(string $userId, string $id, array $payload): array
{
    genesisAssertWritableId('categories', $userId, $id);
    $name = mb_substr(trim((string)($payload['name'] ?? '')), 0, 120);
    if ($name === '') {
        throw new InvalidArgumentException('Category name is required.');
    }
    $color = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($payload['color'] ?? '')) ? (string)$payload['color'] : '#2d6c68';
    $now = genesisNow();
    genesisDb()->prepare('INSERT INTO categories (id, user_id, name, color, position, created_at, updated_at) VALUES (:id, :user_id, :name, :color, :position, :created_at, :updated_at) ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, position = excluded.position, updated_at = excluded.updated_at WHERE categories.user_id = excluded.user_id')->execute([
        'id' => $id,
        'user_id' => $userId,
        'name' => $name,
        'color' => $color,
        'position' => genesisClampInt($payload['position'] ?? 0, 0, 100000, 0),
        'created_at' => $now,
        'updated_at' => $now,
    ]);
    return ['id' => $id, 'name' => $name, 'color' => $color, 'position' => (int)($payload['position'] ?? 0)];
}

function genesisAssertWritableId(string $table, string $userId, string $id): void
{
    if (!in_array($table, ['categories', 'projects', 'tasks'], true)) {
        throw new InvalidArgumentException('Unsupported table.');
    }
    $statement = genesisDb()->prepare("SELECT user_id FROM {$table} WHERE id = :id LIMIT 1");
    $statement->execute(['id' => $id]);
    $owner = $statement->fetchColumn();
    if ($owner !== false && (string)$owner !== $userId) {
        throw new RuntimeException('Resource identifier is already in use.');
    }
}

function genesisOwnedReference(string $table, string $userId, mixed $requested): ?string
{
    if (!in_array($table, ['categories', 'projects'], true) || !is_string($requested) || trim($requested) === '') {
        return null;
    }
    $statement = genesisDb()->prepare("SELECT id FROM {$table} WHERE id = :id AND user_id = :user_id LIMIT 1");
    $statement->execute(['id' => $requested, 'user_id' => $userId]);
    $id = $statement->fetchColumn();
    return $id === false ? null : (string)$id;
}

function genesisSaveProject(string $userId, string $id, array $payload): array
{
    genesisAssertWritableId('projects', $userId, $id);
    $title = mb_substr(trim((string)($payload['title'] ?? '')), 0, 300);
    if ($title === '') {
        throw new InvalidArgumentException('Project title is required.');
    }
    $parentId = ($payload['parentId'] ?? null) !== $id
        ? genesisOwnedReference('projects', $userId, $payload['parentId'] ?? null)
        : null;
    $categoryId = genesisOwnedReference('categories', $userId, $payload['categoryId'] ?? null);
    $status = in_array($payload['status'] ?? '', ['active', 'completed', 'archived'], true) ? (string)$payload['status'] : 'active';
    $now = genesisNow();
    genesisDb()->prepare('INSERT INTO projects (id, user_id, parent_id, category_id, title, description, tags_json, status, position, created_at, updated_at) VALUES (:id, :user_id, :parent_id, :category_id, :title, :description, :tags_json, :status, :position, :created_at, :updated_at) ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, category_id = excluded.category_id, title = excluded.title, description = excluded.description, tags_json = excluded.tags_json, status = excluded.status, position = excluded.position, updated_at = excluded.updated_at WHERE projects.user_id = excluded.user_id')->execute([
        'id' => $id,
        'user_id' => $userId,
        'parent_id' => $parentId,
        'category_id' => $categoryId,
        'title' => $title,
        'description' => mb_substr((string)($payload['description'] ?? ''), 0, 5000),
        'tags_json' => json_encode(genesisCleanTags($payload['tags'] ?? []), JSON_UNESCAPED_UNICODE),
        'status' => $status,
        'position' => genesisClampInt($payload['position'] ?? 0, 0, 100000, 0),
        'created_at' => $now,
        'updated_at' => $now,
    ]);
    $projects = array_filter(genesisProjectsForUser($userId), static fn(array $project): bool => $project['id'] === $id);
    return array_values($projects)[0] ?? [];
}

function genesisSaveTask(string $userId, string $id, array $payload): array
{
    genesisAssertWritableId('tasks', $userId, $id);
    $title = mb_substr(trim((string)($payload['title'] ?? '')), 0, 500);
    if ($title === '') {
        throw new InvalidArgumentException('Task title is required.');
    }
    $dueDate = (string)($payload['dueDate'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        $dueDate = date('Y-m-d');
    }
    $timeValue = preg_match('/^\d{2}:\d{2}$/', (string)($payload['time'] ?? '')) ? (string)$payload['time'] : '';
    $recurrence = in_array($payload['recurrence'] ?? '', ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'], true) ? (string)$payload['recurrence'] : 'none';
    $done = !empty($payload['done']);
    $projectId = genesisOwnedReference('projects', $userId, $payload['projectId'] ?? null);
    $categoryId = genesisOwnedReference('categories', $userId, $payload['categoryId'] ?? null);
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO tasks (id, user_id, project_id, category_id, sacred_year, month_index, sacred_day, due_date, title, description, time_value, project_label, tags_json, done, completed_at, reminder_minutes, recurrence, recurrence_interval, sync_to_google, google_event_id, created_at, updated_at) VALUES (:id, :user_id, :project_id, :category_id, :sacred_year, :month_index, :sacred_day, :due_date, :title, :description, :time_value, :project_label, :tags_json, :done, :completed_at, :reminder_minutes, :recurrence, :recurrence_interval, :sync_to_google, :google_event_id, :created_at, :updated_at) ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, category_id = excluded.category_id, sacred_year = excluded.sacred_year, month_index = excluded.month_index, sacred_day = excluded.sacred_day, due_date = excluded.due_date, title = excluded.title, description = excluded.description, time_value = excluded.time_value, project_label = excluded.project_label, tags_json = excluded.tags_json, done = excluded.done, completed_at = excluded.completed_at, reminder_minutes = excluded.reminder_minutes, recurrence = excluded.recurrence, recurrence_interval = excluded.recurrence_interval, sync_to_google = excluded.sync_to_google, google_event_id = COALESCE(excluded.google_event_id, tasks.google_event_id), updated_at = excluded.updated_at WHERE tasks.user_id = excluded.user_id')->execute([
            'id' => $id,
            'user_id' => $userId,
            'project_id' => $projectId,
            'category_id' => $categoryId,
            'sacred_year' => genesisClampInt($payload['sacredYear'] ?? date('Y'), 1900, 2500, (int)date('Y')),
            'month_index' => genesisClampInt($payload['monthIndex'] ?? 0, 0, 12, 0),
            'sacred_day' => genesisClampInt($payload['day'] ?? 1, 1, 30, 1),
            'due_date' => $dueDate,
            'title' => $title,
            'description' => mb_substr((string)($payload['description'] ?? ''), 0, 10000),
            'time_value' => $timeValue,
            'project_label' => mb_substr((string)($payload['project'] ?? ''), 0, 300),
            'tags_json' => json_encode(genesisCleanTags($payload['tags'] ?? [], 6), JSON_UNESCAPED_UNICODE),
            'done' => $done ? 1 : 0,
            'completed_at' => $done ? ((string)($payload['completedAt'] ?? '') ?: $now) : null,
            'reminder_minutes' => isset($payload['reminderMinutes']) && $payload['reminderMinutes'] !== null ? genesisClampInt($payload['reminderMinutes'], 0, 40320, 30) : null,
            'recurrence' => $recurrence,
            'recurrence_interval' => genesisClampInt($payload['recurrenceInterval'] ?? 1, 1, 99, 1),
            'sync_to_google' => !empty($payload['syncToGoogle']) ? 1 : 0,
            'google_event_id' => !empty($payload['googleEventId']) ? (string)$payload['googleEventId'] : null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $db->prepare('DELETE FROM task_links WHERE user_id = :user_id AND task_id = :task_id')->execute(['user_id' => $userId, 'task_id' => $id]);
        $linkInsert = $db->prepare('INSERT OR IGNORE INTO task_links (user_id, task_id, depends_on_task_id, created_at) SELECT :user_id, :task_id, id, :created_at FROM tasks WHERE id = :depends_on AND user_id = :user_id_check');
        foreach (array_slice(array_values(array_filter($payload['dependsOnIds'] ?? [], 'is_string')), 0, 20) as $dependsOn) {
            if ($dependsOn === $id) {
                continue;
            }
            $linkInsert->execute([
                'user_id' => $userId,
                'task_id' => $id,
                'created_at' => $now,
                'depends_on' => $dependsOn,
                'user_id_check' => $userId,
            ]);
        }
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    $statement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id');
    $statement->execute(['id' => $id, 'user_id' => $userId]);
    $task = $statement->fetch();
    return genesisTaskForClient($task, [$id => array_values(array_filter($payload['dependsOnIds'] ?? [], 'is_string'))]);
}

function genesisImportedId(string $table, string $userId, string $requested): string
{
    if (!in_array($table, ['categories', 'projects', 'tasks'], true)) {
        throw new InvalidArgumentException('Unsupported import table.');
    }
    $requested = mb_substr(trim($requested), 0, 100);
    if ($requested === '') {
        return genesisUuid();
    }
    $statement = genesisDb()->prepare("SELECT user_id FROM {$table} WHERE id = :id LIMIT 1");
    $statement->execute(['id' => $requested]);
    $owner = $statement->fetchColumn();
    return $owner === false || (string)$owner === $userId ? $requested : genesisUuid();
}

function genesisImportWorkspace(string $userId, array $payload): array
{
    $incomingCategories = is_array($payload['categories'] ?? null) ? array_slice($payload['categories'], 0, 200) : [];
    $incomingProjects = is_array($payload['projects'] ?? null) ? array_slice($payload['projects'], 0, 2000) : [];
    $incomingTasks = is_array($payload['tasks'] ?? null) ? array_slice($payload['tasks'], 0, 5000) : [];

    $categoryMap = [];
    $existingByName = [];
    foreach (genesisCategoriesForUser($userId) as $category) {
        $existingByName[mb_strtolower(trim((string)$category['name']))] = (string)$category['id'];
    }
    foreach ($incomingCategories as $category) {
        if (!is_array($category) || trim((string)($category['name'] ?? '')) === '') {
            continue;
        }
        $oldId = (string)($category['id'] ?? '');
        $nameKey = mb_strtolower(trim((string)$category['name']));
        $newId = $existingByName[$nameKey] ?? genesisImportedId('categories', $userId, $oldId);
        if (!isset($existingByName[$nameKey])) {
            genesisSaveCategory($userId, $newId, $category);
            $existingByName[$nameKey] = $newId;
        }
        if ($oldId !== '') {
            $categoryMap[$oldId] = $newId;
        }
    }

    $projectMap = [];
    foreach ($incomingProjects as $project) {
        if (is_array($project) && trim((string)($project['title'] ?? '')) !== '') {
            $oldId = (string)($project['id'] ?? '');
            if ($oldId !== '') {
                $projectMap[$oldId] = genesisImportedId('projects', $userId, $oldId);
            }
        }
    }
    $remaining = array_values(array_filter($incomingProjects, 'is_array'));
    $savedProjects = [];
    while ($remaining !== []) {
        $nextRemaining = [];
        $savedThisPass = 0;
        foreach ($remaining as $project) {
            $oldId = (string)($project['id'] ?? '');
            if ($oldId === '' || !isset($projectMap[$oldId])) {
                continue;
            }
            $oldParent = !empty($project['parentId']) ? (string)$project['parentId'] : null;
            if ($oldParent !== null && isset($projectMap[$oldParent]) && !isset($savedProjects[$oldParent])) {
                $nextRemaining[] = $project;
                continue;
            }
            $project['parentId'] = $oldParent !== null ? ($projectMap[$oldParent] ?? null) : null;
            $oldCategory = !empty($project['categoryId']) ? (string)$project['categoryId'] : '';
            $project['categoryId'] = $categoryMap[$oldCategory] ?? null;
            genesisSaveProject($userId, $projectMap[$oldId], $project);
            $savedProjects[$oldId] = true;
            $savedThisPass++;
        }
        if ($savedThisPass === 0) {
            foreach ($nextRemaining as $project) {
                $oldId = (string)($project['id'] ?? '');
                $project['parentId'] = null;
                $oldCategory = !empty($project['categoryId']) ? (string)$project['categoryId'] : '';
                $project['categoryId'] = $categoryMap[$oldCategory] ?? null;
                genesisSaveProject($userId, $projectMap[$oldId], $project);
                $savedProjects[$oldId] = true;
            }
            break;
        }
        $remaining = $nextRemaining;
    }

    $taskMap = [];
    foreach ($incomingTasks as $task) {
        if (is_array($task) && trim((string)($task['title'] ?? '')) !== '') {
            $oldId = (string)($task['id'] ?? '');
            if ($oldId !== '') {
                $taskMap[$oldId] = genesisImportedId('tasks', $userId, $oldId);
            }
        }
    }
    $savedTasks = 0;
    foreach ($incomingTasks as $task) {
        if (!is_array($task)) {
            continue;
        }
        $oldId = (string)($task['id'] ?? '');
        if ($oldId === '' || !isset($taskMap[$oldId])) {
            continue;
        }
        $oldProject = !empty($task['projectId']) ? (string)$task['projectId'] : '';
        $oldCategory = !empty($task['categoryId']) ? (string)$task['categoryId'] : '';
        $task['projectId'] = $projectMap[$oldProject] ?? null;
        $task['categoryId'] = $categoryMap[$oldCategory] ?? null;
        $task['dependsOnIds'] = array_values(array_filter(array_map(
            static fn(string $dependency): ?string => $taskMap[$dependency] ?? null,
            array_values(array_filter($task['dependsOnIds'] ?? [], 'is_string')),
        )));
        genesisSaveTask($userId, $taskMap[$oldId], $task);
        $savedTasks++;
    }

    return [
        'categories' => count($categoryMap),
        'projects' => count($savedProjects),
        'tasks' => $savedTasks,
    ];
}

function genesisDeleteTask(string $userId, string $id): ?array
{
    $db = genesisDb();
    $statement = $db->prepare('SELECT * FROM tasks WHERE id = :id AND user_id = :user_id');
    $statement->execute(['id' => $id, 'user_id' => $userId]);
    $task = $statement->fetch();
    $db->prepare('DELETE FROM tasks WHERE id = :id AND user_id = :user_id')->execute(['id' => $id, 'user_id' => $userId]);
    return is_array($task) ? $task : null;
}

function genesisSacredFromDate(string $date): array
{
    $value = new DateTimeImmutable($date . ' 12:00:00');
    $year = (int)$value->format('Y');
    $start = new DateTimeImmutable($year . '-03-20 12:00:00');
    if ($value < $start) {
        $year--;
        $start = new DateTimeImmutable($year . '-03-20 12:00:00');
    }
    $dayOfYear = (int)$start->diff($value)->format('%a');
    return $dayOfYear < 360
        ? ['sacredYear' => $year, 'monthIndex' => intdiv($dayOfYear, 30), 'day' => ($dayOfYear % 30) + 1]
        : ['sacredYear' => $year, 'monthIndex' => 12, 'day' => $dayOfYear - 359];
}

function genesisNextDueDate(string $date, string $recurrence, int $interval): ?string
{
    if ($recurrence === 'none') {
        return null;
    }
    $next = new DateTimeImmutable($date . ' 12:00:00');
    if ($recurrence === 'weekdays') {
        $remaining = $interval;
        while ($remaining > 0) {
            $next = $next->modify('+1 day');
            if ((int)$next->format('N') <= 5) {
                $remaining--;
            }
        }
    } elseif ($recurrence === 'daily') {
        $next = $next->modify('+' . $interval . ' days');
    } elseif ($recurrence === 'weekly') {
        $next = $next->modify('+' . ($interval * 7) . ' days');
    } elseif ($recurrence === 'monthly') {
        $next = $next->modify('+' . $interval . ' months');
    } else {
        $next = $next->modify('+' . $interval . ' years');
    }
    return $next->format('Y-m-d');
}

function genesisSpawnNextOccurrence(string $userId, array $completedTask): ?array
{
    $nextDate = genesisNextDueDate((string)$completedTask['due_date'], (string)$completedTask['recurrence'], (int)$completedTask['recurrence_interval']);
    if ($nextDate === null) {
        return null;
    }
    $sacred = genesisSacredFromDate($nextDate);
    $payload = genesisTaskForClient($completedTask);
    $payload['id'] = genesisUuid();
    $payload['dueDate'] = $nextDate;
    $payload['sacredYear'] = $sacred['sacredYear'];
    $payload['monthIndex'] = $sacred['monthIndex'];
    $payload['day'] = $sacred['day'];
    $payload['done'] = false;
    $payload['completedAt'] = null;
    $payload['googleEventId'] = null;
    return genesisSaveTask($userId, $payload['id'], $payload);
}
