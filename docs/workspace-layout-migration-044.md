# Workspace layout and board display: migration 044

Migration 044 adds nullable `task_title_lines` (0–3) and `visible_task_count` (0–1000) to `shared_project_statuses`. It does not rewrite task content, status order or existing preferences. Null uses the legacy default on read: complete titles and all tasks on active boards, two title lines and the latest five tasks on completed boards. Zero disables the corresponding limit.

The API validates integer values, existing manager permissions and optimistic revisions. Older clients can rename a board without erasing its display preferences. List view continues to show all tasks. Older board tasks remain available under a disclosure and can be opened through task navigation.

Before deployment the existing workflow creates a consistent server-only SQLite backup. The application applies the additive migration at its first database access. `server/tests/shared-ui.php` checks a populated previous schema, its pre-migration backup, integrity, old-client updates, permissions and invalid/stale writes in an isolated database.

Code rollback uses `git revert` through the existing deployment workflow. Leave the additive columns in place; earlier code ignores them. Preserve the migration 043 encrypted-storage compatibility from PR 138 (commit `edda8f3`). Never revert that storage layer against an already encrypted database. See `google-sync-recovery-2.7.3.md`.

Database restoration is not automatic. If separately authorized, first stop modifying requests, verify the selected consistent runtime backup and agree on changes made since its timestamp before restoring it.
