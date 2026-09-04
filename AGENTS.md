# GENESIS: правила работы с проектом

## Границы и источник истины

- GitHub-репозиторий `nikitalexanderson-byte/calendar-genesis` — единственный источник отслеживаемого кода.
- Production: `https://genesiscalendar.ru`.
- Единственный разрешённый корень на Beget: `/home/h/haiirodw/genesis-calendar`.
- Никогда не читать и не изменять соседние сайты или их каталоги.
- Не заменять существующую CI/CD-схему без подтверждённой необходимости; сначала изучить текущий diff и последние запуски workflow.

## Экономный порядок работы

1. Начать с `git status --short --branch`, `git diff` и точечного `rg` по связанным файлам.
2. Не перечитывать весь репозиторий и не создавать полные локальные/серверные копии кода.
3. Сохранять незакоммиченные изменения пользователя. Работать в отдельной ветке от свежего `origin/master`.
4. Менять только относящиеся к задаче файлы.
5. Перед публикацией выполнить `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test` и `pnpm build:beget`.
6. Затем: commit в рабочую ветку -> push -> merge в `master` -> дождаться GitHub Actions -> проверить production.

## Деплой и rollback

- Деплой выполняет только `.github/workflows/deploy.yml` после push/merge в `master`.
- Клиент и PHP API публикуются в `/home/h/haiirodw/genesis-calendar/public_html`; закрытый PHP-код — в `/home/h/haiirodw/genesis-calendar/server`.
- Перед каждым CI-деплоем автоматически сохраняются только server-only данные: `server/config.php` и согласованная SQLite-копия. Полные копии отслеживаемого кода не нужны: его история уже находится в Git.
- Code rollback: сделать `git revert` проблемного merge/commit в `master`; новый push автоматически развернёт предыдущую версию.
- Database rollback не выполнять автоматически. Сначала остановить изменяющие запросы, проверить нужную runtime-копию и согласовать восстановление.
- После деплоя `/deploy-meta.json` должен содержать SHA текущего `master`, а `/api/health` — отвечать успешно.

## Данные, миграции и секреты

- Никогда не коммитить и не выводить содержимое `server/config.php`, `server/var/`, `.env*`, SSH-ключей, Google client secret, refresh/access tokens и GitHub secrets.
- `server/config.php`, `server/var/`, `deploy-private/`, `backups/` и `sshp.txt` должны оставаться вне Git.
- SQL-миграции из `server/migrations/` применяются приложением при первом обращении к БД. При добавлении миграции отдельно проверить backup, совместимость и путь отката.
- Не изменять production-БД вручную без отдельной задачи и явного плана восстановления.

## SSH

- SSH допустим только когда Git/GitHub Actions и публичные health-checks недостаточны: диагностика deploy, права, PHP/runtime, cron, server drift, логи или безопасная проверка server-only состояния.
- По умолчанию использовать read-only команды и точные пути внутри корня GENESIS.
- Не показывать секреты в выводе. Не читать `config.php` целиком.
- Любую аварийную правку на сервере немедленно перенести в Git и повторно развернуть через workflow.
- В итоговом отчёте указать, использовался ли SSH и зачем.
