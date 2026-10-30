# Genesis Tasker3.1.3 — изолированная PHP/SQLite проверка

Финальный локальный прогон: **75/75 suites PASS, 188/188 PHP syntax PASS**. В PHP diagnostics:0 Fatal error,0 Warning,0 Deprecated,0 Notice. Это проверка текущего рабочего кода, не подтверждение Android/production и не финальный release SHA.

Среда: PHP 8.3.36 (cli) (built: Oct 26 2026 09:48:51) (NTS Visual C++ 2019 x64); Windows CLI. Проверены расширения pdo_sqlite, sqlite3, mbstring, sodium, openssl. Дополнительно загружены curl/intl/zip/gd для доступности тестируемых API.

Состав: все команды из текущих deploy.yml шагов Test native Google token verification и Test PHP backend with isolated SQLite, плюс subscriptions.php и subscription-profile.php. Проверка синтаксиса выполнена по188отслеживаемым PHP-файлам, без server/config.php и приватных каталогов.

Локальный итог: outputs/v313/backend-fixture/final-run/summary.json; SHA-256 `25d0e7ad5eb94f7498fe25b33c6e09c7eae2474cc05edd06b0672bc0238198a6`. В summary сохранены время, status/exit code/elapsed/source SHA-256 каждого suite и путь отдельного лога; modules — logs/php-modules.log. Начат 2026-10-30T03:45:46.035053+00:00, завершён 2026-10-30T03:49:00.852843+00:00.

## Изоляция и ограничения

- Не читались и не перезаписывались server/config.php или production-БД. Синтетический config с localhost.invalid, случайным ключом, SQLite и sessions находится только под outputs/v313/backend-fixture. Self-managed fixtures используют свои конфиги без повторного define.
- На Windows временный ASCII drive alias устранил искажение кириллических путей в дочернем PHP; копия репозитория не создавалась, alias снят после run. Extensions загружались по относительному ASCII пути.
- Curl и mail отключены во всём harness. HTTP/TCP разрешались только в трёх прочитанных loopback entry points: physis-security, shared-projects и shared-space-settings; они резервируют127.0.0.1сами. Живые Google OAuth/sync, SMTP, Web Push delivery и публичные запросы этим прогоном не проверены.
- Отдельный scripts/mindmaps/fixture.php не запускался: он пишет server/config.php; отдельные personal/shared mindmap suites привязаны к иному фиксированному output/mindmaps-test.sqlite. Shared mindmap conversion из основного CI-набора выполнен.
- Первоначальные69/75 и промежуточные74/75 сохранены в соседних исходных summary/logs. Они не удалялись и не засчитаны как финальная приёмка.

## Исправления, подтверждённые повтором

- server/tests/smoke.php: добавлена синтетическая строка новой stoicheion_timeline_draws в deletion fixture. Проверка полного покрытия всех user-owned таблиц, receipt, удаления и сохранности чужого workspace сохранена.
- server/tests/shared-task-download-http.php: если задан GENESIS_LOCAL_TEST_CONFIG, создаётся временный router с этой явной synthetic config, как в security-auth-http.php; router удаляется в finally. Binary/auth/cookie/header assertions сохранены. Это устранило зависимость HTTP-части от server/config.php.
- Остальные первые FAIL были особенностями harness: запрещённый loopback, Windows Unicode child arguments и generated worker double define. Исправлен только локальный runner/ini/prepend; production-модули ради прохождения тестов не менялись.

## Выполненные suites

