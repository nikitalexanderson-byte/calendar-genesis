<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/google.php';
require dirname(__DIR__) . '/src/shared-projects.php';
require dirname(__DIR__) . '/src/shared-google.php';
function uiExpect(bool $value, string $message): void {
    if (!$value) throw new RuntimeException($message);
}
function uiReject(callable $action, ?int $status = null): void {
    try { $action(); }
    catch (GenesisSharedAccessException $error) {
        uiExpect($status === null || $error->status === $status, 'Unexpected access status ' . $error->status . ': ' . $error->getMessage()); return;
    }
    catch (InvalidArgumentException $error) { uiExpect($status === null, 'Expected access rejection'); return; }
    throw new RuntimeException('Invalid action was accepted');
}
$ids = [];
foreach (['owner', 'member', 'guest', 'outsider'] as $role) {
    $id = 'shared-ui-test-' . $role; $ids[$role] = $id;
    genesisDb()->prepare('INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at)
        VALUES (:id, :sub, :email, :name, :now, :now)')->execute([
        'id' => $id, 'sub' => $id, 'email' => 'genesis-ui-test-' . $role . '@gmail.com',
        'name' => 'UI Test', 'now' => genesisNow(),
    ]);
}
[$owner, $member, $guest, $outsider] = array_values($ids);
try {
    genesisUpdateAccountPreferences($owner, ['sharedProjectsEnabled' => true]);
    $space = genesisSharedCreateSpace($owner, ['title' => 'UI test']);
    $project = genesisSharedCreateProject($owner, $space['id'], ['title' => 'Boards', 'layout' => 'board']);
    $initial = genesisSharedProjectSnapshot($owner, $project['id']);
    uiExpect(count($initial['statuses']) === 3, 'A board project must start with three boards');
    uiExpect(genesisSharedUiState($owner, $space['id'])['expandedIds'] === [], 'Projects must start collapsed');
    genesisSharedUiState($owner, $space['id'], ['expandedIds' => [$project['id']]]);
    uiExpect(genesisSharedUiState($owner, $space['id'])['expandedIds'] === [$project['id']], 'Expansion was not saved');
    uiReject(fn() => genesisSharedUiState($owner, $space['id'], ['expandedIds' => ['foreign-project']]));
    uiReject(fn() => genesisSharedSpaceInvite($owner, $space['id'], ['email' => 'person@example.org']));
    $invitation = genesisSharedSpaceInvite($owner, $space['id'], ['email' => 'genesis-ui-test-member@gmail.com']);
    uiExpect(count(genesisSharedSpaceInvitations($member)) === 1, 'Recipient cannot see invitation before enabling shared affairs');
    uiExpect(genesisSharedSpaceInvitations($outsider) === [], 'Invitations leaked to another user');
    uiReject(fn() => genesisSharedRespondSpaceInvitation($outsider, $invitation['id'], true), 409);
    genesisDb()->prepare("UPDATE shared_space_members SET role = 'member' WHERE space_id = :space AND user_id = :user")
        ->execute(['space' => $space['id'], 'user' => $owner]);
    uiReject(fn() => genesisSharedRespondSpaceInvitation($member, $invitation['id'], true), 409);
    genesisDb()->prepare("UPDATE shared_space_members SET role = 'owner' WHERE space_id = :space AND user_id = :user")
        ->execute(['space' => $space['id'], 'user' => $owner]);
    genesisSharedRespondSpaceInvitation($member, $invitation['id'], true);
    uiExpect(genesisUserForClient(genesisFindUser($member))['sharedProjectsEnabled'], 'Joining did not enable shared affairs');
    uiExpect(genesisSharedProjectSnapshot($member, $project['id'])['project']['role'] === 'member', 'Joining did not grant project access');
    uiExpect(genesisSharedUiState($member, $space['id'])['expandedIds'] === [], 'Expansion leaked between users');
    uiReject(fn() => genesisSharedRespondSpaceInvitation($member, $invitation['id'], true), 409);
    uiReject(fn() => genesisSharedSpaceInvite($member, $space['id'], ['email' => 'genesis-ui-test-outsider@gmail.com']), 403);
    $guestInvitation = genesisSharedSpaceInvite($owner, $space['id'], ['email' => 'genesis-ui-test-guest@gmail.com', 'role' => 'guest']);
    genesisSharedRespondSpaceInvitation($guest, $guestInvitation['id'], true);
    $future = genesisSharedCreateProject($owner, $space['id'], ['title' => 'Created after joining']);
    uiExpect(genesisSharedProjectSnapshot($member, $future['id'])['project']['role'] === 'member', 'Future project membership missing');
    uiExpect(genesisSharedProjectSnapshot($guest, $future['id'])['project']['role'] === 'viewer', 'Guest gained edit access');
    uiReject(fn() => genesisSharedCreateProject($guest, $space['id'], ['title' => 'Forbidden']), 403);
    $board = $initial['statuses'][0]; $destination = $initial['statuses'][1];
    $child = genesisSharedCreateProject($owner, $space['id'], ['title' => 'Task list', 'kind' => 'task-list',
        'parentId' => $project['id'], 'boardStatusId' => $board['id']]);
    uiExpect($child['kind'] === 'task-list' && $child['boardStatusId'] === $board['id'], 'Task-list board placement missing');
    uiReject(fn() => genesisSharedCreateProject($owner, $space['id'], ['title' => 'Invalid destination',
        'parentId' => $future['id'], 'boardStatusId' => $board['id']]));
    $updated = genesisSharedUpdateStatus($owner, $project['id'], $board['id'], ['title' => 'Review',
        'color' => '#123456', 'imageUrl' => 'https://example.org/board.webp', 'expectedRevision' => 1]);
    uiExpect($updated['color'] === '#123456' && $updated['imageUrl'] === 'https://example.org/board.webp', 'Board appearance was not saved');
    uiReject(fn() => genesisSharedUpdateStatus($guest, $project['id'], $board['id'], ['title' => 'Invalid', 'expectedRevision' => 2]), 403);
    uiReject(fn() => genesisSharedBoardImage('javascript:alert(1)'));
    genesisSharedDeleteStatus($owner, $project['id'], $board['id'], ['destinationStatusId' => $destination['id'], 'expectedRevision' => 2]);
    uiExpect(genesisSharedProjectSnapshot($owner, $child['id'])['project']['boardStatusId'] === $destination['id'], 'Deleting a board orphaned a child project');
    $count = count(genesisSharedProjectSnapshot($owner, $project['id'])['statuses']);
    for ($i = $count; $i < 30; $i++) genesisSharedCreateStatus($owner, $project['id'], ['title' => 'Board ' . $i]);
    uiReject(fn() => genesisSharedCreateStatus($owner, $project['id'], ['title' => '31st board']), 409);
    genesisDeleteAccount($owner);
    uiExpect(genesisFindUser($owner) === null, 'Invitations prevented account deletion');
} finally {
    foreach ($ids as $id) if (genesisFindUser($id)) genesisDeleteAccount($id);
}
echo "Shared UI permissions, invitations, expansion and boards passed.\n";
