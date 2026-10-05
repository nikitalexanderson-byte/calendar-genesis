<?php
declare(strict_types=1);

final class GenesisSharedAccessException extends RuntimeException
{
    public function __construct(string $message = 'SHARED_PROJECT_NOT_FOUND', public readonly int $status = 404)
    {
        parent::__construct($message);
    }
}

function genesisSharedRequireEnabled(string $userId): array
{
    $user = genesisFindUser($userId);
    if (!$user || !genesisSharedTester($user) || empty($user['shared_projects_enabled'])) {
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

function genesisSharedSpaceAccess(string $spaceId, string $userId): array
{
    $query = genesisDb()->prepare('SELECT s.*, m.role AS member_role FROM shared_spaces s
        JOIN shared_space_members m ON m.space_id = s.id AND m.user_id = :user
        WHERE s.id = :id LIMIT 1');
    $query->execute(['id' => $spaceId, 'user' => $userId]);
    $row = $query->fetch();
    if (!$row) throw new GenesisSharedAccessException();
    return $row;
}

function genesisSharedProjectAccess(string $projectId, string $userId, string $permission = 'read', bool $includeArchived = false): array
{
    $query = genesisDb()->prepare('SELECT p.*, m.role AS member_role FROM shared_projects p
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
        JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = :user
        WHERE p.id = :id' . ($includeArchived ? '' : ' AND p.archived_at IS NULL') . ' LIMIT 1');
    $query->execute(['id' => $projectId, 'user' => $userId]);
    $project = $query->fetch();
    if (!$project) throw new GenesisSharedAccessException();
    $allowed = [
        'read' => ['owner', 'manager', 'member', 'commenter', 'viewer'],
        'comment' => ['owner', 'manager', 'member', 'commenter'],
        'write' => ['owner', 'manager', 'member'],
        'manage' => ['owner', 'manager'],
        'owner' => ['owner'],
    ];
    if (!in_array((string)$project['member_role'], $allowed[$permission] ?? [], true)) {
        throw new GenesisSharedAccessException('SHARED_PROJECT_FORBIDDEN', 403);
    }
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
    $query = genesisDb()->prepare('SELECT s.id, s.title, s.updated_at AS updatedAt, m.role
        FROM shared_spaces s JOIN shared_space_members m ON m.space_id = s.id
        WHERE m.user_id = :user ORDER BY s.updated_at DESC LIMIT 100');
    $query->execute(['user' => $userId]);
    return $query->fetchAll();
}

function genesisSharedCreateSpace(string $userId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    $title = genesisSharedTitle($input['title'] ?? null);
    $id = genesisUuid();
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO shared_spaces (id, title, created_by, created_at, updated_at)
            VALUES (:id, :title, :user, :now, :now)')->execute(compact('id', 'title') + ['user' => $userId, 'now' => $now]);
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
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    return ['id' => $id, 'title' => $title, 'role' => 'owner', 'updatedAt' => $now];
}

function genesisSharedProjects(string $userId, string $spaceId): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedSpaceAccess($spaceId, $userId);
    $query = genesisDb()->prepare('SELECT p.id, p.space_id AS spaceId, p.parent_id AS parentId,
        p.title, p.description, p.layout, p.is_inbox AS isInbox, p.revision, p.updated_at AS updatedAt, m.role
        FROM shared_projects p JOIN shared_project_members m ON m.project_id = p.id
        WHERE p.space_id = :space AND m.user_id = :user AND p.archived_at IS NULL
        ORDER BY p.updated_at DESC LIMIT 100');
    $query->execute(['space' => $spaceId, 'user' => $userId]);
    return $query->fetchAll();
}

function genesisSharedArchivedProjects(string $userId, string $spaceId): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedSpaceAccess($spaceId, $userId);
    $query = genesisDb()->prepare('SELECT p.id, p.space_id AS spaceId, p.parent_id AS parentId,
        p.title, p.description, p.layout, p.revision, p.archived_at AS archivedAt, m.role
        FROM shared_projects p JOIN shared_project_members m ON m.project_id = p.id
        WHERE p.space_id = :space AND m.user_id = :user AND p.archived_at IS NOT NULL
        ORDER BY p.archived_at DESC LIMIT 100');
    $query->execute(['space' => $spaceId, 'user' => $userId]);
    return $query->fetchAll();
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
    $title = genesisSharedTitle($input['title'] ?? null, 80);
    $isDone = $input['isDone'] ?? false;
    if (!is_bool($isDone)) throw new InvalidArgumentException('INVALID_STATUS_KIND');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $query = $db->prepare('SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS lastPosition
            FROM shared_project_statuses WHERE project_id = :project');
        $query->execute(['project' => $projectId]);
        $summary = $query->fetch();
        if ((int)$summary['count'] >= 20) throw new GenesisSharedAccessException('STATUS_LIMIT', 409);
        $id = genesisUuid();
        $position = (int)$summary['lastPosition'] + 1;
        $db->prepare('INSERT INTO shared_project_statuses (id, project_id, title, position, is_done)
            VALUES (:id, :project, :title, :position, :done)')->execute([
                'id' => $id, 'project' => $projectId, 'title' => $title,
                'position' => $position, 'done' => $isDone ? 1 : 0,
            ]);
        genesisSharedAudit($projectId, $userId, 'status.created', $id);
        $db->commit();
        return ['id' => $id, 'title' => $title, 'position' => $position,
            'isDone' => $isDone ? 1 : 0, 'revision' => 1];
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
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $changed = $db->prepare('UPDATE shared_project_statuses SET title = :title,
            revision = revision + 1 WHERE id = :id AND project_id = :project AND revision = :expected');
        $changed->execute(['title' => $title, 'id' => $statusId,
            'project' => $projectId, 'expected' => $expected]);
        if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('STATUS_CONFLICT', 409);
        genesisSharedAudit($projectId, $userId, 'status.updated', $statusId);
        $db->commit();
        return ['id' => $statusId, 'title' => $title, 'revision' => $expected + 1];
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
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
    if (!in_array($space['member_role'], ['owner', 'admin', 'member'], true)) {
        throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
    }
    $title = genesisSharedTitle($input['title'] ?? null);
    $description = genesisSharedText($input['description'] ?? '', 5000);
    $layout = $input['layout'] ?? 'list';
    if (!in_array($layout, ['list', 'board'], true)) throw new InvalidArgumentException('INVALID_LAYOUT');
    $parentId = $input['parentId'] ?? null;
    if ($parentId !== null) {
        $parent = genesisSharedProjectAccess((string)$parentId, $userId, 'write');
        if ($parent['space_id'] !== $spaceId) throw new GenesisSharedAccessException();
    }
    $id = genesisUuid();
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $space = genesisSharedSpaceAccess($spaceId, $userId);
        if (!in_array($space['member_role'], ['owner', 'admin', 'member'], true)) {
            throw new GenesisSharedAccessException('SHARED_SPACE_FORBIDDEN', 403);
        }
        if ($parentId !== null) genesisSharedProjectAccess((string)$parentId, $userId, 'write');
        $db->prepare('INSERT INTO shared_projects (id, space_id, parent_id, title, description, layout,
            created_by, created_at, updated_at) VALUES (:id, :space, :parent, :title, :description, :layout,
            :user, :now, :now)')->execute([
                'id' => $id, 'space' => $spaceId, 'parent' => $parentId, 'title' => $title,
                'description' => $description, 'layout' => $layout, 'user' => $userId, 'now' => $now,
            ]);
        $db->prepare("INSERT INTO shared_project_members (project_id, user_id, role, joined_at)
            VALUES (:project, :user, 'owner', :now)")->execute(['project' => $id, 'user' => $userId, 'now' => $now]);
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
        'description' => $description, 'layout' => $layout, 'revision' => 1, 'role' => 'owner', 'updatedAt' => $now];
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
    $now = genesisNow();
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
        $changed = $db->prepare('UPDATE shared_projects SET title = :title, description = :description,
            layout = :layout, parent_id = :parent, updated_at = :now, revision = revision + 1
            WHERE id = :id AND revision = :expected');
        $changed->execute([
            'title' => $title, 'description' => $description, 'layout' => $layout,
            'parent' => $parentId, 'now' => $now, 'id' => $projectId,
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
        'title' => $title, 'description' => $description, 'layout' => $layout,
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
        $member = $db->prepare('SELECT role FROM shared_space_members WHERE space_id = :space AND user_id = :user');
        $member->execute(['space' => $spaceId, 'user' => $targetId]);
        $oldRole = $member->fetchColumn();
        if ($oldRole === false) throw new GenesisSharedAccessException();
        if ($oldRole === 'owner' && $role !== 'owner') {
            $owners = $db->prepare("SELECT COUNT(*) FROM shared_space_members WHERE space_id = :space AND role = 'owner'");
            $owners->execute(['space' => $spaceId]);
            if ((int)$owners->fetchColumn() <= 1) throw new GenesisSharedAccessException('LAST_OWNER', 409);
        }
        $db->prepare('UPDATE shared_space_members SET role = :role WHERE space_id = :space AND user_id = :user')
            ->execute(['role' => $role, 'space' => $spaceId, 'user' => $targetId]);
        $inbox = $db->prepare('SELECT id FROM shared_projects WHERE space_id = :space AND is_inbox = 1');
        $inbox->execute(['space' => $spaceId]);
        $inboxId = $inbox->fetchColumn();
        if ($inboxId !== false) {
            if ($role === 'guest') {
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
    $statuses = $db->prepare('SELECT id, title, position, is_done AS isDone, revision FROM shared_project_statuses
        WHERE project_id = :project ORDER BY position');
    $statuses->execute(['project' => $projectId]);
    $categories = $db->prepare('SELECT id, title, color, position, revision
        FROM shared_project_categories WHERE project_id = :project ORDER BY position');
    $categories->execute(['project' => $projectId]);
    $tasks = $db->prepare('SELECT t.id, t.project_id AS projectId, t.status_id AS statusId, t.title,
        t.category_id AS categoryId, t.description, t.due_date AS dueDate,
        t.assignee_id AS assigneeId, t.created_by AS createdBy,
        t.updated_by AS updatedBy, t.completed_by AS completedBy, t.completed_at AS completedAt,
        t.position, t.revision, t.updated_at AS updatedAt FROM shared_tasks t
        WHERE t.project_id = :project ORDER BY t.status_id, t.position LIMIT 500');
    $tasks->execute(['project' => $projectId]);
    $members = $db->prepare('SELECT m.user_id AS userId, m.role, sm.role AS spaceRole,
        u.display_name AS displayName FROM shared_project_members m
        JOIN users u ON u.id = m.user_id
        JOIN shared_space_members sm ON sm.space_id = :space AND sm.user_id = m.user_id
        WHERE m.project_id = :project');
    $members->execute(['project' => $projectId, 'space' => $project['space_id']]);
    return [
        'project' => [
            'id' => $projectId, 'spaceId' => $project['space_id'], 'parentId' => $project['parent_id'],
            'title' => $project['title'], 'description' => $project['description'],
            'layout' => $project['layout'], 'isInbox' => (int)$project['is_inbox'],
            'revision' => (int)$project['revision'],
            'role' => $project['member_role'], 'spaceRole' => genesisSharedSpaceAccess((string)$project['space_id'], $userId)['member_role'],
            'updatedAt' => $project['updated_at'],
        ],
        'statuses' => $statuses->fetchAll(), 'categories' => $categories->fetchAll(),
        'tasks' => $tasks->fetchAll(), 'members' => $members->fetchAll(),
    ];
}

function genesisSharedInvite(string $userId, string $projectId, array $input): array
{
    genesisSharedRequireEnabled($userId);
    genesisSharedProjectAccess($projectId, $userId, 'manage');
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
    $token = bin2hex(random_bytes(32));
    $id = genesisUuid();
    $now = genesisNow();
    $expires = gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400);
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'manage');
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
    return ['id' => $id, 'token' => $token, 'expiresAt' => $expires];
}

function genesisSharedAcceptInvite(string $userId, array $input): array
{
    $user = genesisSharedRequireEnabled($userId);
    $token = (string)($input['token'] ?? '');
    if (!preg_match('/\A[a-f0-9]{64}\z/', $token)) throw new InvalidArgumentException('INVALID_INVITATION');
    $db = genesisDb();
    $db->beginTransaction();
    try {
        $query = $db->prepare('SELECT i.*, p.space_id FROM shared_invitations i
            JOIN shared_projects p ON p.id = i.project_id
            WHERE i.token_hash = :hash AND i.consumed_at IS NULL AND i.revoked_at IS NULL
            AND i.expires_at > :now AND p.archived_at IS NULL LIMIT 1');
        $now = genesisNow();
        $query->execute(['hash' => hash('sha256', $token), 'now' => $now]);
        $invite = $query->fetch();
        if (!$invite || !hash_equals(mb_strtolower((string)$invite['email']), mb_strtolower((string)$user['email']))) {
            throw new GenesisSharedAccessException('INVALID_INVITATION');
        }
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

function genesisSharedTask(string $userId, string $projectId, array $input, ?string $taskId = null): array
{
    genesisSharedRequireEnabled($userId);
    $db = genesisDb();
    $db->beginTransaction();
    try {
        genesisSharedProjectAccess($projectId, $userId, 'write');
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
                    category_id AS categoryId, title, description, due_date AS dueDate,
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
        $statusId = (string)($input['statusId'] ?? $existing['status_id'] ?? '');
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
            $changed = $db->prepare('UPDATE shared_tasks SET title = :title, description = :description,
                status_id = :status, category_id = :category, assignee_id = :assignee, due_date = :due,
                completed_by = :completed_by, completed_at = :completed_at,
                updated_by = :user, updated_at = :now, revision = revision + 1
                WHERE id = :id AND project_id = :project AND revision = :expected');
            $changed->execute([
                    'title' => $title, 'description' => $description, 'status' => $statusId,
                    'category' => $categoryId, 'assignee' => $assigneeId, 'due' => $dueDate, 'user' => $userId,
                    'completed_by' => $completedBy, 'completed_at' => $completedAt,
                    'now' => $now, 'id' => $id, 'project' => $projectId,
                    'expected' => (int)$existing['revision'],
                ]);
            if ($changed->rowCount() !== 1) throw new GenesisSharedAccessException('SHARED_TASK_CONFLICT', 409);
        } else {
            $db->prepare('INSERT INTO shared_tasks (id, project_id, status_id, category_id, title, description,
                due_date, assignee_id, created_by, updated_by, completed_by, completed_at,
                created_at, updated_at)
                VALUES (:id, :project, :status, :category, :title, :description, :due, :assignee,
                :user, :user, :completed_by, :completed_at, :now, :now)')->execute([
                    'id' => $id, 'project' => $projectId, 'status' => $statusId,
                    'category' => $categoryId, 'title' => $title, 'description' => $description, 'due' => $dueDate,
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
        $db->commit();
        return ['id' => $id, 'projectId' => $projectId, 'statusId' => $statusId,
            'title' => $title, 'description' => $description, 'dueDate' => $dueDate,
            'assigneeId' => $assigneeId, 'categoryId' => $categoryId,
            'revision' => $existing ? (int)$existing['revision'] + 1 : 1,
            'completedBy' => $completedBy, 'completedAt' => $completedAt,
            'updatedAt' => $now];
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
