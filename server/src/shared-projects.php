<?php
declare(strict_types=1);

final class GenesisSharedAccessException extends RuntimeException
{
    public function __construct(string $message = 'SHARED_PROJECT_NOT_FOUND', public readonly int $status = 404)
    {
        parent::__construct($message);
    }
}

function genesisSharedRequireEligible(string $userId): array
{
    $user = genesisFindUser($userId);
    if (!$user || !genesisSharedEligible($user)) {
        throw new GenesisSharedAccessException('SHARED_PROJECTS_DISABLED', 403);
    }
    return $user;
}

function genesisSharedRequireEnabled(string $userId): array
{
    $user = genesisSharedRequireEligible($userId);
    if (empty($user['shared_projects_enabled'])) {
        throw new GenesisSharedAccessException('SHARED_PROJECTS_DISABLED', 403);
    }
    return $user;
}

function genesisSharedTitle(mixed $value, int $limit = 160): string
{
    if (!is_string($value)) throw new InvalidArgumentException('TITLE_REQUIRED');
    $title = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    if ($title === '' || mb_strlen($title) > $limit) throw new InvalidArgumentException('INVALID_TITLE');
    return $title;
}

function genesisSharedText(mixed $value, int $limit): string
{
    if (!is_string($value) || mb_strlen($value) > $limit) throw new InvalidArgumentException('INVALID_TEXT');
    return trim($value);
}

function genesisSharedTags(mixed $value): array
{
    if (!is_array($value) || !array_is_list($value) || count($value) > 30) throw new InvalidArgumentException('INVALID_TAGS');
    $result = [];
    foreach ($value as $tag) {
        if (!is_string($tag) || mb_strlen($tag) > 80) throw new InvalidArgumentException('INVALID_TAGS');
        $tag = ltrim(trim($tag), '#');
        if ($tag !== '' && !in_array($tag, $result, true)) $result[] = $tag;
    }
    return $result;
}

function genesisSharedRowTags(array $row): array
{
    $row['tags'] = json_decode((string)($row['tagsJson'] ?? '[]'), true) ?: [];
    unset($row['tagsJson']);
    return $row;
}

function genesisSharedSpaceAccess(string $spaceId, string $userId): array
{
    $query = genesisDb()->prepare('SELECT s.*, m.role AS member_role, m.permissions_json, m.can_organize_tasks FROM shared_spaces s
        JOIN shared_space_members m ON m.space_id = s.id AND m.user_id = :user
        WHERE s.id = :id LIMIT 1');
    $query->execute(['id' => $spaceId, 'user' => $userId]);
    $row = $query->fetch();
    if (!$row) throw new GenesisSharedAccessException();
    return $row;
}

function genesisSharedProjectAccess(string $projectId, string $userId, string $permission = 'read', bool $includeArchived = false): array
{
    $query = genesisDb()->prepare('SELECT p.*, m.role AS member_role,
        sm.role AS space_member_role, sm.permissions_json AS space_permissions_json, sm.can_organize_tasks AS can_organize_tasks FROM shared_projects p
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
        JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = :user
        WHERE p.id = :id' . ($includeArchived ? '' : ' AND p.archived_at IS NULL') . ' LIMIT 1');
    $query->execute(['id' => $projectId, 'user' => $userId]);
    $project = $query->fetch();
    if (!$project) throw new GenesisSharedAccessException();
    $permissions = genesisSharedPermissions($project['space_member_role'], $project['space_permissions_json'],
        (int)$project['can_organize_tasks'] === 1, $project['member_role']);
    $key = ['write' => 'editTasks', 'comment' => 'comment', 'manage' => 'manageProjects',
        'organize' => 'organizeTasks', 'invite' => 'inviteMembers', 'owner' => 'manageProjects'][$permission] ?? null;
    if ($permission !== 'read' && (!$key || !$permissions[$key]
        || ($permission === 'owner' && $project['member_role'] !== 'owner'))) {
        throw new GenesisSharedAccessException('SHARED_PROJECT_FORBIDDEN', 403);
    }
    $project['permissions'] = $permissions;
    return $project;
}

function genesisSharedAudit(string $projectId, string $actorId, string $action, string $objectId): void
{
    genesisDb()->prepare('INSERT INTO shared_audit_events (id, project_id, actor_id, action, object_id, created_at)
        VALUES (:id, :project, :actor, :action, :object, :created)')->execute([
        'id' => genesisUuid(), 'project' => $projectId, 'actor' => $actorId,
        'action' => $action, 'object' => $objectId, 'created' => genesisNow(),
    ]);
}

function genesisSharedSpaces(string $userId): array
{
    genesisSharedRequireEnabled($userId);
    $query = genesisDb()->prepare('SELECT s.id, s.title, s.description, s.revision, s.updated_at AS updatedAt, m.role, m.permissions_json, m.can_organize_tasks
        FROM shared_spaces s JOIN shared_space_members m ON m.space_id = s.id
        WHERE m.user_id = :user ORDER BY s.updated_at DESC LIMIT 100');
    $query->execute(['user' => $userId]);
    return array_map(static function (array $space): array {
        $space['permissions'] = genesisSharedPermissions($space['role'], $space['permissions_json'], (int)$space['can_organize_tasks'] === 1);
        $space['revision'] = (int)$space['revision'];
        unset($space['permissions_json'], $space['can_organize_tasks']); return $space;
    }, $query->fetchAll());
}

function genesisSharedCreateSpace(string $userId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $title = genesisSharedTitle($input['title'] ?? null);
    $description = genesisSharedText($input['description'] ?? '', 5000);
    $invitations = $input['invitations'] ?? [];
    if (!is_array($invitations) || !array_is_list($invitations) || count($invitations) > 20) throw new InvalidArgumentException('INVALID_SPACE_INVITATIONS');
    $id = genesisUuid();
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO shared_spaces (id, title, description, created_by, created_at, updated_at)
            VALUES (:id, :title, :description, :user, :now, :now)')->execute(compact('id', 'title', 'description') + ['user' => $userId, 'now' => $now]);
        $db->prepare("INSERT INTO shared_space_members (space_id, user_id, role, joined_at)
            VALUES (:space, :user, 'owner', :now)")->execute(['space' => $id, 'user' => $userId, 'now' => $now]);
        $inboxId = genesisUuid();
        $db->prepare("INSERT INTO shared_projects (id, space_id, title, description, layout, is_inbox,
            created_by, created_at, updated_at) VALUES (:id, :space, 'Хаос-бокс',
            'Общие задачи без отдельного проекта', 'list', 1, :user, :now, :now)")->execute([
                'id' => $inboxId, 'space' => $id, 'user' => $userId, 'now' => $now,
            ]);
        $db->prepare("INSERT INTO shared_project_members (project_id, user_id, role, joined_at)
            VALUES (:project, :user, 'owner', :now)")->execute([
                'project' => $inboxId, 'user' => $userId, 'now' => $now,
            ]);
        foreach ([['К выполнению', 0], ['Готово', 1]] as $position => [$statusTitle, $done]) {
            $db->prepare('INSERT INTO shared_project_statuses (id, project_id, title, position, is_done)
                VALUES (:id, :project, :title, :position, :done)')->execute([
                    'id' => genesisUuid(), 'project' => $inboxId, 'title' => $statusTitle,
                    'position' => $position, 'done' => $done,
                ]);
        }
        $emails = [];
        foreach ($invitations as $invitation) {
            if (!is_array($invitation)) throw new InvalidArgumentException('INVALID_SPACE_INVITATIONS');
            $email = mb_strtolower(trim((string)($invitation['email'] ?? '')));
            if (in_array($email, $emails, true)) throw new InvalidArgumentException('DUPLICATE_SPACE_INVITATION');
            $emails[] = $email;
            genesisSharedSpaceInvite($userId, $id, $invitation);
        }
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    return ['id' => $id, 'title' => $title, 'role' => 'owner', 'description' => $description, 'revision' => 1, 'updatedAt' => $now];
}

function genesisSharedProjects(string $userId, string $spaceId): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedSpaceAccess($spaceId, $userId);
    $query = genesisDb()->prepare('SELECT p.id, p.space_id AS spaceId, p.parent_id AS parentId,
        p.title, p.description, p.tags_json AS tagsJson, p.layout, p.kind, p.board_status_id AS boardStatusId, p.is_inbox AS isInbox, p.revision, p.updated_at AS updatedAt,
        m.role, sm.role AS spaceRole, sm.can_organize_tasks AS canOrganizeTasks, sm.permissions_json AS permissionsJson,
        (SELECT COUNT(*) FROM shared_tasks t WHERE t.project_id = p.id) AS taskCount
        FROM shared_projects p JOIN shared_project_members m ON m.project_id = p.id
        JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = m.user_id
        WHERE p.space_id = :space AND m.user_id = :user AND p.archived_at IS NULL
        ORDER BY p.updated_at DESC LIMIT 100');
    $query->execute(['space' => $spaceId, 'user' => $userId]);
    return array_map(static function (array $project): array {
        $project['permissions'] = genesisSharedPermissions($project['spaceRole'], $project['permissionsJson'], (int)$project['canOrganizeTasks'] === 1, $project['role']);
        $project['canOrganizeTasks'] = $project['permissions']['organizeTasks'];
        $project['canCreateBoards'] = $project['permissions'][$project['permissionsJson'] === null ? 'editTasks' : 'manageProjects'];
        unset($project['permissionsJson']); return genesisSharedRowTags($project);
    }, $query->fetchAll());
}

function genesisSharedArchivedProjects(string $userId, string $spaceId): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedSpaceAccess($spaceId, $userId);
    $query = genesisDb()->prepare('SELECT p.id, p.space_id AS spaceId, p.parent_id AS parentId,
        p.title, p.description, p.tags_json AS tagsJson, p.layout, p.kind, p.board_status_id AS boardStatusId, p.revision, p.archived_at AS archivedAt, m.role
        FROM shared_projects p JOIN shared_project_members m ON m.project_id = p.id
        WHERE p.space_id = :space AND m.user_id = :user AND p.archived_at IS NOT NULL
        ORDER BY p.archived_at DESC LIMIT 100');
    $query->execute(['space' => $spaceId, 'user' => $userId]);
    return array_map('genesisSharedRowTags', $query->fetchAll());
}

