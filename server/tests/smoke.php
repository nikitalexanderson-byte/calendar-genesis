<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = genesisDb();
$now = genesisNow();
$userId = 'test-user-a';
$otherUserId = 'test-user-b';
$insertUser = $db->prepare('INSERT OR REPLACE INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES (:id, :sub, :email, :name, :created_at, :updated_at)');
foreach ([
    [$userId, 'google-a', 'a@example.test', 'User A'],
    [$otherUserId, 'google-b', 'b@example.test', 'User B'],
] as [$id, $sub, $email, $name]) {
    $insertUser->execute([
        'id' => $id,
        'sub' => $sub,
        'email' => $email,
        'name' => $name,
        'created_at' => $now,
        'updated_at' => $now,
    ]);
}

genesisSeedCategories($userId);
$categories = genesisCategoriesForUser($userId);
expect(count($categories) === 3, 'Default categories were not seeded.');

$parent = genesisSaveProject($userId, 'project-parent', [
    'title' => 'Большая цель',
    'categoryId' => $categories[0]['id'],
    'tags' => ['стратегия'],
]);
$child = genesisSaveProject($userId, 'project-child', [
    'title' => 'Следующий результат',
    'parentId' => $parent['id'],
    'categoryId' => $categories[0]['id'],
    'tags' => ['фокус'],
]);
expect($child['parentId'] === $parent['id'], 'Subproject relation was not saved.');

$first = genesisSaveTask($userId, 'task-first', [
    'title' => 'Подготовить основу',
    'dueDate' => '2026-09-01',
    'projectId' => $child['id'],
    'categoryId' => $categories[0]['id'],
    'recurrence' => 'weekly',
    'recurrenceInterval' => 1,
    'syncToGoogle' => true,
]);
genesisSaveTask($userId, 'task-second', [
    'title' => 'Проверить результат',
    'dueDate' => '2026-09-01',
    'dependsOnIds' => [$first['id']],
]);

$tasks = genesisTasksForUser($userId);
expect(count($tasks) === 2, 'Tasks were not saved.');
$second = array_values(array_filter($tasks, static fn(array $task): bool => $task['id'] === 'task-second'))[0] ?? null;
expect(is_array($second) && $second['dependsOnIds'] === ['task-first'], 'Task dependency was not saved.');
expect(genesisTasksForUser($otherUserId) === [], 'User data isolation failed.');

$foreignCategory = genesisSaveCategory($otherUserId, 'foreign-category', ['name' => 'Foreign']);
$foreignProject = genesisSaveProject($otherUserId, 'foreign-project', [
    'title' => 'Foreign project',
    'categoryId' => $foreignCategory['id'],
]);
$sanitized = genesisSaveTask($userId, 'task-foreign-references', [
    'title' => 'Reference isolation check',
    'dueDate' => '2026-09-01',
    'projectId' => $foreignProject['id'],
    'categoryId' => $foreignCategory['id'],
]);
expect($sanitized['projectId'] === null && $sanitized['categoryId'] === null, 'Foreign references were not removed.');
genesisDeleteTask($userId, 'task-foreign-references');

$collisionRejected = false;
try {
    genesisSaveTask($otherUserId, 'task-first', ['title' => 'Collision', 'dueDate' => '2026-09-01']);
} catch (RuntimeException) {
    $collisionRejected = true;
}
expect($collisionRejected, 'Cross-user resource ID collision was not rejected.');
$db->prepare('DELETE FROM projects WHERE id = :id AND user_id = :user_id')->execute([
    'id' => $foreignProject['id'],
    'user_id' => $otherUserId,
]);
$db->prepare('DELETE FROM categories WHERE id = :id AND user_id = :user_id')->execute([
    'id' => $foreignCategory['id'],
    'user_id' => $otherUserId,
]);

$imported = genesisImportWorkspace($otherUserId, [
    'categories' => [['id' => 'personal', 'name' => 'Личное', 'color' => '#a5543f', 'position' => 0]],
    'projects' => [
        ['id' => 'project-parent', 'title' => 'Чужой идентификатор', 'parentId' => null, 'categoryId' => 'personal'],
        ['id' => 'project-child', 'title' => 'Импортированный подпроект', 'parentId' => 'project-parent', 'categoryId' => 'personal'],
    ],
    'tasks' => [
        ['id' => 'task-first', 'title' => 'Импорт A', 'dueDate' => '2026-09-02', 'projectId' => 'project-child', 'categoryId' => 'personal'],
        ['id' => 'task-second', 'title' => 'Импорт B', 'dueDate' => '2026-09-02', 'dependsOnIds' => ['task-first']],
    ],
]);
expect($imported['projects'] === 2 && $imported['tasks'] === 2, 'Workspace import counts are incorrect.');
$otherProjects = genesisProjectsForUser($otherUserId);
$otherTasks = genesisTasksForUser($otherUserId);
expect(count($otherProjects) === 2 && count($otherTasks) === 2, 'Workspace import failed.');
expect(!in_array('project-parent', array_column($otherProjects, 'id'), true), 'Cross-user project ID collision was not remapped.');
$otherSecond = array_values(array_filter($otherTasks, static fn(array $task): bool => $task['title'] === 'Импорт B'))[0] ?? null;
expect(is_array($otherSecond) && count($otherSecond['dependsOnIds']) === 1, 'Imported task dependency was not remapped.');

$dbTask = $db->query("SELECT * FROM tasks WHERE id = 'task-first'")->fetch();
expect(is_array($dbTask), 'Recurring task was not found.');
$next = genesisSpawnNextOccurrence($userId, $dbTask);
expect(is_array($next) && $next['dueDate'] === '2026-09-08', 'Next recurring occurrence is incorrect.');

echo json_encode([
    'ok' => true,
    'categories' => count($categories),
    'projects' => count(genesisProjectsForUser($userId)),
    'tasks' => count(genesisTasksForUser($userId)),
    'nextDueDate' => $next['dueDate'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
