<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/shared-projects.php';

function sharedExpect(bool $value, string $message): void
{
    if (!$value) throw new RuntimeException($message);
}

function sharedUser(string $email, string $suffix): string
{
    $id = 'shared-smoke-' . $suffix;
    genesisDb()->prepare('INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at)
        VALUES (:id, :sub, :email, :name, :now, :now)')->execute([
            'id' => $id, 'sub' => 'shared-smoke-sub-' . $suffix, 'email' => $email,
            'name' => 'Shared Test ' . $suffix, 'now' => genesisNow(),
        ]);
    return $id;
}

function sharedReject(callable $action, int $status): void
{
    try { $action(); } catch (GenesisSharedAccessException $error) {
        sharedExpect($error->status === $status, 'Unexpected shared access status.');
        return;
    }
    throw new RuntimeException('Shared access check was bypassed.');
}

function sharedInvalid(callable $action): void
{
    try { $action(); } catch (InvalidArgumentException) { return; }
    throw new RuntimeException('Invalid cross-project reference was accepted.');
}

$a = sharedUser('jurijjlogvinov@gmail.com', 'a');
$b = sharedUser('mechrahod@gmail.com', 'b');
$viewer = sharedUser('eagbread@gmail.com', 'viewer');
$outsider = sharedUser('shared-outsider@example.org', 'outsider');
try {
    sharedExpect(!genesisUserForClient(genesisFindUser($a))['sharedProjectsEnabled'], 'Shared flag must start off.');
    sharedExpect(!genesisSharedTester(genesisFindUser($outsider)), 'Outsider gained tester access.');
    sharedExpect(!genesisSharedTester([...genesisFindUser($a), 'auth_provider' => 'yandex']),
        'Unverified non-Google identity gained tester access.');
    try {
        genesisUpdateAccountPreferences($outsider, ['sharedProjectsEnabled' => true]);
        throw new RuntimeException('Outsider enabled paid feature.');
    } catch (DomainException $expected) {
        sharedExpect($expected->getMessage() === 'SHARED_PROJECTS_PAID_FEATURE', 'Wrong paid-feature error.');
    }
    foreach ([$a, $b, $viewer] as $id) genesisUpdateAccountPreferences($id, ['sharedProjectsEnabled' => true]);
    $space = genesisSharedCreateSpace($a, ['title' => 'Космос']);
    $project = genesisSharedCreateProject($a, $space['id'], ['title' => 'Общий план', 'layout' => 'board']);
    $snapshot = genesisSharedProjectSnapshot($a, $project['id']);
    sharedExpect(count($snapshot['statuses']) === 3, 'Default board statuses missing.');
    $category = genesisSharedCreateCategory($a, $project['id'], [
        'title' => 'Приоритет', 'color' => '#a5543f',
    ]);
    $otherProject = genesisSharedCreateProject($a, $space['id'], ['title' => 'Соседний проект']);
    $otherSnapshot = genesisSharedProjectSnapshot($a, $otherProject['id']);
    $otherCategory = genesisSharedCreateCategory($a, $otherProject['id'], ['title' => 'Чужая категория']);
    sharedInvalid(static fn() => genesisSharedTask($a, $project['id'], [
        'title' => 'Подмена статуса', 'statusId' => $otherSnapshot['statuses'][0]['id'],
    ]));
    sharedInvalid(static fn() => genesisSharedTask($a, $project['id'], [
        'title' => 'Подмена категории', 'statusId' => $snapshot['statuses'][0]['id'],
        'categoryId' => $otherCategory['id'],
    ]));
    $category = genesisSharedUpdateCategory($a, $project['id'], $category['id'], [
        'title' => 'Важное', 'color' => '#a5543f', 'expectedRevision' => 1,
    ]);
    sharedExpect($category['revision'] === 2, 'Category update failed.');
    sharedReject(static fn() => genesisSharedUpdateCategory($a, $project['id'], $category['id'], [
        'title' => 'Устаревшая версия', 'color' => '#a5543f', 'expectedRevision' => 1,
    ]), 409);
    $customStatus = genesisSharedCreateStatus($a, $project['id'], ['title' => 'Проверка']);
    $renamedStatus = genesisSharedUpdateStatus($a, $project['id'], $customStatus['id'], [
        'title' => 'На проверке', 'expectedRevision' => 1,
    ]);
    sharedExpect($renamedStatus['revision'] === 2, 'Status revision did not advance.');
    sharedReject(static fn() => genesisSharedUpdateStatus($a, $project['id'], $customStatus['id'], [
        'title' => 'Устаревшая правка', 'expectedRevision' => 1,
    ]), 409);
    genesisSharedDeleteStatus($a, $project['id'], $customStatus['id'], [
        'destinationStatusId' => $snapshot['statuses'][0]['id'], 'expectedRevision' => 2,
    ]);
    $edited = genesisSharedUpdateProject($a, $project['id'], [
        'title' => 'Обновлённый план', 'description' => 'Командное описание', 'expectedRevision' => 1,
    ]);
    sharedExpect($edited['revision'] === 2 && $edited['title'] === 'Обновлённый план', 'Project edit failed.');
    sharedReject(static fn() => genesisSharedUpdateProject($a, $project['id'], [
        'title' => 'Устаревшая версия', 'expectedRevision' => 1,
    ]), 409);
    sharedReject(static fn() => genesisSharedProjectSnapshot($b, $project['id']), 404);
    sharedReject(static fn() => genesisSharedProjectSnapshot($outsider, $project['id']), 403);
    $invitation = genesisSharedInvite($a, $project['id'], ['email' => 'mechrahod@gmail.com', 'role' => 'member']);
    $stored = genesisDb()->query('SELECT token_hash FROM shared_invitations LIMIT 1')->fetchColumn();
    sharedExpect($stored !== $invitation['token'], 'Invitation token was stored in plaintext.');
    sharedReject(static fn() => genesisSharedAcceptInvite($viewer, ['token' => $invitation['token']]), 404);
    genesisSharedAcceptInvite($b, ['token' => $invitation['token']]);
    sharedReject(static fn() => genesisSharedAcceptInvite($b, ['token' => $invitation['token']]), 404);
    sharedExpect(count(genesisSharedProjects($b, $space['id'])) === 1,
        'Project guest unexpectedly saw the shared inbox.');
    sharedReject(static fn() => genesisSharedCreateProject($b, $space['id'], ['title' => 'Forbidden']), 403);
    $task = genesisSharedTask($a, $project['id'], [
        'title' => 'Задача 1', 'statusId' => $snapshot['statuses'][0]['id'],
        'categoryId' => $category['id'],
    ]);
    sharedExpect(count(genesisSharedProjectSnapshot($b, $project['id'])['tasks']) === 1, 'Second user cannot see the task.');
    sharedExpect(genesisSharedProjectSnapshot($b, $project['id'])['tasks'][0]['categoryId'] === $category['id'],
        'Team category did not reach the second user.');
    $updated = genesisSharedTask($b, $project['id'], [
        'statusId' => $snapshot['statuses'][1]['id'], 'expectedRevision' => 1,
    ], $task['id']);
    sharedExpect($updated['revision'] === 2, 'Task revision did not advance.');
    $done = genesisSharedTask($b, $project['id'], [
        'statusId' => $snapshot['statuses'][2]['id'], 'expectedRevision' => 2,
    ], $task['id']);
    sharedExpect($done['completedBy'] === $b && $done['completedAt'] !== null,
        'Completion provenance was not saved.');
    $alternateDone = genesisSharedCreateStatus($a, $project['id'], ['title' => 'Принято', 'isDone' => true]);
    genesisSharedDeleteStatus($a, $project['id'], $snapshot['statuses'][2]['id'], [
        'destinationStatusId' => $alternateDone['id'], 'expectedRevision' => 1,
    ]);
    $movedByStatusDeletion = genesisSharedProjectSnapshot($b, $project['id'])['tasks'][0];
    sharedExpect($movedByStatusDeletion['statusId'] === $alternateDone['id']
        && $movedByStatusDeletion['completedBy'] === $b,
        'Deleting a status lost a task or its completion author.');
    genesisSharedDeleteCategory($a, $project['id'], $category['id'], ['expectedRevision' => 2]);
    sharedExpect(genesisSharedProjectSnapshot($b, $project['id'])['tasks'][0]['categoryId'] === null,
        'Deleting a category did not detach the task.');
    sharedReject(static fn() => genesisSharedTask($a, $project['id'], [
        'title' => 'Lost update', 'expectedRevision' => 1,
    ], $task['id']), 409);
    genesisSharedAddComment($b, $project['id'], $task['id'], ['body' => 'Сделаю сегодня']);
    sharedExpect(count(genesisSharedComments($a, $project['id'], $task['id'])) === 1, 'Comment did not persist.');
    $viewerInvite = genesisSharedInvite($a, $project['id'], ['email' => 'eagbread@gmail.com', 'role' => 'viewer']);
    genesisSharedAcceptInvite($viewer, ['token' => $viewerInvite['token']]);
    sharedExpect(count(genesisSharedProjects($viewer, $space['id'])) === 1,
        'Viewer unexpectedly saw another shared project.');
    sharedExpect(count(genesisSharedProjectSnapshot($viewer, $project['id'])['tasks']) === 1, 'Viewer cannot read.');
    sharedReject(static fn() => genesisSharedTask($viewer, $project['id'], [
        'title' => 'Forbidden', 'statusId' => $snapshot['statuses'][0]['id'],
    ]), 403);
    sharedReject(static fn() => genesisSharedAddComment($viewer, $project['id'], $task['id'], [
        'body' => 'Forbidden',
    ]), 403);
    sharedReject(static fn() => genesisSharedSetArchived($viewer, $project['id'], true), 403);
    $child = genesisSharedCreateProject($a, $space['id'], [
        'title' => 'Подпроект', 'parentId' => $project['id'],
    ]);
    sharedReject(static fn() => genesisSharedSetArchived($a, $project['id'], true), 409);
    genesisSharedSetArchived($a, $child['id'], true);
    genesisSharedSetArchived($a, $project['id'], true);
    sharedReject(static fn() => genesisSharedProjectSnapshot($b, $project['id']), 404);
    sharedExpect(count(genesisSharedArchivedProjects($a, $space['id'])) === 2,
        'Archived projects were not listed.');
    sharedReject(static fn() => genesisSharedSetArchived($a, $child['id'], false), 409);
    genesisSharedSetArchived($a, $project['id'], false);
    genesisSharedSetArchived($a, $child['id'], false);
    sharedExpect(count(genesisSharedProjectSnapshot($b, $project['id'])['tasks']) === 1,
        'Archive and restore lost a team task.');
    sharedReject(static fn() => genesisSharedSetMemberRole($a, $project['id'], $a, ['role' => 'member']), 409);
    genesisSharedSetMemberRole($a, $project['id'], $b, ['role' => 'manager']);
    sharedExpect(genesisSharedProjectSnapshot($b, $project['id'])['project']['role'] === 'manager',
        'Member role change failed.');
    sharedReject(static fn() => genesisSharedSetSpaceRole($a, $space['id'], $a, ['role' => 'guest']), 409);
    genesisSharedSetSpaceRole($a, $space['id'], $b, ['role' => 'member']);
    sharedExpect(count(genesisSharedProjects($b, $space['id'])) === 2,
        'Promoted space member cannot see the shared inbox.');
    genesisSharedRemoveMember($a, $project['id'], $b);
    sharedExpect(count(genesisSharedProjects($b, $space['id'])) === 1,
        'Removing a project role also removed promoted space membership.');
    $returnInvite = genesisSharedInvite($a, $project['id'], ['email' => 'mechrahod@gmail.com', 'role' => 'manager']);
    genesisSharedAcceptInvite($b, ['token' => $returnInvite['token']]);
    $viewerArchive = genesisSharedCreateProject($a, $space['id'], ['title' => 'Архив гостя']);
    $archiveInvite = genesisSharedInvite($a, $viewerArchive['id'], ['email' => 'eagbread@gmail.com']);
    genesisSharedAcceptInvite($viewer, ['token' => $archiveInvite['token']]);
    genesisSharedSetArchived($a, $viewerArchive['id'], true);
    genesisSharedRemoveMember($a, $project['id'], $viewer);
    sharedExpect(count(genesisSharedArchivedProjects($viewer, $space['id'])) === 1,
        'Removing access to one project also erased a guest archived project.');
    sharedReject(static fn() => genesisSharedProjectSnapshot($viewer, $project['id']), 404);
    sharedReject(static fn() => genesisSharedTask($viewer, $project['id'], [
        'title' => 'Revoked', 'statusId' => $snapshot['statuses'][0]['id'],
    ]), 404);
    $guestSpace = genesisSharedCreateSpace($a, ['title' => 'Второе пространство']);
    $guestProject = genesisSharedCreateProject($a, $guestSpace['id'], ['title' => 'Только гости']);
    $guestInvite = genesisSharedInvite($a, $guestProject['id'], ['email' => 'eagbread@gmail.com']);
    genesisSharedAcceptInvite($viewer, ['token' => $guestInvite['token']]);
    sharedExpect(count(genesisSharedProjects($viewer, $guestSpace['id'])) === 1,
        'Guest inherited the shared inbox before ownership transfer.');
    genesisDeleteAccount($a);
    sharedExpect(genesisSharedProjectSnapshot($b, $project['id'])['project']['role'] === 'owner',
        'Account deletion did not transfer project ownership.');
    sharedExpect(count(genesisSharedComments($b, $project['id'], $task['id'])) === 1,
        'Account deletion lost team comments.');
    sharedExpect(count(genesisSharedProjects($viewer, $guestSpace['id'])) === 2,
        'Deleting the sole owner lost the shared inbox for a surviving guest.');
} finally {
    foreach ([$a, $b, $viewer, $outsider] as $id) {
        if (genesisFindUser($id)) genesisDeleteAccount($id);
    }
}

echo "Shared projects smoke passed.\n";
