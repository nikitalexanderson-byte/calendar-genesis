<?php
declare(strict_types=1);

/** All totals come from current project AND space membership, never cached client lists. */
function genesisSharedOverview(string $userId, ?string $spaceId = null): array
{
    genesisSharedRequireEnabled($userId);
    $db = genesisDb();
    $values = ['user' => $userId];
    if ($spaceId !== null) {
        genesisSharedSpaceAccess($spaceId, $userId);
        $values['space'] = $spaceId;
    }
    $scope = ' FROM shared_projects p
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
        JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = m.user_id';
    if ($spaceId !== null) $scope .= ' AND p.space_id = :space';
    $query = $db->prepare('SELECT COUNT(*) AS projects,
        COALESCE(SUM(p.parent_id IS NULL), 0) AS rootProjects,
        COALESCE(SUM(p.parent_id IS NOT NULL), 0) AS subprojects' . $scope .
        " WHERE p.archived_at IS NULL AND p.is_inbox = 0 AND p.kind = 'project'");
    $query->execute($values); $totals = $query->fetch();
    $query = $db->prepare('SELECT COUNT(*) AS tasks,
        COALESCE(SUM(t.completed_at IS NULL), 0) AS openTasks,
        COALESCE(SUM(t.completed_at IS NOT NULL), 0) AS completedTasks' . $scope .
        ' JOIN shared_tasks_read t ON t.project_id = p.id WHERE p.archived_at IS NULL');
    $query->execute($values); $totals += $query->fetch();
    $query = $db->prepare('SELECT
        COALESCE(SUM(e.action = \'task.created\'), 0) AS newTasks,
        COALESCE(SUM(e.action = \'project.created\'), 0) AS newProjects,
        COALESCE(SUM(e.action = \'comment.created\'), 0) AS newComments' . $scope . '
        JOIN shared_audit_events_read e ON e.project_id = p.id
        LEFT JOIN shared_tasks_read t ON t.id = COALESCE(e.task_id, e.object_id) AND t.project_id = p.id
        LEFT JOIN shared_notification_reads r ON r.event_id = e.id AND r.user_id = :user
        WHERE p.archived_at IS NULL AND e.actor_id IS NOT :user AND r.event_id IS NULL
        AND (e.action = \'project.created\' OR (t.id IS NOT NULL AND e.action IN (\'task.created\', \'comment.created\')))');
    $query->execute($values); $totals += $query->fetch();
    return array_map('intval', $totals);
}

/** A bounded inbox page; a cursor also lets unread items older than 100 be reviewed. */
function genesisSharedInbox(string $userId, string $before = '', bool $unreadOnly = false): array
{
    genesisSharedRequireEnabled($userId);
    $values = ['user' => $userId]; $filter = '';
    if ($before !== '') {
        if (!preg_match('/\A[a-f0-9-]{36}\z/', $before)) throw new InvalidArgumentException('INVALID_NOTIFICATION_CURSOR');
        $query = genesisDb()->prepare('SELECT created_at FROM shared_audit_events_read WHERE id = :id');
        $query->execute(['id' => $before]); $time = $query->fetchColumn();
        if ($time === false) throw new InvalidArgumentException('INVALID_NOTIFICATION_CURSOR');
        $filter .= ' AND (e.created_at < :time OR (e.created_at = :time AND e.id < :before))';
        $values += ['time' => $time, 'before' => $before];
    }
    if ($unreadOnly) $filter .= ' AND r.event_id IS NULL';
    $query = genesisDb()->prepare('SELECT e.id, e.action, COALESCE(e.task_id, e.object_id) AS objectId,
        e.created_at AS createdAt, p.id AS projectId, p.title AS projectTitle, p.space_id AS spaceId,
        COALESCE(NULLIF(u.display_name, \'\'), \'Участник GENESIS\') AS actorName,
        t.title AS taskTitle, substr(c.body, 1, 180) AS commentBody, c.id AS commentId,
        CASE WHEN r.event_id IS NULL THEN 0 ELSE 1 END AS isRead
        FROM shared_audit_events_read e JOIN shared_projects p ON p.id = e.project_id AND p.archived_at IS NULL
        JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
        JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = m.user_id
        LEFT JOIN users u ON u.id = e.actor_id
        LEFT JOIN shared_tasks_read t ON t.id = COALESCE(e.task_id, e.object_id) AND t.project_id = p.id
        LEFT JOIN shared_comments_read c ON c.id = e.object_id AND e.action = \'comment.created\'
        LEFT JOIN shared_notification_reads r ON r.event_id = e.id AND r.user_id = :user
        WHERE e.actor_id IS NOT :user AND (e.action = \'project.created\'
            OR (t.id IS NOT NULL AND e.action IN (\'task.created\', \'comment.created\')))' . $filter . '
        ORDER BY e.created_at DESC, e.id DESC LIMIT 51');
    $query->execute($values); $items = $query->fetchAll();
    return ['notifications' => array_slice($items, 0, 50), 'nextCursor' => count($items) > 50 ? $items[49]['id'] : null];
}

function genesisSharedReadInbox(string $userId, array $input): void
{
    genesisSharedRequireEnabled($userId);
    $all = ($input['all'] ?? false) === true;
    $ids = $input['eventIds'] ?? [];
    if (!is_array($ids) || !array_is_list($ids) || count($ids) > 100 ||
        array_filter($ids, static fn($id) => !is_string($id) || !preg_match('/\A[a-f0-9-]{36}\z/', $id))) {
        throw new InvalidArgumentException('INVALID_NOTIFICATION_IDS');
    }
    if (!$all && !$ids) return;
    $db = genesisDb(); $db->beginTransaction();
    try {
        $values = ['user' => $userId]; $idFilter = '';
        if (!$all) {
            $placeholders = [];
            foreach (array_values($ids) as $index => $id) {
                $placeholders[] = ':event' . $index; $values['event' . $index] = $id;
            }
            $idFilter = ' AND e.id IN (' . implode(',', $placeholders) . ')';
        }
        $query = $db->prepare('SELECT e.id FROM shared_audit_events_read e
            JOIN shared_projects p ON p.id = e.project_id AND p.archived_at IS NULL
            JOIN shared_project_members m ON m.project_id = p.id AND m.user_id = :user
            JOIN shared_space_members sm ON sm.space_id = p.space_id AND sm.user_id = m.user_id
            LEFT JOIN shared_tasks_read t ON t.id = COALESCE(e.task_id, e.object_id) AND t.project_id = p.id
            WHERE e.actor_id IS NOT :user AND (e.action = \'project.created\'
                OR (t.id IS NOT NULL AND e.action IN (\'task.created\', \'comment.created\')))' .
            $idFilter);
        $query->execute($values);
        $visible = $query->fetchAll(PDO::FETCH_COLUMN);
        if (!$all && array_diff($ids, $visible)) throw new GenesisSharedAccessException();
        $save = $db->prepare('INSERT OR IGNORE INTO shared_notification_reads (event_id, user_id, read_at) VALUES (:event, :user, :now)');
        foreach ($visible as $id) $save->execute(['event' => $id, 'user' => $userId, 'now' => genesisNow()]);
        $db->commit();
    } catch (Throwable $error) { $db->rollBack(); throw $error; }
}