| Suite | Статус | Секунды |
| --- | --- | --- |
| server/tests/native-auth.php | PASS | 0.313 |
| server/tests/physis-security.php | PASS | 7.39 |
| server/tests/stoicheion-workspace.php | PASS | 0.235 |
| server/tests/stoicheion-timeline.php | PASS | 0.219 |
| server/tests/feature-access.php | PASS | 0.062 |
| server/tests/diary.php | PASS | 0.219 |
| server/tests/relocation.php | PASS | 0.062 |
| server/tests/legacy-home.php | PASS | 0.047 |
| server/tests/android-support.php | PASS | 0.047 |
| server/tests/web-asset-retention.php | PASS | 0.078 |
| server/tests/google-sync-cache.php | PASS | 0.125 |
| server/tests/calendar.php | PASS | 0.063 |
| server/tests/template-dates.php | PASS | 0.047 |
| server/tests/recurrence.php | PASS | 0.109 |
| server/tests/google-calendar-context.php | PASS | 0.062 |
| server/tests/google-incremental.php | PASS | 0.063 |
| server/tests/shared-content-storage.php | PASS | 0.094 |
| server/tests/smoke.php | PASS | 0.265 |
| server/tests/shared-projects.php | PASS | 2.266 |
| server/tests/shared-mutation-receipts.php | PASS | 0.172 |
| server/tests/shared-project-inboxes-migration.php | PASS | 0.14 |
| server/tests/shared-mindmap-conversion.php | PASS | 0.375 |
| server/tests/shared-session-lock.php | PASS | 0.157 |
| server/tests/shared-project-access.php | PASS | 0.218 |
| server/tests/shared-custom-fields.php | PASS | 0.204 |
| server/tests/template-manifest.php | PASS | 0.14 |
| server/tests/template-apply.php | PASS | 0.375 |
| server/tests/templates-migration.php | PASS | 0.187 |
| server/tests/shared-automations.php | PASS | 0.438 |
| server/tests/automations-migration.php | PASS | 0.14 |
| server/tests/shared-data-exchange.php | PASS | 12.61 |
| server/tests/shared-data-access.php | PASS | 0.156 |
| server/tests/data-exchange-migration.php | PASS | 0.141 |
| server/tests/shared-reports-history.php | PASS | 0.047 |
| server/tests/shared-reports.php | PASS | 0.546 |
| server/tests/shared-reports-integration.php | PASS | 0.188 |
| server/tests/shared-planning.php | PASS | 0.219 |
| server/tests/shared-sprint-flow-model.php | PASS | 0.437 |
| server/tests/shared-sprint-reports.php | PASS | 0.703 |
| server/tests/planning-migration.php | PASS | 0.172 |
| server/tests/shared-workflows.php | PASS | 0.485 |
| server/tests/workflows-migration.php | PASS | 0.125 |
| server/tests/shared-task-details.php | PASS | 53.953 |
| server/tests/shared-task-details-migration.php | PASS | 0.109 |
| server/tests/shared-task-lifecycle.php | PASS | 0.141 |
| server/tests/shared-series.php | PASS | 0.359 |
| server/tests/shared-series-migration.php | PASS | 0.109 |
| server/tests/shared-views.php | PASS | 0.61 |
| server/tests/shared-views-migration.php | PASS | 0.109 |
| server/tests/shared-bulk.php | PASS | 1.016 |
| server/tests/shared-bulk-migration.php | PASS | 0.109 |
| server/tests/shared-notifications.php | PASS | 0.25 |
| server/tests/habit-reminders.php | PASS | 0.141 |
| server/tests/habit-reminders-migration.php | PASS | 0.109 |
| server/tests/email-transport.php | PASS | 0.063 |
| server/tests/account-email.php | PASS | 0.156 |
| server/tests/account-email-migration.php | PASS | 0.109 |
| server/tests/calendar-exploration.php | PASS | 0.188 |
| server/tests/daily-advice.php | PASS | 2.75 |
| server/tests/shared-task-display.php | PASS | 0.14 |
| server/tests/shared-calendar-previews.php | PASS | 0.407 |
| server/tests/calendar-cross-feature.php | PASS | 0.078 |
| server/tests/shared-notifications-migration.php | PASS | 0.109 |
| server/tests/workspace-writer.php | PASS | 0.078 |
| server/tests/workspace-writer-migration.php | PASS | 0.063 |
| server/tests/sacred-feature-visibility.php | PASS | 0.094 |
| server/tests/client-activity.php | PASS | 0.062 |
| server/tests/client-activity-migration.php | PASS | 0.063 |
| server/tests/web-push.php | PASS | 0.046 |
| server/tests/shared-bulk-large.php | PASS | 90.766 |
| server/tests/shared-ui.php | PASS | 0.219 |
| server/tests/shared-space-settings.php | PASS | 2.094 |
| server/tests/private-invitations-migration.php | PASS | 0.235 |
| server/tests/subscriptions.php | PASS | 0.062 |
| server/tests/subscription-profile.php | PASS | 0.109 |