function genesisSharedSetArchived(string $userId, string $projectId, bool $archived): void
{
    genesisSharedRequireEnabled($userId);
    $project = genesisSharedProjectAccess($projectId, $userId, 'owner', true);
    if ((int)$project['is_inbox'] === 1) throw new GenesisSharedAccessException('INBOX_CANNOT_BE_ARCHIVED', 403);
    if ($archived && $project['archived_at'] !== null) return;
    if (!$archived && $project['archived_at'] === null) return;
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'owner', true);
        if ($archived) {
            $children = $db->prepare('SELECT 1 FROM shared_projects WHERE parent_id = :project
                AND archived_at IS NULL LIMIT 1');
            $children->execute(['project' => $projectId]);
            if ($children->fetchColumn()) throw new GenesisSharedAccessException('ARCHIVE_CHILD_PROJECTS_FIRST', 409);
        } elseif ($project['parent_id'] !== null) {
            $parent = $db->prepare('SELECT 1 FROM shared_projects WHERE id = :parent AND archived_at IS NULL');
            $parent->execute(['parent' => $project['parent_id']]);
            if (!$parent->fetchColumn()) throw new GenesisSharedAccessException('RESTORE_PARENT_FIRST', 409);
        }
        $changed = $db->prepare('UPDATE shared_projects SET archived_at = :archived, updated_at = :now,
            revision = revision + 1 WHERE id = :project AND revision = :revision');
        $changed->execute(['archived' => $archived ? genesisNow() : null,
            'now' => genesisNow(), 'project' => $projectId, 'revision' => (int)$project['revision']]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('SHARED_PROJECT_CONFLICT', 409);
        genesisSharedAudit($projectId, $userId, $archived ? 'project.archived' : 'project.restored', $projectId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedCreateStatus(string $userId, string $projectId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $requestId = genesisSharedRequestId($input);
    $title = genesisSharedTitle($input['title'] ?? null, 80);
    $isDone = $input['isDone'] ?? false;
    if (!is_bool($isDone)) throw new InvalidArgumentException('INVALID_STATUS_KIND');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $project = genesisSharedProjectAccess($projectId, $userId);
        genesisSharedProjectAccess($projectId, $userId, $project['space_permissions_json'] === null ? 'write' : 'manage');
        $receipt = genesisSharedMutationReceipt($db, $userId, $requestId, 'status.create', $projectId);
        if ($receipt !== null) {
            $db->commit();
            return $receipt;
        }
        $query = $db->prepare('SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS lastPosition
            FROM shared_project_statuses WHERE project_id = :project');
        $query->execute(['project' => $projectId]);
        $summary = $query->fetch();
        if ((int)$summary['count'] >= 30) throw new GenesisSharedAccessException('STATUS_LIMIT', 409);
        $id = genesisUuid();
        $position = (int)$summary['lastPosition'] + 1;
        $db->prepare('INSERT INTO shared_project_statuses (id, project_id, title, position, is_done)
            VALUES (:id, :project, :title, :position, :done)')->execute([
                'id' => $id, 'project' => $projectId, 'title' => $title,
                'position' => $position, 'done' => $isDone ? 1 : 0,
            ]);
        genesisSharedAudit($projectId, $userId, 'status.created', $id);
        $response = ['id' => $id, 'title' => $title, 'position' => $position,
            'isDone' => $isDone ? 1 : 0, 'revision' => 1];
        genesisSharedSaveMutationReceipt($db, $userId, $requestId, 'status.create', $projectId, $response);
        $db->commit();
        return $response;
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedUpdateStatus(string $userId, string $projectId, string $statusId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $title = genesisSharedTitle($input['title'] ?? null, 80);
    $expected = filter_var($input['expectedRevision'] ?? null, FILTER_VALIDATE_INT);
    if ($expected === false || $expected < 1) throw new InvalidArgumentException('EXPECTED_REVISION_REQUIRED');
    $db = genesisDb(); $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $query = $db->prepare('SELECT * FROM shared_project_statuses WHERE id = :id AND project_id = :project');
        $query->execute(['id' => $statusId, 'project' => $projectId]); $status = $query->fetch();
        if (!$status || (int)$status['revision'] !== $expected) throw new GenesisSharedAccessException('STATUS_CONFLICT', 409);
        $color = array_key_exists('color', $input) ? genesisSharedCategoryColor($input['color']) : $status['color'];
        $image = array_key_exists('imageUrl', $input) ? genesisSharedBoardImage($input['imageUrl']) : $status['image_url'];
        $done = array_key_exists('isDone', $input) ? (int)(bool)$input['isDone'] : (int)$status['is_done'];
        if (!$done && (int)$status['is_done']) {
            $count = $db->prepare('SELECT COUNT(*) FROM shared_project_statuses WHERE project_id = :project AND is_done = 1');
            $count->execute(['project' => $projectId]);
            if ((int)$count->fetchColumn() <= 1) throw new GenesisSharedAccessException('LAST_DONE_STATUS', 409);
        }
        $changed = $db->prepare('UPDATE shared_project_statuses SET title = :title, color = :color, image_url = :image,
            is_done = :done, revision = revision + 1 WHERE id = :id AND project_id = :project AND revision = :expected');
        $changed->execute(['title' => $title, 'color' => $color, 'image' => $image, 'done' => $done,
            'id' => $statusId, 'project' => $projectId, 'expected' => $expected]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('STATUS_CONFLICT', 409);
        if ($done !== (int)$status['is_done']) {
            $db->prepare('UPDATE shared_tasks SET completed_by = :completed_by, completed_at = :completed_at,
                updated_by = :user, updated_at = :now, revision = revision + 1 WHERE project_id = :project AND status_id = :status')
                ->execute(['completed_by' => $done ? $userId : null, 'completed_at' => $done ? genesisNow() : null,
                    'user' => $userId, 'now' => genesisNow(), 'project' => $projectId, 'status' => $statusId]);
        }
        genesisSharedAudit($projectId, $userId, 'status.updated', $statusId); $db->commit();
        return ['id' => $statusId, 'title' => $title, 'color' => $color, 'imageUrl' => $image,
            'isDone' => $done, 'position' => (int)$status['position'], 'revision' => $expected + 1];
    } catch (Throwable $error) { $db->rollBack(); throw $error; }
}

function genesisSharedDeleteStatus(string $userId, string $projectId, string $statusId, array $input): void
{
    genesisSharedRequireEnabled($userId);
    $targetId = (string)($input['destinationStatusId'] ?? '');
    $expected = filter_var($input['expectedRevision'] ?? null, FILTER_VALIDATE_INT);
    if ($targetId === '' || $targetId === $statusId || $expected === false || $expected < 1) {
        throw new InvalidArgumentException('INVALID_STATUS_DESTINATION');
    }
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $query = $db->prepare('SELECT id, is_done, revision FROM shared_project_statuses
            WHERE project_id = :project AND id IN (:source, :target)');
        $query->execute(['project' => $projectId, 'source' => $statusId, 'target' => $targetId]);
        $statuses = [];
        foreach ($query->fetchAll() as $row) $statuses[$row['id']] = $row;
        if (!isset($statuses[$statusId], $statuses[$targetId])) throw new GenesisSharedAccessException();
        if ((int)$statuses[$statusId]['revision'] !== $expected) {
            throw new GenesisSharedAccessException('STATUS_CONFLICT', 409);
        }
        if ((int)$statuses[$statusId]['is_done'] === 1) {
            $done = $db->prepare('SELECT COUNT(*) FROM shared_project_statuses
                WHERE project_id = :project AND is_done = 1');
            $done->execute(['project' => $projectId]);
            if ((int)$done->fetchColumn() <= 1) throw new GenesisSharedAccessException('LAST_DONE_STATUS', 409);
        }
        $now = genesisNow();
        $targetDone = (int)$statuses[$targetId]['is_done'];
        $completion = $targetDone === 1
            ? 'completed_by = COALESCE(completed_by, :actor1), completed_at = COALESCE(completed_at, :now1),'
            : 'completed_by = NULL, completed_at = NULL,';
        $updates = $db->prepare('UPDATE shared_tasks SET status_id = :target, ' . $completion . '
            updated_by = :actor2, updated_at = :now2, revision = revision + 1
            WHERE project_id = :project AND status_id = :source');
        $values = ['target' => $targetId, 'actor2' => $userId,
            'now2' => $now, 'project' => $projectId, 'source' => $statusId];
        if ($targetDone === 1) $values += ['actor1' => $userId, 'now1' => $now];
        $updates->execute($values);
        $db->prepare('UPDATE shared_projects SET board_status_id = :target, revision = revision + 1,
            updated_at = :now WHERE board_status_id = :source')->execute([
                'target' => $targetId, 'source' => $statusId, 'now' => genesisNow(),
            ]);
        $changed = $db->prepare('DELETE FROM shared_project_statuses
            WHERE id = :id AND project_id = :project AND revision = :expected');
        $changed->execute(['id' => $statusId, 'project' => $projectId, 'expected' => $expected]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('STATUS_CONFLICT', 409);
        genesisSharedAudit($projectId, $userId, 'status.deleted', $statusId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedCategoryColor(mixed $value): string
{
    if (!is_string($value) || !preg_match('/\A#[0-9a-fA-F]{6}\z/', $value)) {
        throw new InvalidArgumentException('INVALID_CATEGORY_COLOR');
    }
    return strtolower($value);
}

function genesisSharedCreateCategory(string $userId, string $projectId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $title = genesisSharedTitle($input['title'] ?? null, 80);
    $color = genesisSharedCategoryColor($input['color'] ?? '#2d6c68');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $query = $db->prepare('SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS lastPosition
            FROM shared_project_categories WHERE project_id = :project');
        $query->execute(['project' => $projectId]);
        $summary = $query->fetch();
        if ((int)$summary['count'] >= 50) throw new GenesisSharedAccessException('CATEGORY_LIMIT', 409);
        $id = genesisUuid();
        $position = (int)$summary['lastPosition'] + 1;
        $db->prepare('INSERT INTO shared_project_categories (id, project_id, title, color, position)
            VALUES (:id, :project, :title, :color, :position)')->execute([
                'id' => $id, 'project' => $projectId, 'title' => $title,
                'color' => $color, 'position' => $position,
            ]);
        genesisSharedAudit($projectId, $userId, 'category.created', $id);
        $db->commit();
        return ['id' => $id, 'title' => $title, 'color' => $color,
            'position' => $position, 'revision' => 1];
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedUpdateCategory(string $userId, string $projectId, string $categoryId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $title = genesisSharedTitle($input['title'] ?? null, 80);
    $color = genesisSharedCategoryColor($input['color'] ?? null);
    $expected = filter_var($input['expectedRevision'] ?? null, FILTER_VALIDATE_INT);
    if ($expected === false || $expected < 1) throw new InvalidArgumentException('EXPECTED_REVISION_REQUIRED');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $changed = $db->prepare('UPDATE shared_project_categories SET title = :title, color = :color,
            revision = revision + 1 WHERE id = :id AND project_id = :project AND revision = :expected');
        $changed->execute(['title' => $title, 'color' => $color, 'id' => $categoryId,
            'project' => $projectId, 'expected' => $expected]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('CATEGORY_CONFLICT', 409);
        genesisSharedAudit($projectId, $userId, 'category.updated', $categoryId);
        $db->commit();
        return ['id' => $categoryId, 'title' => $title, 'color' => $color,
            'revision' => $expected + 1];
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedDeleteCategory(string $userId, string $projectId, string $categoryId, array $input): void
{
    genesisSharedRequireEnabled($userId);
    $expected = filter_var($input['expectedRevision'] ?? null, FILTER_VALIDATE_INT);
    if ($expected === false || $expected < 1) throw new InvalidArgumentException('EXPECTED_REVISION_REQUIRED');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $db->prepare('UPDATE shared_tasks SET category_id = NULL, revision = revision + 1,
            updated_by = :actor, updated_at = :now
            WHERE project_id = :project AND category_id = :category')->execute([
                'actor' => $userId, 'now' => genesisNow(), 'project' => $projectId,
                'category' => $categoryId,
            ]);
        $changed = $db->prepare('DELETE FROM shared_project_categories
            WHERE id = :id AND project_id = :project AND revision = :expected');
        $changed->execute(['id' => $categoryId, 'project' => $projectId, 'expected' => $expected]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('CATEGORY_CONFLICT', 409);
        genesisSharedAudit($projectId, $userId, 'category.deleted', $categoryId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedCreateProject(string $userId, string $spaceId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $space = genesisSharedSpaceAccess($spaceId, $userId);
    if (!genesisSharedSpacePermission($space, 'createProjects')) {
        throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
    }
    $title = genesisSharedTitle($input['title'] ?? null);
    $description = genesisSharedText($input['description'] ?? '', 5000);
    $tags = genesisSharedTags($input['tags'] ?? []);
    $layout = $input['layout'] ?? 'list';
    if (!in_array($layout, ['list', 'board'], true)) throw new InvalidArgumentException('INVALID_LAYOUT');
    $parentId = $input['parentId'] ?? null;
    if ($parentId !== null) {
        $parent = genesisSharedProjectAccess((string)$parentId, $userId, 'write');
        if ($parent['space_id'] !== $spaceId) throw new GenesisSharedAccessException();
    }
    $kind = $input['kind'] ?? 'project';
    if (!in_array($kind, ['project', 'task-list'], true)) throw new InvalidArgumentException('INVALID_PROJECT_KIND');
    $boardStatusId = genesisSharedBoardPlacement($userId, $spaceId, $parentId, $input['boardStatusId'] ?? null);
    $id = genesisUuid();
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $space = genesisSharedSpaceAccess($spaceId, $userId);
        if (!genesisSharedSpacePermission($space, 'createProjects')) {
            throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
        }
        if ($parentId !== null) genesisSharedProjectAccess((string)$parentId, $userId, 'write');
        $db->prepare('INSERT INTO shared_projects (id, space_id, parent_id, title, description, tags_json, layout, kind, board_status_id,
            created_by, created_at, updated_at) VALUES (:id, :space, :parent, :title, :description, :tags, :layout, :kind, :board,
            :user, :now, :now)')->execute([
                'id' => $id, 'space' => $spaceId, 'parent' => $parentId, 'title' => $title,
                'description' => $description, 'tags' => json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'layout' => $layout, 'kind' => $kind, 'board' => $boardStatusId, 'user' => $userId, 'now' => $now,
            ]);
        $db->prepare("INSERT INTO shared_project_members (project_id, user_id, role, joined_at)
            VALUES (:project, :user, 'owner', :now)")->execute(['project' => $id, 'user' => $userId, 'now' => $now]);
        $db->prepare("INSERT OR IGNORE INTO shared_project_members (project_id, user_id, role, joined_at)
            SELECT :project, sm.user_id, CASE sm.role WHEN 'owner' THEN 'manager' WHEN 'admin' THEN 'manager' WHEN 'member' THEN 'member' ELSE 'viewer' END, :now FROM shared_space_members sm
            WHERE sm.space_id = :space AND (sm.role IN ('owner', 'admin') OR sm.all_projects = 1)")->execute([
                'project' => $id, 'space' => $spaceId, 'now' => $now]);
        foreach ([['К выполнению', 0], ['В работе', 0], ['Готово', 1]] as $position => [$statusTitle, $done]) {
            $db->prepare('INSERT INTO shared_project_statuses (id, project_id, title, position, is_done)
                VALUES (:id, :project, :title, :position, :done)')->execute([
                    'id' => genesisUuid(), 'project' => $id, 'title' => $statusTitle,
                    'position' => $position, 'done' => $done,
                ]);
        }
        genesisSharedAudit($id, $userId, 'project.created', $id);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    return ['id' => $id, 'spaceId' => $spaceId, 'parentId' => $parentId, 'title' => $title,
        'description' => $description, 'tags' => $tags, 'layout' => $layout, 'kind' => $kind, 'boardStatusId' => $boardStatusId, 'revision' => 1, 'role' => 'owner', 'updatedAt' => $now];
}

/** The shared copy commits as one unit; private cleanup is a separate client step. */
function genesisSharedImportProjectTree(string $userId, string $spaceId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $transferId = $input['transferId'] ?? null;
    $mode = $input['mode'] ?? null;
    $projects = $input['projects'] ?? null;
    $categories = $input['categories'] ?? null;
    $tasks = $input['tasks'] ?? null;
    if (!is_string($transferId) || !preg_match('/\A[a-zA-Z0-9-]{8,100}\z/', $transferId)
        || !in_array($mode, ['copy', 'move'], true)
        || !is_array($projects) || !array_is_list($projects) || count($projects) < 1 || count($projects) > 50
        || !is_array($categories) || !array_is_list($categories) || count($categories) > 200
        || !is_array($tasks) || !array_is_list($tasks) || count($tasks) > 500) {
        throw new InvalidArgumentException('INVALID_PROJECT_IMPORT');
    }
    $sourceId = static function (mixed $value): string {
        if (!is_string($value) || !preg_match('/\A[^\x00-\x1f]{1,100}\z/u', $value)) {
            throw new InvalidArgumentException('INVALID_IMPORT_SOURCE_ID');
        }
        return $value;
    };
    $normalizedProjects = [];
    foreach ($projects as $index => $project) {
        if (!is_array($project)) throw new InvalidArgumentException('INVALID_PROJECT_IMPORT');
        $source = $sourceId($project['sourceId'] ?? null);
        $parent = $project['parentSourceId'] ?? null;
        if ($index === 0 && $parent !== null || $index > 0 && (!is_string($parent) || !isset($normalizedProjects[$parent]))
            || isset($normalizedProjects[$source])) throw new InvalidArgumentException('INVALID_IMPORT_TREE');
        $layout = $project['layout'] ?? 'list';
        if (!in_array($layout, ['list', 'board'], true)) throw new InvalidArgumentException('INVALID_LAYOUT');
        $normalizedProjects[$source] = [
            'parent' => $parent, 'title' => genesisSharedTitle($project['title'] ?? null),
            'description' => genesisSharedText($project['description'] ?? '', 5000), 'tags' => genesisSharedTags($project['tags'] ?? []), 'layout' => $layout,
        ];
    }
    $normalizedCategories = [];
    foreach ($categories as $category) {
        if (!is_array($category)) throw new InvalidArgumentException('INVALID_IMPORT_CATEGORY');
        $projectSource = $sourceId($category['projectSourceId'] ?? null);
        $source = $sourceId($category['sourceId'] ?? null);
        $color = $category['color'] ?? null;
        if (!isset($normalizedProjects[$projectSource]) || !is_string($color)
            || !preg_match('/\A#[0-9a-fA-F]{6}\z/', $color)
            || isset($normalizedCategories[$projectSource][$source])) throw new InvalidArgumentException('INVALID_IMPORT_CATEGORY');
        $normalizedCategories[$projectSource][$source] = [
            'title' => genesisSharedTitle($category['title'] ?? null), 'color' => strtolower($color),
        ];
    }
    $normalizedTasks = [];
    foreach ($tasks as $task) {
        if (!is_array($task)) throw new InvalidArgumentException('INVALID_IMPORT_TASK');
        $source = $sourceId($task['sourceId'] ?? null);
        $projectSource = $sourceId($task['projectSourceId'] ?? null);
        $categorySource = $task['categorySourceId'] ?? null;
        $due = $task['dueDate'] ?? null;
        if (!isset($normalizedProjects[$projectSource]) || isset($normalizedTasks[$source])
            || $categorySource !== null && (!is_string($categorySource)
                || !isset($normalizedCategories[$projectSource][$categorySource]))
            || !is_bool($task['done'] ?? null)
            || $due !== null && (!is_string($due) || !preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $due)
                || !checkdate((int)substr($due, 5, 2), (int)substr($due, 8, 2), (int)substr($due, 0, 4)))) {
            throw new InvalidArgumentException('INVALID_IMPORT_TASK');
        }
        $normalizedTasks[$source] = [
            'projectSource' => $projectSource, 'categorySource' => $categorySource,
            'title' => genesisSharedTitle($task['title'] ?? null),
            'description' => genesisSharedText($task['description'] ?? '', 20000), 'tags' => genesisSharedTags($task['tags'] ?? []),
            'due' => $due, 'done' => $task['done'],
        ];
    }
    $targetParent = $input['targetParentId'] ?? null;
    if ($targetParent !== null) {
        $parent = genesisSharedProjectAccess((string)$targetParent, $userId, 'write');
        if ($parent['space_id'] !== $spaceId) throw new GenesisSharedAccessException();
    }
    $targetBoard = genesisSharedBoardPlacement($userId, $spaceId, $targetParent, $input['targetStatusId'] ?? null);
    $payloadHash = hash('sha256', json_encode([$spaceId, $mode, $targetParent, $targetBoard, $normalizedProjects, $normalizedCategories, $normalizedTasks],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $space = genesisSharedSpaceAccess($spaceId, $userId);
        if (!genesisSharedSpacePermission($space, 'createProjects')) {
            throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
        }
        $existing = $db->prepare('SELECT payload_hash, receipt_json FROM shared_project_imports
            WHERE source_user_id = :user AND transfer_id = :transfer');
        $existing->execute(['user' => $userId, 'transfer' => $transferId]);
        $saved = $existing->fetch();
        if ($saved) {
            if (!hash_equals((string)$saved['payload_hash'], $payloadHash)) {
                throw new GenesisSharedAccessException('SHARED_IMPORT_CONFLICT', 409);
            }
            $db->commit();
            return json_decode((string)$saved['receipt_json'], true, 16, JSON_THROW_ON_ERROR);
        }
        if ($mode === 'move') {
            $transferred = $db->prepare('SELECT 1 FROM shared_task_transfers
                WHERE source_user_id = :user AND source_task_id = :source LIMIT 1');
            foreach (array_keys($normalizedTasks) as $source) {
                $transferred->execute(['user' => $userId, 'source' => $source]);
                if ($transferred->fetchColumn()) {
                    throw new GenesisSharedAccessException('SHARED_TASK_ALREADY_TRANSFERRED', 409);
                }
            }
        }
        $now = genesisNow();
        $projectIds = []; $statusIds = []; $categoryIds = []; $taskIds = [];
        $insertProject = $db->prepare('INSERT INTO shared_projects
            (id, space_id, parent_id, title, description, tags_json, layout, created_by, created_at, updated_at)
            VALUES (:id, :space, :parent, :title, :description, :tags, :layout, :user, :now, :now)');
        $insertMember = $db->prepare("INSERT INTO shared_project_members
            (project_id, user_id, role, joined_at) VALUES (:project, :user, :role, :now)");
        $spaceMembers = $db->prepare('SELECT user_id, role FROM shared_space_members WHERE space_id = :space');
        $spaceMembers->execute(['space' => $spaceId]);
        $members = $spaceMembers->fetchAll();
        $insertStatus = $db->prepare('INSERT INTO shared_project_statuses
            (id, project_id, title, position, is_done) VALUES (:id, :project, :title, :position, :done)');
        foreach ($normalizedProjects as $source => $project) {
            $id = genesisUuid();
            $projectIds[$source] = $id;
            $insertProject->execute(['id' => $id, 'space' => $spaceId,
                'parent' => $project['parent'] === null ? null : $projectIds[$project['parent']],
                'title' => $project['title'], 'description' => $project['description'], 'tags' => json_encode($project['tags'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'layout' => $project['layout'], 'user' => $userId, 'now' => $now]);
            foreach ($members as $member) {
                $role = $member['user_id'] === $userId ? 'owner' : match ($member['role']) {
                    'owner', 'admin' => 'manager', 'member' => 'member', default => 'viewer',
                };
                $insertMember->execute(['project' => $id, 'user' => $member['user_id'],
                    'role' => $role, 'now' => $now]);
            }
            foreach ([['К выполнению', 0], ['В работе', 0], ['Готово', 1]] as $position => [$title, $done]) {
                $statusId = genesisUuid();
                $insertStatus->execute(['id' => $statusId, 'project' => $id, 'title' => $title,
                    'position' => $position, 'done' => $done]);
                $statusIds[$source][$done ? 'done' : ($position === 0 ? 'open' : 'progress')] = $statusId;
            }
            genesisSharedAudit($id, $userId, 'project.imported', $id);
        }
        $insertCategory = $db->prepare('INSERT INTO shared_project_categories
            (id, project_id, title, color, position) VALUES (:id, :project, :title, :color, :position)');
        foreach ($normalizedCategories as $projectSource => $group) {
            foreach ($group as $categorySource => $category) {
                $id = genesisUuid();
                $categoryIds[$projectSource][$categorySource] = $id;
                $insertCategory->execute(['id' => $id, 'project' => $projectIds[$projectSource],
                    'title' => $category['title'], 'color' => $category['color'],
                    'position' => count($categoryIds[$projectSource]) - 1]);
            }
        }
        $insertTask = $db->prepare('INSERT INTO shared_tasks
            (id, project_id, status_id, category_id, title, description, tags_json, due_date,
            created_by, updated_by, completed_by, completed_at, created_at, updated_at)
            VALUES (:id, :project, :status, :category, :title, :description, :tags, :due,
            :user, :user, :completed_by, :completed_at, :now, :now)');
        foreach ($normalizedTasks as $source => $task) {
            $id = genesisUuid();
            $taskIds[$source] = $id;
            $projectSource = $task['projectSource'];
            $insertTask->execute(['id' => $id, 'project' => $projectIds[$projectSource],
                'status' => $statusIds[$projectSource][$task['done'] ? 'done' : 'open'],
                'category' => $task['categorySource'] === null ? null
                    : $categoryIds[$projectSource][$task['categorySource']],
                'title' => $task['title'], 'description' => $task['description'], 'tags' => json_encode($task['tags'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'due' => $task['due'], 'user' => $userId,
                'completed_by' => $task['done'] ? $userId : null,
                'completed_at' => $task['done'] ? $now : null, 'now' => $now]);
            if ($mode === 'move') {
                $db->prepare('INSERT INTO shared_task_transfers
                    (source_user_id, source_task_id, target_project_id, target_task_id, created_at)
                    VALUES (:user, :source, :project, :task, :now)')->execute([
                    'user' => $userId, 'source' => $source,
                    'project' => $projectIds[$projectSource], 'task' => $id, 'now' => $now]);
            }
        }
        if ($targetParent !== null) {
            genesisSharedProjectAccess((string)$targetParent, $userId, 'write');
            $db->prepare('UPDATE shared_projects SET parent_id = :parent, board_status_id = :board WHERE id = :id')
                ->execute(['parent' => $targetParent, 'board' => $targetBoard, 'id' => reset($projectIds)]);
        }
        $receipt = ['rootProjectId' => reset($projectIds), 'projectIds' => $projectIds,
            'taskIds' => $taskIds, 'taskCount' => count($taskIds), 'mode' => $mode];
        $db->prepare('INSERT INTO shared_project_imports
            (source_user_id, transfer_id, payload_hash, root_project_id, receipt_json, created_at)
            VALUES (:user, :transfer, :hash, :root, :receipt, :now)')->execute([
            'user' => $userId, 'transfer' => $transferId, 'hash' => $payloadHash,
            'root' => $receipt['rootProjectId'],
            'receipt' => json_encode($receipt, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'now' => $now]);
        $db->commit();
        return $receipt;
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

/** Board columns and list-view groups are the same server-owned team task lists. */
function genesisSharedTaskLists(string $userId): array
{
    genesisSharedRequireEnabled($userId);
    $query = genesisDb()->prepare('SELECT st.id, st.title, st.position, st.is_done AS isDone,
        st.revision, p.id AS projectId, p.title AS projectTitle,
        s.id AS spaceId, s.title AS spaceTitle, pm.role,
        COUNT(t.id) AS taskCount,
        SUM(CASE WHEN t.id IS NOT NULL AND st.is_done = 0 THEN 1 ELSE 0 END) AS openCount
        FROM shared_project_statuses st
        JOIN shared_projects p ON p.id = st.project_id AND p.archived_at IS NULL AND p.is_inbox = 0
        JOIN shared_spaces s ON s.id = p.space_id
        JOIN shared_project_members pm ON pm.project_id = p.id AND pm.user_id = :user
        JOIN shared_space_members sm ON sm.space_id = s.id AND sm.user_id = :user
        LEFT JOIN shared_tasks t ON t.status_id = st.id AND t.project_id = p.id
        GROUP BY st.id ORDER BY s.title, p.title, st.position LIMIT 1000');
    $query->execute(['user' => $userId]);
    return $query->fetchAll();
}

function genesisSharedRequestId(array $input): ?string
{
    if (!array_key_exists('requestId', $input)) return null;
    $requestId = $input['requestId'];
    if (!is_string($requestId) || !preg_match('/\A[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\z/i', $requestId)) {
        throw new InvalidArgumentException('INVALID_SHARED_REQUEST_ID');
    }
    return strtolower($requestId);
}

function genesisSharedMutationReceipt(PDO $db, string $userId, ?string $requestId,
    string $action, string $resourceId): ?array
{
    if ($requestId === null) return null;
    $query = $db->prepare('SELECT action, resource_id, response_json FROM shared_mutation_receipts
        WHERE user_id = :user AND request_id = :request LIMIT 1');
    $query->execute(['user' => $userId, 'request' => $requestId]);
    $row = $query->fetch();
    if (!$row) return null;
    if ($row['action'] !== $action || $row['resource_id'] !== $resourceId) {
        throw new GenesisSharedAccessException('SHARED_REQUEST_ID_CONFLICT', 409);
    }
    return json_decode((string)$row['response_json'], true, 512, JSON_THROW_ON_ERROR);
}

function genesisSharedSaveMutationReceipt(PDO $db, string $userId, ?string $requestId,
    string $action, string $resourceId, array $response): void
{
    if ($requestId === null) return;
    $db->prepare('INSERT INTO shared_mutation_receipts
        (user_id, request_id, action, resource_id, response_json, created_at)
        VALUES (:user, :request, :action, :resource, :response, :created)')->execute([
            'user' => $userId, 'request' => $requestId, 'action' => $action,
            'resource' => $resourceId, 'response' => json_encode($response, JSON_THROW_ON_ERROR),
            'created' => genesisNow(),
        ]);
}

function genesisSharedUpdateProject(string $userId, string $projectId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $project = genesisSharedProjectAccess($projectId, $userId, 'manage');
    if ((int)$project['is_inbox'] === 1) throw new GenesisSharedAccessException('INBOX_CANNOT_BE_EDITED', 403);
    if (!isset($input['expectedRevision']) || (int)$input['expectedRevision'] !== (int)$project['revision']) {
        throw new GenesisSharedAccessException('SHARED_PROJECT_CONFLICT', 409);
    }
    $title = array_key_exists('title', $input) ? genesisSharedTitle($input['title']) : $project['title'];
    $description = array_key_exists('description', $input)
        ? genesisSharedText($input['description'], 5000) : $project['description'];
    $tags = array_key_exists('tags', $input) ? genesisSharedTags($input['tags']) : json_decode($project['tags_json'], true);
    $layout = $input['layout'] ?? $project['layout'];
    if (!in_array($layout, ['list', 'board'], true)) throw new InvalidArgumentException('INVALID_LAYOUT');
    $parentId = array_key_exists('parentId', $input) ? $input['parentId'] : $project['parent_id'];
    if ($parentId !== null) {
        if (!is_string($parentId)) throw new InvalidArgumentException('INVALID_PARENT');
        $visited = [$projectId => true];
        $cursor = $parentId;
        $query = genesisDb()->prepare('SELECT parent_id, space_id FROM shared_projects
            WHERE id = :id AND archived_at IS NULL');
        while ($cursor !== null) {
            if (isset($visited[$cursor])) throw new InvalidArgumentException('PROJECT_CYCLE');
            $visited[$cursor] = true;
            genesisSharedProjectAccess($cursor, $userId, 'write');
            $query->execute(['id' => $cursor]);
            $ancestor = $query->fetch();
            if (!$ancestor || $ancestor['space_id'] !== $project['space_id']) throw new GenesisSharedAccessException();
            $cursor = $ancestor['parent_id'];
        }
    }
    $boardStatusId = genesisSharedBoardPlacement($userId, $project['space_id'], $parentId,
        array_key_exists('boardStatusId', $input) ? $input['boardStatusId']
            : ($parentId === $project['parent_id'] ? $project['board_status_id'] : null));
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $changed = $db->prepare('UPDATE shared_projects SET title = :title, description = :description, tags_json = :tags,
            layout = :layout, parent_id = :parent, board_status_id = :board, updated_at = :now, revision = revision + 1
            WHERE id = :id AND revision = :expected');
        $changed->execute([
            'title' => $title, 'description' => $description, 'tags' => json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'layout' => $layout,
            'parent' => $parentId, 'board' => $boardStatusId, 'now' => $now, 'id' => $projectId,
            'expected' => (int)$project['revision'],
        ]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('SHARED_PROJECT_CONFLICT', 409);
        genesisSharedAudit($projectId, $userId, 'project.updated', $projectId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    return ['id' => $projectId, 'spaceId' => $project['space_id'], 'parentId' => $parentId,
        'title' => $title, 'description' => $description, 'tags' => $tags, 'layout' => $layout, 'kind' => $project['kind'], 'boardStatusId' => $boardStatusId,
        'revision' => (int)$project['revision'] + 1, 'role' => $project['member_role'],
        'updatedAt' => $now];
}

function genesisSharedSetMemberRole(string $userId, string $projectId, string $targetId, array $input): void
{
    genesisSharedRequireEnabled($userId);
    $project = genesisSharedProjectAccess($projectId, $userId, 'owner');
    if ((int)$project['is_inbox'] === 1) throw new GenesisSharedAccessException('INBOX_MEMBERSHIP_MANAGED_BY_SPACE', 403);
    $role = (string)($input['role'] ?? '');
    if (!in_array($role, ['owner', 'manager', 'member', 'commenter', 'viewer'], true)) {
        throw new InvalidArgumentException('INVALID_ROLE');
    }
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'owner');
        $query = $db->prepare('SELECT role FROM shared_project_members WHERE project_id = :project AND user_id = :user');
        $query->execute(['project' => $projectId, 'user' => $targetId]);
        $oldRole = $query->fetchColumn();
        if ($oldRole === false) throw new GenesisSharedAccessException();
        if ($oldRole === 'owner' && $role !== 'owner') {
            $owners = $db->prepare("SELECT COUNT(*) FROM shared_project_members WHERE project_id = :project AND role = 'owner'");
            $owners->execute(['project' => $projectId]);
            if ((int)$owners->fetchColumn() <= 1) throw new GenesisSharedAccessException('LAST_OWNER', 409);
        }
        $db->prepare('UPDATE shared_project_members SET role = :role WHERE project_id = :project AND user_id = :user')
            ->execute(['role' => $role, 'project' => $projectId, 'user' => $targetId]);
        genesisSharedAudit($projectId, $userId, 'member.role_changed', $targetId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedSetSpaceRole(string $userId, string $spaceId, string $targetId, array $input): void
{
    genesisSharedRequireEnabled($userId);
    $space = genesisSharedSpaceAccess($spaceId, $userId);
    if ($space['member_role'] !== 'owner') throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
    $role = (string)($input['role'] ?? '');
    if (!in_array($role, ['owner', 'admin', 'member', 'guest'], true)) throw new InvalidArgumentException('INVALID_ROLE');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $space = genesisSharedSpaceAccess($spaceId, $userId);
        if ($space['member_role'] !== 'owner') throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
        $member = $db->prepare('SELECT role, can_organize_tasks, permissions_json FROM shared_space_members
            WHERE space_id = :space AND user_id = :user');
        $member->execute(['space' => $spaceId, 'user' => $targetId]);
        $existing = $member->fetch();
        if (!$existing) throw new GenesisSharedAccessException();
        $oldRole = $existing['role'];
        $permissions = array_key_exists('permissions', $input) ? genesisSharedPermissionInput($input['permissions'])
            : ($role !== $oldRole ? genesisSharedPermissions($role) : null);
        $permissionsJson = array_key_exists('permissions', $input) || $role !== $oldRole
            ? ($permissions === null ? null : json_encode($permissions, JSON_THROW_ON_ERROR)) : $existing['permissions_json'];
        $canOrganize = $input['canOrganizeTasks'] ?? ((int)$existing['can_organize_tasks'] === 1);
        if (!is_bool($canOrganize)) throw new InvalidArgumentException('INVALID_ORGANIZER_PERMISSION');
        if ($oldRole === 'owner' && $role !== 'owner') {
            $owners = $db->prepare("SELECT COUNT(*) FROM shared_space_members WHERE space_id = :space AND role = 'owner'");
            $owners->execute(['space' => $spaceId]);
            if ((int)$owners->fetchColumn() <= 1) throw new GenesisSharedAccessException('LAST_OWNER', 409);
        }
        $db->prepare('UPDATE shared_space_members SET role = :role, can_organize_tasks = :organize, permissions_json = :permissions
            WHERE space_id = :space AND user_id = :user')->execute([
                'role' => $role, 'organize' => $canOrganize ? 1 : 0, 'permissions' => $permissionsJson,
                'space' => $spaceId, 'user' => $targetId]);
        if (in_array($role, ['owner', 'admin'], true)) {
            $db->prepare("INSERT OR IGNORE INTO shared_project_members (project_id, user_id, role, joined_at)
                SELECT p.id, :user, 'manager', :now FROM shared_projects p WHERE p.space_id = :space")
                ->execute(['user' => $targetId, 'now' => genesisNow(), 'space' => $spaceId]);
        }
        $inbox = $db->prepare('SELECT id FROM shared_projects WHERE space_id = :space AND is_inbox = 1');
        $inbox->execute(['space' => $spaceId]);
        $inboxId = $inbox->fetchColumn();
        if ($inboxId !== false) {
            if ($role === 'guest') {
                $db->prepare('DELETE FROM shared_google_projection_links
                    WHERE user_id = :user AND task_id IN
                    (SELECT id FROM shared_tasks WHERE project_id = :project)')
                    ->execute(['project' => $inboxId, 'user' => $targetId]);
                $db->prepare('DELETE FROM shared_project_members WHERE project_id = :project AND user_id = :user')
                    ->execute(['project' => $inboxId, 'user' => $targetId]);
                $db->prepare('UPDATE shared_tasks SET assignee_id = NULL, revision = revision + 1,
                    updated_by = :actor, updated_at = :now WHERE project_id = :project AND assignee_id = :user')
                    ->execute(['actor' => $userId, 'now' => genesisNow(), 'project' => $inboxId, 'user' => $targetId]);
            } else {
                $db->prepare('INSERT INTO shared_project_members (project_id, user_id, role, joined_at)
                    VALUES (:project, :user, :role, :now)
                    ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role')->execute([
                        'project' => $inboxId, 'user' => $targetId,
                        'role' => $role === 'owner' ? 'owner' : 'member', 'now' => genesisNow(),
                    ]);
            }
            genesisSharedAudit((string)$inboxId, $userId, 'space_member.role_changed', $targetId);
        }
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedRemoveMember(string $userId, string $projectId, string $targetId): void
{
    genesisSharedRequireEnabled($userId);
    $project = genesisSharedProjectAccess($projectId, $userId, $userId === $targetId ? 'read' : 'owner');
    if ((int)$project['is_inbox'] === 1) throw new GenesisSharedAccessException('INBOX_MEMBERSHIP_MANAGED_BY_SPACE', 403);
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, $userId === $targetId ? 'read' : 'owner');
        $query = $db->prepare('SELECT role FROM shared_project_members WHERE project_id = :project AND user_id = :user');
        $query->execute(['project' => $projectId, 'user' => $targetId]);
        $role = $query->fetchColumn();
        if ($role === false) throw new GenesisSharedAccessException();
        if ($role === 'owner') {
            $owners = $db->prepare("SELECT COUNT(*) FROM shared_project_members WHERE project_id = :project AND role = 'owner'");
            $owners->execute(['project' => $projectId]);
            if ((int)$owners->fetchColumn() <= 1) throw new GenesisSharedAccessException('LAST_OWNER', 409);
        }
        $db->prepare('DELETE FROM shared_google_projection_links
            WHERE user_id = :user AND task_id IN
            (SELECT id FROM shared_tasks WHERE project_id = :project)')
            ->execute(['project' => $projectId, 'user' => $targetId]);
        $db->prepare('DELETE FROM shared_project_members WHERE project_id = :project AND user_id = :user')
            ->execute(['project' => $projectId, 'user' => $targetId]);
        $db->prepare('UPDATE shared_tasks SET assignee_id = NULL, revision = revision + 1,
            updated_by = :actor, updated_at = :now
            WHERE project_id = :project AND assignee_id = :user')->execute([
                'project' => $projectId, 'user' => $targetId,
                'actor' => $userId, 'now' => genesisNow(),
            ]);
        $space = $db->prepare('SELECT space_id FROM shared_projects WHERE id = :project');
        $space->execute(['project' => $projectId]);
        $spaceId = $space->fetchColumn();
        $otherProjects = $db->prepare('SELECT COUNT(*) FROM shared_project_members m
            JOIN shared_projects p ON p.id = m.project_id
            WHERE p.space_id = :space AND p.is_inbox = 0 AND m.user_id = :user');
        $otherProjects->execute(['space' => $spaceId, 'user' => $targetId]);
        if ((int)$otherProjects->fetchColumn() === 0) {
            $spaceRole = $db->prepare('SELECT role FROM shared_space_members WHERE space_id = :space AND user_id = :user');
            $spaceRole->execute(['space' => $spaceId, 'user' => $targetId]);
            if ($spaceRole->fetchColumn() === 'guest') {
                $db->prepare('DELETE FROM shared_project_members WHERE project_id IN
                    (SELECT id FROM shared_projects WHERE space_id = :space AND is_inbox = 1) AND user_id = :user')
                    ->execute(['space' => $spaceId, 'user' => $targetId]);
                $db->prepare('DELETE FROM shared_space_members WHERE space_id = :space AND user_id = :user')
                    ->execute(['space' => $spaceId, 'user' => $targetId]);
            }
        }
        genesisSharedAudit($projectId, $userId, 'member.removed', $targetId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedProjectSnapshot(string $userId, string $projectId): array
{
    genesisSharedRequireEnabled($userId);
    $project = genesisSharedProjectAccess($projectId, $userId);
    $db = genesisDb();
    $statuses = $db->prepare('SELECT id, title, position, is_done AS isDone, revision, color, image_url AS imageUrl FROM shared_project_statuses
        WHERE project_id = :project ORDER BY position');
    $statuses->execute(['project' => $projectId]);
    $categories = $db->prepare('SELECT id, title, color, position, revision
        FROM shared_project_categories WHERE project_id = :project ORDER BY position');
    $categories->execute(['project' => $projectId]);
    $tasks = $db->prepare('SELECT t.id, t.project_id AS projectId, t.status_id AS statusId, t.title,
        t.category_id AS categoryId, t.description, t.tags_json AS tagsJson, t.due_date AS dueDate,
        t.assignee_id AS assigneeId, t.created_by AS createdBy,
        t.updated_by AS updatedBy, t.completed_by AS completedBy, t.completed_at AS completedAt,
        t.position, t.revision, t.updated_at AS updatedAt FROM shared_tasks t
        WHERE t.project_id = :project ORDER BY t.status_id, t.position LIMIT 500');
    $tasks->execute(['project' => $projectId]);
    $members = $db->prepare('SELECT m.user_id AS userId, m.role, sm.role AS spaceRole,
        sm.can_organize_tasks AS canOrganizeTasks, sm.permissions_json AS permissionsJson,
        u.display_name AS displayName FROM shared_project_members m
        JOIN users u ON u.id = m.user_id
        JOIN shared_space_members sm ON sm.space_id = :space AND sm.user_id = m.user_id
        WHERE m.project_id = :project');
    $members->execute(['project' => $projectId, 'space' => $project['space_id']]);
    return [
        'project' => [
            'id' => $projectId, 'spaceId' => $project['space_id'], 'parentId' => $project['parent_id'],
            'title' => $project['title'], 'description' => $project['description'], 'tags' => json_decode($project['tags_json'], true),
            'layout' => $project['layout'], 'kind' => $project['kind'], 'boardStatusId' => $project['board_status_id'], 'isInbox' => (int)$project['is_inbox'],
            'revision' => (int)$project['revision'],
            'role' => $project['member_role'], 'spaceRole' => $project['space_member_role'],
            'canOrganizeTasks' => $project['permissions']['organizeTasks'],
            'canCreateBoards' => $project['permissions'][$project['space_permissions_json'] === null ? 'editTasks' : 'manageProjects'],
            'permissions' => $project['permissions'],
            'updatedAt' => $project['updated_at'],
        ],
        'statuses' => $statuses->fetchAll(), 'categories' => $categories->fetchAll(),
        'tasks' => array_map('genesisSharedRowTags', $tasks->fetchAll()), 'members' => array_map(static function (array $member): array {
            $member['permissions'] = genesisSharedPermissions($member['spaceRole'], $member['permissionsJson'], (int)$member['canOrganizeTasks'] === 1, $member['role']);
            unset($member['permissionsJson']); return $member;
        }, $members->fetchAll()),
    ];
}

function genesisSharedInvite(string $userId, string $projectId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedProjectAccess($projectId, $userId, 'invite');
    $email = mb_strtolower(trim((string)($input['email'] ?? '')));
    if (!genesisIsValidEmail($email)) throw new InvalidArgumentException('INVALID_EMAIL');
    $role = (string)($input['role'] ?? 'member');
    if (!in_array($role, ['manager', 'member', 'commenter', 'viewer'], true)) {
        throw new InvalidArgumentException('INVALID_ROLE');
    }
    $existingMember = genesisDb()->prepare('SELECT 1 FROM shared_project_members m
        JOIN users u ON u.id = m.user_id WHERE m.project_id = :project AND u.email = :email COLLATE NOCASE');
    $existingMember->execute(['project' => $projectId, 'email' => $email]);
    if ($existingMember->fetchColumn()) throw new InvalidArgumentException('ALREADY_PROJECT_MEMBER');
    $recipientQuery = genesisDb()->prepare('SELECT * FROM users WHERE email = :email COLLATE NOCASE LIMIT 1');
    $recipientQuery->execute(['email' => $email]);
    $recipient = $recipientQuery->fetch();
    if (!$recipient) throw new GenesisSharedAccessException('INVITEE_ACCOUNT_NOT_FOUND', 404);
    if (!genesisSharedEligible($recipient)) {
        throw new GenesisSharedAccessException('INVITEE_ACCOUNT_UNSUPPORTED', 403);
    }
    $token = bin2hex(random_bytes(32));
    $id = genesisUuid();
    $now = genesisNow();
    $expires = gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400);
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'invite');
        $db->prepare('UPDATE shared_invitations SET revoked_at = :now
            WHERE project_id = :project AND email = :email COLLATE NOCASE
            AND consumed_at IS NULL AND revoked_at IS NULL')->execute([
                'now' => $now, 'project' => $projectId, 'email' => $email,
            ]);
        $db->prepare('INSERT INTO shared_invitations (id, project_id, email, role, token_hash,
            expires_at, created_by, created_at) VALUES (:id, :project, :email, :role, :hash,
            :expires, :user, :now)')->execute([
                'id' => $id, 'project' => $projectId, 'email' => $email, 'role' => $role,
                'hash' => hash('sha256', $token), 'expires' => $expires, 'user' => $userId, 'now' => $now,
            ]);
        genesisSharedAudit($projectId, $userId, 'invitation.created', $id);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    return ['id' => $id, 'expiresAt' => $expires];
}

function genesisSharedInvitations(string $userId): array
{
    $user = genesisSharedRequireEligible($userId);
    $query = genesisDb()->prepare('SELECT i.id, i.role, i.expires_at AS expiresAt,
        p.title AS projectTitle, s.title AS spaceTitle,
        COALESCE(NULLIF(inviter.display_name, \'\'), inviter.email, \'Участник GENESIS\') AS inviterName
        FROM shared_invitations i
        JOIN shared_projects p ON p.id = i.project_id AND p.archived_at IS NULL
        JOIN shared_spaces s ON s.id = p.space_id
        LEFT JOIN users inviter ON inviter.id = i.created_by
        WHERE i.email = :email COLLATE NOCASE AND i.consumed_at IS NULL
        AND i.revoked_at IS NULL AND i.expires_at > :now
        ORDER BY i.created_at DESC LIMIT 100');
    $query->execute(['email' => $user['email'], 'now' => genesisNow()]);
    return $query->fetchAll();
}

function genesisSharedCalendarTasks(string $userId, string $from, string $to): array
{
    genesisSharedRequireEnabled($userId);
    $start = DateTimeImmutable::createFromFormat('!Y-m-d', $from);
    $end = DateTimeImmutable::createFromFormat('!Y-m-d', $to);
    if (!$start || !$end || $start->format('Y-m-d') !== $from || $end->format('Y-m-d') !== $to
        || $end < $start || $start->diff($end)->days > 1200) {
        throw new InvalidArgumentException('INVALID_SHARED_CALENDAR_RANGE');
    }
    $query = genesisDb()->prepare('SELECT t.id, t.title, t.due_date AS dueDate,
        t.completed_at AS completedAt, p.id AS projectId, p.title AS projectTitle,
        p.space_id AS spaceId, p.is_inbox AS isInbox
        FROM shared_tasks t JOIN shared_projects p ON p.id = t.project_id AND p.archived_at IS NULL
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
        WHERE t.due_date BETWEEN :start AND :end ORDER BY t.due_date, t.position LIMIT 5000');
    $query->execute(['user' => $userId, 'start' => $from, 'end' => $to]);
    return $query->fetchAll();
}

/** Team activity is visible only while the user retains membership in each project. */
function genesisSharedNotifications(string $userId): array
{
    genesisSharedRequireEnabled($userId);
    $query = genesisDb()->prepare('SELECT e.id, e.action, e.object_id AS objectId,
        e.created_at AS createdAt, p.id AS projectId, p.title AS projectTitle,
        p.space_id AS spaceId, COALESCE(NULLIF(u.display_name, \'\'), u.email, \'Участник GENESIS\') AS actorName,
        t.title AS taskTitle, CASE WHEN r.event_id IS NULL THEN 0 ELSE 1 END AS isRead
        FROM shared_audit_events e
        JOIN shared_projects p ON p.id = e.project_id AND p.archived_at IS NULL
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :member
        JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = m.user_id
        LEFT JOIN users u ON u.id = e.actor_id
        LEFT JOIN shared_tasks t ON t.id = e.object_id
        LEFT JOIN shared_notification_reads r ON r.event_id = e.id AND r.user_id = :reader
        WHERE e.actor_id IS NOT :actor AND e.action IN
            (\'task.created\', \'task.updated\', \'task.moved_in\', \'task.moved_out\',
             \'comment.created\', \'project.created\', \'project.updated\',
             \'invitation.accepted\', \'member.role_changed\')
        ORDER BY e.created_at DESC, e.id DESC LIMIT 100');
    $query->execute(['member' => $userId, 'reader' => $userId, 'actor' => $userId]);
    return $query->fetchAll();
}

function genesisSharedReadNotifications(string $userId, array $input): void
{
    genesisSharedRequireEnabled($userId);
    $ids = $input['eventIds'] ?? null;
    if (!is_array($ids) || !array_is_list($ids) || count($ids) > 100 ||
        array_filter($ids, static fn(mixed $id): bool => !is_string($id) ||
            !preg_match('/\A[a-f0-9-]{36}\z/', $id))) {
        throw new InvalidArgumentException('INVALID_NOTIFICATION_IDS');
    }
    $visible = array_column(genesisSharedNotifications($userId), 'id');
    $save = genesisDb()->prepare('INSERT OR IGNORE INTO shared_notification_reads (event_id, user_id, read_at)
        VALUES (:event, :user, :now)');
    foreach (array_unique($ids) as $id) {
        if (!in_array($id, $visible, true)) throw new GenesisSharedAccessException();
        $save->execute(['event' => $id, 'user' => $userId, 'now' => genesisNow()]);
    }
}

function genesisSharedAcceptInvite(string $userId, array $input): array
{
    $user = genesisSharedRequireEligible($userId);
    $id = (string)($input['id'] ?? '');
    if (!preg_match('/\A[a-f0-9-]{36}\z/', $id)) throw new InvalidArgumentException('INVALID_INVITATION');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $query = $db->prepare('SELECT i.*, p.space_id FROM shared_invitations i
            JOIN shared_projects p ON p.id = i.project_id
            WHERE i.id = :id AND i.consumed_at IS NULL AND i.revoked_at IS NULL
            AND i.expires_at > :now AND p.archived_at IS NULL LIMIT 1');
        $now = genesisNow();
        $query->execute(['id' => $id, 'now' => $now]);
        $invite = $query->fetch();
        if (!$invite || !hash_equals(mb_strtolower((string)$invite['email']), mb_strtolower((string)$user['email']))) {
            throw new GenesisSharedAccessException('INVALID_INVITATION');
        }
        $db->prepare('UPDATE users SET shared_projects_enabled = 1, updated_at = :now WHERE id = :user')
            ->execute(['now' => $now, 'user' => $userId]);
        $db->prepare("INSERT OR IGNORE INTO shared_space_members (space_id, user_id, role, joined_at)
            VALUES (:space, :user, 'guest', :now)")->execute([
                'space' => $invite['space_id'], 'user' => $userId, 'now' => $now,
            ]);
        $db->prepare('INSERT OR IGNORE INTO shared_project_members (project_id, user_id, role, joined_at)
            VALUES (:project, :user, :role, :now)')->execute([
                'project' => $invite['project_id'], 'user' => $userId,
                'role' => $invite['role'], 'now' => $now,
            ]);
        $spaceRole = $db->prepare('SELECT role FROM shared_space_members WHERE space_id = :space AND user_id = :user');
        $spaceRole->execute(['space' => $invite['space_id'], 'user' => $userId]);
        if ($spaceRole->fetchColumn() !== 'guest') {
            $inbox = $db->prepare('SELECT id FROM shared_projects WHERE space_id = :space AND is_inbox = 1');
            $inbox->execute(['space' => $invite['space_id']]);
            $inboxId = $inbox->fetchColumn();
            if ($inboxId !== false) {
            $db->prepare("INSERT OR IGNORE INTO shared_project_members (project_id, user_id, role, joined_at)
                VALUES (:project, :user, 'member', :now)")->execute([
                    'project' => $inboxId, 'user' => $userId, 'now' => $now,
                ]);
            }
        }
        $db->prepare('UPDATE shared_invitations SET consumed_at = :now WHERE id = :id
            AND consumed_at IS NULL')->execute(['now' => $now, 'id' => $invite['id']]);
        genesisSharedAudit((string)$invite['project_id'], $userId, 'invitation.accepted', (string)$invite['id']);
        $db->commit();
        return ['projectId' => $invite['project_id'], 'spaceId' => $invite['space_id']];
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

/** Move one server-owned task within its workspace, including to or from its inbox. */
function genesisSharedMoveTask(string $userId, string $sourceProjectId, string $taskId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $requestId = genesisSharedRequestId($input);
    $destinationId = (string)($input['destinationProjectId'] ?? $sourceProjectId);
    $statusId = (string)($input['statusId'] ?? '');
    $expected = $input['expectedRevision'] ?? null;
    $position = $input['position'] ?? null;
    if (!is_int($expected) || $expected < 1 || !is_int($position) || $position < 0) {
        throw new InvalidArgumentException('INVALID_TASK_MOVE');
    }
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $source = genesisSharedProjectAccess($sourceProjectId, $userId, 'organize');
        $destination = genesisSharedProjectAccess($destinationId, $userId, 'organize');
        if ($source['space_id'] !== $destination['space_id']) {
            throw new GenesisSharedAccessException('SHARED_CROSS_SPACE_MOVE_FORBIDDEN', 403);
        }
        $receipt = genesisSharedMutationReceipt($db, $userId, $requestId, 'task.move', $taskId);
        if ($receipt !== null) {
            $db->commit();
            return $receipt;
        }
        $query = $db->prepare('SELECT * FROM shared_tasks WHERE id = :id AND project_id = :project');
        $query->execute(['id' => $taskId, 'project' => $sourceProjectId]);
        $task = $query->fetch();
        if (!$task) throw new GenesisSharedAccessException();
        if ((int)$task['revision'] !== $expected) {
            throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT', 409);
        }
        $query = $db->prepare('SELECT is_done FROM shared_project_statuses
            WHERE id = :status AND project_id = :project');
        $query->execute(['status' => $statusId, 'project' => $destinationId]);
        $isDone = $query->fetchColumn();
        if ($isDone === false) throw new InvalidArgumentException('INVALID_STATUS');
        $now = genesisNow();
        $changedProject = $sourceProjectId !== $destinationId;
        $assignee = $task['assignee_id'];
        if ($changedProject && $assignee !== null) {
            $query = $db->prepare('SELECT 1 FROM shared_project_members
                WHERE project_id = :project AND user_id = :user');
            $query->execute(['project' => $destinationId, 'user' => $assignee]);
            if (!$query->fetchColumn()) $assignee = null;
        }
        $done = (int)$isDone === 1;
        $completedBy = $done ? ($task['completed_by'] ?? $userId) : null;
        $completedAt = $done ? ($task['completed_at'] ?? $now) : null;
        $update = $db->prepare('UPDATE shared_tasks SET project_id = :project, status_id = :status,
            category_id = :category, assignee_id = :assignee, completed_by = :completed_by,
            completed_at = :completed_at, updated_by = :actor, updated_at = :now,
            revision = revision + 1 WHERE id = :id AND project_id = :source AND revision = :expected');
        $update->execute(['project' => $destinationId, 'status' => $statusId,
                'category' => $changedProject ? null : $task['category_id'], 'assignee' => $assignee,
                'completed_by' => $completedBy, 'completed_at' => $completedAt,
                'actor' => $userId, 'now' => $now, 'id' => $taskId,
                'source' => $sourceProjectId, 'expected' => $expected]);
        if ($update->rowCount() !== 1) throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT', 409);
        if ($changedProject) {
            $links = $db->prepare('SELECT l.user_id, l.destination, l.google_id,
                COALESCE(l.google_list_id, source_pref.google_task_list_id) AS source_list_id,
                destination_member.user_id AS destination_member_id,
                destination_pref.tasks_enabled, destination_pref.calendar_enabled
                FROM shared_google_projection_links l
                LEFT JOIN shared_google_preferences source_pref ON source_pref.project_id = :source
                    AND source_pref.user_id = l.user_id
                LEFT JOIN shared_project_members destination_member
                    ON destination_member.project_id = :destination AND destination_member.user_id = l.user_id
                LEFT JOIN shared_google_preferences destination_pref
                    ON destination_pref.project_id = :destination_pref AND destination_pref.user_id = l.user_id
                WHERE l.task_id = :task');
            $links->execute(['source' => $sourceProjectId, 'destination' => $destinationId,
                'destination_pref' => $destinationId, 'task' => $taskId]);
            $setList = $db->prepare('UPDATE shared_google_projection_links SET google_list_id = :list
                WHERE task_id = :task AND user_id = :user AND destination = \'tasks\'');
            $queue = $db->prepare('INSERT INTO shared_google_projection_cleanup
                (id, user_id, destination, google_id, google_list_id, created_at)
                VALUES (:id, :user, :destination, :google, :list, :now)');
            $deleteLink = $db->prepare('DELETE FROM shared_google_projection_links
                WHERE task_id = :task AND user_id = :user AND destination = :destination');
            foreach ($links->fetchAll() as $link) {
                $destinationConsent = $link['destination'] === 'tasks'
                    ? !empty($link['tasks_enabled']) : !empty($link['calendar_enabled']);
                if ($link['destination_member_id'] !== null && $destinationConsent) {
                    if ($link['destination'] === 'tasks') $setList->execute([
                        'list' => $link['source_list_id'], 'task' => $taskId, 'user' => $link['user_id'],
                    ]);
                    continue;
                }
                if ($link['google_id'] !== '') $queue->execute([
                    'id' => genesisUuid(), 'user' => $link['user_id'], 'destination' => $link['destination'],
                    'google' => $link['google_id'], 'list' => $link['source_list_id'], 'now' => $now,
                ]);
                $deleteLink->execute(['task' => $taskId, 'user' => $link['user_id'],
                    'destination' => $link['destination']]);
            }
        }
        $query = $db->prepare('SELECT id FROM shared_tasks WHERE project_id = :project
            AND status_id = :status AND id <> :task ORDER BY position, created_at, id');
        $query->execute(['project' => $destinationId, 'status' => $statusId, 'task' => $taskId]);
        $ordered = $query->fetchAll(PDO::FETCH_COLUMN);
        array_splice($ordered, min($position, count($ordered)), 0, [$taskId]);
        $reposition = $db->prepare('UPDATE shared_tasks SET position = :position WHERE id = :id');
        foreach ($ordered as $index => $id) $reposition->execute(['position' => $index, 'id' => $id]);
        genesisSharedAudit($sourceProjectId, $userId, 'task.moved_out', $taskId);
        if ($changedProject) genesisSharedAudit($destinationId, $userId, 'task.moved_in', $taskId);
        $response = ['id' => $taskId, 'projectId' => $destinationId, 'statusId' => $statusId,
            'position' => min($position, count($ordered) - 1), 'revision' => $expected + 1,
            'assigneeId' => $assignee, 'categoryId' => $changedProject ? null : $task['category_id']];
        genesisSharedSaveMutationReceipt($db, $userId, $requestId, 'task.move', $taskId, $response);
        $db->commit();
        return $response;
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedRejectInvite(string $userId, string $id): void
{
    $user = genesisSharedRequireEligible($userId);
    $query = genesisDb()->prepare('SELECT i.project_id FROM shared_invitations i
        WHERE i.id = :id AND i.email = :email COLLATE NOCASE AND i.consumed_at IS NULL
        AND i.revoked_at IS NULL AND i.expires_at > :now');
    $query->execute(['id' => $id, 'email' => $user['email'], 'now' => genesisNow()]);
    $projectId = $query->fetchColumn();
    if ($projectId === false) throw new GenesisSharedAccessException('INVALID_INVITATION');
    genesisDb()->prepare('UPDATE shared_invitations SET revoked_at = :now WHERE id = :id AND revoked_at IS NULL')
        ->execute(['now' => genesisNow(), 'id' => $id]);
    genesisSharedAudit((string)$projectId, $userId, 'invitation.rejected', $id);
}

function genesisSharedDeleteTask(string $userId, string $projectId, string $taskId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $requestId = genesisSharedRequestId($input);
    $expected = $input['expectedRevision'] ?? null;
    if (!is_int($expected) || $expected < 1) throw new InvalidArgumentException('INVALID_TASK_REVISION');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'organize');
        $receipt = genesisSharedMutationReceipt($db, $userId, $requestId, 'task.delete', $taskId);
        if ($receipt !== null) { $db->commit(); return $receipt; }
        $query = $db->prepare('SELECT revision FROM shared_tasks WHERE id = :task AND project_id = :project');
        $query->execute(['task' => $taskId, 'project' => $projectId]);
        $revision = $query->fetchColumn();
        if ($revision === false) throw new GenesisSharedAccessException();
        if ((int)$revision !== $expected) throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT', 409);
        // Keep Google cleanup independent of the cascading deletion of projection links.
        $db->prepare('INSERT INTO shared_google_projection_cleanup
            (id, user_id, destination, google_id, google_list_id, created_at)
            SELECT lower(hex(randomblob(16))), user_id, destination, google_id, google_list_id, :now
            FROM shared_google_projection_links WHERE task_id = :task')->execute(['now' => genesisNow(), 'task' => $taskId]);
        $db->prepare('DELETE FROM shared_tasks WHERE id = :task AND project_id = :project')
            ->execute(['task' => $taskId, 'project' => $projectId]);
        genesisSharedAudit($projectId, $userId, 'task.deleted', $taskId);
        $response = ['ok' => true, 'id' => $taskId];
        genesisSharedSaveMutationReceipt($db, $userId, $requestId, 'task.delete', $taskId, $response);
        $db->commit();
        return $response;
    } catch (Throwable $error) { $db->rollBack(); throw $error; }
}

function genesisSharedTask(string $userId, string $projectId, array $input, ?string $taskId = null): array
{
    genesisSharedRequireEnabled($userId);
    $requestId = genesisSharedRequestId($input);
    $action = $taskId === null ? 'task.create' : 'task.update';
    $resourceId = $taskId ?? $projectId;
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'write');
        $receipt = genesisSharedMutationReceipt($db, $userId, $requestId, $action, $resourceId);
        if ($receipt !== null) {
            $db->commit();
            return $receipt;
        }
        $sourceTaskId = null;
        if ($taskId === null && array_key_exists('sourceTaskId', $input)) {
            if (!is_string($input['sourceTaskId']) || !preg_match('/\A[^\x00-\x1f]{1,100}\z/u', $input['sourceTaskId'])) {
                throw new InvalidArgumentException('INVALID_SOURCE_TASK_ID');
            }
            $sourceTaskId = $input['sourceTaskId'];
            $transfer = $db->prepare('SELECT target_project_id, target_task_id FROM shared_task_transfers
                WHERE source_user_id = :user AND source_task_id = :source LIMIT 1');
            $transfer->execute(['user' => $userId, 'source' => $sourceTaskId]);
            $target = $transfer->fetch();
            if ($target) {
                if ($target['target_project_id'] !== $projectId) {
                    throw new GenesisSharedAccessException('SHARED_TRANSFER_CONFLICT', 409);
                }
                $query = $db->prepare('SELECT id, project_id AS projectId, status_id AS statusId,
                    category_id AS categoryId, title, description, tags_json AS tagsJson, due_date AS dueDate,
                    assignee_id AS assigneeId, revision, completed_by AS completedBy,
                    completed_at AS completedAt, updated_at AS updatedAt
                    FROM shared_tasks WHERE id = :id AND project_id = :project LIMIT 1');
                $query->execute(['id' => $target['target_task_id'], 'project' => $projectId]);
                $copied = $query->fetch();
                if (!$copied) throw new GenesisSharedAccessException('SHARED_TRANSFER_TARGET_REMOVED', 409);
                $db->commit();
                return $copied;
            }
        }
        $existing = null;
        if ($taskId !== null) {
            $query = $db->prepare('SELECT * FROM shared_tasks WHERE id = :id AND project_id = :project LIMIT 1');
            $query->execute(['id' => $taskId, 'project' => $projectId]);
            $existing = $query->fetch();
            if (!$existing) throw new GenesisSharedAccessException();
            if (!isset($input['expectedRevision']) || (int)$input['expectedRevision'] !== (int)$existing['revision']) {
                throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT', 409);
            }
        }
        $title = array_key_exists('title', $input) ? genesisSharedTitle($input['title']) : ($existing['title'] ?? null);
        if ($title === null) throw new InvalidArgumentException('TITLE_REQUIRED');
        $description = array_key_exists('description', $input)
            ? genesisSharedText($input['description'], 20000) : ($existing['description'] ?? '');
        $tags = array_key_exists('tags', $input) ? genesisSharedTags($input['tags']) : json_decode($existing['tags_json'] ?? '[]', true);
        $statusId = (string)($input['statusId'] ?? $existing['status_id'] ?? '');
        if ($existing && $statusId !== $existing['status_id']) {
            genesisSharedProjectAccess($projectId, $userId, 'organize');
        }
        $status = $db->prepare('SELECT 1 FROM shared_project_statuses WHERE id = :id AND project_id = :project');
        $status->execute(['id' => $statusId, 'project' => $projectId]);
        if (!$status->fetchColumn()) throw new InvalidArgumentException('INVALID_STATUS');
        $doneStatus = $db->prepare('SELECT is_done FROM shared_project_statuses WHERE id = :id');
        $doneStatus->execute(['id' => $statusId]);
        $isDone = (int)$doneStatus->fetchColumn() === 1;
        $assigneeId = array_key_exists('assigneeId', $input) ? $input['assigneeId'] : ($existing['assignee_id'] ?? null);
        if ($assigneeId !== null) {
            $member = $db->prepare('SELECT 1 FROM shared_project_members WHERE project_id = :project AND user_id = :user');
            $member->execute(['project' => $projectId, 'user' => $assigneeId]);
            if (!$member->fetchColumn()) throw new InvalidArgumentException('INVALID_ASSIGNEE');
        }
        $categoryId = array_key_exists('categoryId', $input) ? $input['categoryId'] : ($existing['category_id'] ?? null);
        if ($categoryId !== null) {
            if (!is_string($categoryId)) throw new InvalidArgumentException('INVALID_CATEGORY');
            $category = $db->prepare('SELECT 1 FROM shared_project_categories WHERE id = :id AND project_id = :project');
            $category->execute(['id' => $categoryId, 'project' => $projectId]);
            if (!$category->fetchColumn()) throw new InvalidArgumentException('INVALID_CATEGORY');
        }
        $dueDate = array_key_exists('dueDate', $input) ? $input['dueDate'] : ($existing['due_date'] ?? null);
        if ($dueDate !== null && (!is_string($dueDate) || !preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $dueDate)
            || !checkdate((int)substr($dueDate, 5, 2), (int)substr($dueDate, 8, 2), (int)substr($dueDate, 0, 4)))) {
            throw new InvalidArgumentException('INVALID_DUE_DATE');
        }
        $now = genesisNow();
        $id = $taskId ?? genesisUuid();
        $completedBy = $isDone ? ($existing['completed_by'] ?? $userId) : null;
        $completedAt = $isDone ? ($existing['completed_at'] ?? $now) : null;
        if ($existing) {
            $changed = $db->prepare('UPDATE shared_tasks SET title = :title, description = :description, tags_json = :tags,
                status_id = :status, category_id = :category, assignee_id = :assignee, due_date = :due,
                completed_by = :completed_by, completed_at = :completed_at,
                updated_by = :user, updated_at = :now, revision = revision + 1
                WHERE id = :id AND project_id = :project AND revision = :expected');
            $changed->execute([
                    'title' => $title, 'description' => $description, 'tags' => json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'status' => $statusId,
                    'category' => $categoryId, 'assignee' => $assigneeId, 'due' => $dueDate, 'user' => $userId,
                    'completed_by' => $completedBy, 'completed_at' => $completedAt,
                    'now' => $now, 'id' => $id, 'project' => $projectId,
                    'expected' => (int)$existing['revision'],
                ]);
            if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT', 409);
        } else {
            $db->prepare('INSERT INTO shared_tasks (id, project_id, status_id, category_id, title, description, tags_json,
                due_date, assignee_id, created_by, updated_by, completed_by, completed_at,
                created_at, updated_at)
                VALUES (:id, :project, :status, :category, :title, :description, :tags, :due, :assignee,
                :user, :user, :completed_by, :completed_at, :now, :now)')->execute([
                    'id' => $id, 'project' => $projectId, 'status' => $statusId,
                    'category' => $categoryId, 'title' => $title, 'description' => $description, 'tags' => json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'due' => $dueDate,
                    'assignee' => $assigneeId, 'user' => $userId,
                    'completed_by' => $completedBy, 'completed_at' => $completedAt, 'now' => $now,
                ]);
            if ($sourceTaskId !== null) {
                $db->prepare('INSERT INTO shared_task_transfers
                    (source_user_id, source_task_id, target_project_id, target_task_id, created_at)
                    VALUES (:user, :source, :project, :task, :now)')->execute([
                    'user' => $userId, 'source' => $sourceTaskId,
                    'project' => $projectId, 'task' => $id, 'now' => $now,
                ]);
            }
        }
        genesisSharedAudit($projectId, $userId, $existing ? 'task.updated' : 'task.created', $id);
        $response = ['id' => $id, 'projectId' => $projectId, 'statusId' => $statusId,
            'title' => $title, 'description' => $description, 'tags' => $tags, 'dueDate' => $dueDate,
            'assigneeId' => $assigneeId, 'categoryId' => $categoryId,
            'revision' => $existing ? (int)$existing['revision'] + 1 : 1,
            'completedBy' => $completedBy, 'completedAt' => $completedAt,
            'updatedAt' => $now];
        genesisSharedSaveMutationReceipt($db, $userId, $requestId, $action, $resourceId, $response);
        $db->commit();
        return $response;
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function genesisSharedComments(string $userId, string $projectId, string $taskId): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedProjectAccess($projectId, $userId);
    $query = genesisDb()->prepare('SELECT c.id, c.body, c.created_at AS createdAt,
        c.author_id AS authorId, COALESCE(u.display_name, \'Удалённый участник\') AS authorName
        FROM shared_comments c JOIN shared_tasks t ON t.id = c.task_id
        LEFT JOIN users u ON u.id = c.author_id
        WHERE t.id = :task AND t.project_id = :project ORDER BY c.created_at LIMIT 200');
    $query->execute(['task' => $taskId, 'project' => $projectId]);
    return $query->fetchAll();
}

function genesisSharedAddComment(string $userId, string $projectId, string $taskId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedProjectAccess($projectId, $userId, 'comment');
    $body = genesisSharedTitle($input['body'] ?? null, 5000);
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'comment');
        $query = $db->prepare('SELECT 1 FROM shared_tasks WHERE id = :task AND project_id = :project');
        $query->execute(['task' => $taskId, 'project' => $projectId]);
        if (!$query->fetchColumn()) throw new GenesisSharedAccessException();
        $id = genesisUuid();
        $now = genesisNow();
        $db->prepare('INSERT INTO shared_comments (id, task_id, author_id, body, created_at)
            VALUES (:id, :task, :user, :body, :now)')->execute([
                'id' => $id, 'task' => $taskId, 'user' => $userId, 'body' => $body, 'now' => $now,
            ]);
        genesisSharedAudit($projectId, $userId, 'comment.created', $id);
        $db->commit();
        return ['id' => $id, 'body' => $body, 'authorId' => $userId, 'createdAt' => $now];
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

/** Called inside the account-deletion transaction before membership rows cascade. */
function genesisSharedPrepareAccountDeletion(string $userId): void
{
    $db = genesisDb();
    $ownedProjects = $db->prepare("SELECT project_id FROM shared_project_members
        WHERE user_id = :user AND role = 'owner'");
    $ownedProjects->execute(['user' => $userId]);
    foreach ($ownedProjects->fetchAll(PDO::FETCH_COLUMN) as $projectId) {
        $successor = $db->prepare('SELECT user_id FROM shared_project_members
            WHERE project_id = :project AND user_id <> :user
            ORDER BY CASE role WHEN \'manager\' THEN 0 WHEN \'member\' THEN 1 ELSE 2 END, joined_at LIMIT 1');
        $successor->execute(['project' => $projectId, 'user' => $userId]);
        $next = $successor->fetchColumn();
        if ($next === false) {
            $inbox = $db->prepare('SELECT space_id FROM shared_projects WHERE id = :project AND is_inbox = 1');
            $inbox->execute(['project' => $projectId]);
            $spaceId = $inbox->fetchColumn();
            if ($spaceId !== false) {
                $spaceSuccessor = $db->prepare('SELECT user_id FROM shared_space_members
                    WHERE space_id = :space AND user_id <> :user ORDER BY joined_at LIMIT 1');
                $spaceSuccessor->execute(['space' => $spaceId, 'user' => $userId]);
                $next = $spaceSuccessor->fetchColumn();
                if ($next !== false) {
                    $db->prepare("INSERT INTO shared_project_members (project_id, user_id, role, joined_at)
                        VALUES (:project, :user, 'owner', :now)")->execute([
                            'project' => $projectId, 'user' => $next, 'now' => genesisNow(),
                        ]);
                }
            }
            if ($next === false) {
                $db->prepare('DELETE FROM shared_projects WHERE id = :project')->execute(['project' => $projectId]);
            }
        } else {
            $db->prepare("UPDATE shared_project_members SET role = 'owner'
                WHERE project_id = :project AND user_id = :user")->execute([
                    'project' => $projectId, 'user' => $next,
                ]);
        }
    }
    $ownedSpaces = $db->prepare("SELECT space_id FROM shared_space_members
        WHERE user_id = :user AND role = 'owner'");
    $ownedSpaces->execute(['user' => $userId]);
    foreach ($ownedSpaces->fetchAll(PDO::FETCH_COLUMN) as $spaceId) {
        $successor = $db->prepare('SELECT user_id FROM shared_space_members
            WHERE space_id = :space AND user_id <> :user
            ORDER BY CASE role WHEN \'admin\' THEN 0 ELSE 1 END, joined_at LIMIT 1');
        $successor->execute(['space' => $spaceId, 'user' => $userId]);
        $next = $successor->fetchColumn();
        if ($next === false) {
            $db->prepare('DELETE FROM shared_spaces WHERE id = :space')->execute(['space' => $spaceId]);
        } else {
            $db->prepare("UPDATE shared_space_members SET role = 'owner'
                WHERE space_id = :space AND user_id = :user")->execute([
                    'space' => $spaceId, 'user' => $next,
                ]);
        }
    }
}

function genesisSharedSearch(string $userId, string $spaceId, string $query): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedSpaceAccess($spaceId, $userId);
    if (mb_strlen($query) > 200) throw new InvalidArgumentException('INVALID_SEARCH');
    $normalize = static fn(string $value): string => str_replace('ё', 'е', mb_strtolower($value));
    $tokens = preg_split('/[\s,;]+/u', trim($query), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (!$tokens) return ['projects' => [], 'tasks' => []];
    $matches = static function (array $item) use ($tokens, $normalize): bool {
        $title = $normalize((string)$item['title']);
        $tags = array_map($normalize, $item['tags'] ?? []);
        foreach ($tokens as $token) {
            $tagOnly = str_starts_with($token, '#');
            $term = $normalize(ltrim($token, '#'));
            if ($term === '' || !$tagOnly && str_contains($title, $term)) continue;
            $found = false;
            foreach ($tags as $tag) if (str_contains($tag, $term)) { $found = true; break; }
            if (!$found) return false;
        }
        return true;
    };
    $projects = array_values(array_filter(genesisSharedProjects($userId, $spaceId), $matches));
    $tasks = genesisDb()->prepare('SELECT t.id, t.title, t.tags_json AS tagsJson,
        t.project_id AS projectId, p.title AS projectTitle, t.due_date AS dueDate,
        t.completed_at AS completedAt FROM shared_tasks t
        JOIN shared_projects p ON p.id = t.project_id AND p.archived_at IS NULL
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
        WHERE p.space_id = :space ORDER BY t.updated_at DESC LIMIT 5000');
    $tasks->execute(['user' => $userId, 'space' => $spaceId]);
    $found = array_values(array_filter(array_map('genesisSharedRowTags', $tasks->fetchAll()), $matches));
    return ['projects' => array_slice($projects, 0, 100), 'tasks' => array_slice($found, 0, 100)];
}

require_once __DIR__ . '/shared-space-settings.php';
require_once __DIR__ . '/shared-ui.php';
