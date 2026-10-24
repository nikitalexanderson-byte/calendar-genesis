# Фюзис: проверка production-сборки

24 октября 2026. Основная реализация — PR #274, merge `1dfe54678f92f10ca1edaee31bdb67b1143fd182`. Чек-лист функций: [physis-checklist.md](physis-checklist.md).

Первый workflow `40100788748` успешно прошёл клиентские и серверные тесты, затем остановился **до публикации**: при production-флаге `GENESIS_MINDMAPS=true` основной chunk составил 351079 байт при лимите 350000. Первоначальная локальная сборка не включала этот флаг; её успешный результат не подтверждал production-вариант.

Исправление использует существующий `codeSplitting` в `vite.beget.config.ts`: `AccountPanel.tsx`, содержащий в том числе вход в настройки Фюзиса, выделен в `account-settings`. Лимит, функциональность и CI/CD не изменены.

Повторная локальная проверка:

- Frozen install, lint (0 ошибок / 2 прежних предупреждения), 666 тестов — passed.
- `$env:GENESIS_MINDMAPS='true'; pnpm build:beget` — passed. Основной chunk 341781 байт; account-settings 145725; максимальный JS — прежний locale-fr, 349968 байт. Precache содержит 96 JS/CSS и 203 visual assets.
- Собранный сайт открыт в Chromium с реальным synthetic PHP API. Личный кабинет → «Аккаунт GENESIS» → «Открыть настройки Фюзиса» работает; отдельный account-settings действительно загружен, page errors отсутствуют.
- Дополнительно подтверждён браузерный сценарий тренировки: offline → изменение заметки → переход в «Сегодня» → возврат → reconnect → reload → продолжение занятия. Статус менялся на «Не сохранено — нет связи», затем «Сохранено»; заметка после reload совпала.

Логи и воспроизводимые скрипты: `output/physis-production-build.log`, `output/physis-production-bootstrap.js`, `output/physis-production-bootstrap.log`, `output/physis-offline-verified.log`. Это локальные ignored артефакты с synthetic данными. Результат повторного CI и production health фиксируется отдельно после завершения workflow; этот документ не объявляет выпуск состоявшимся заранее.

На момент этой проверки флаг Фюзиса оставался выключен до проверки Android entry point. Последующая проверка опубликованного APK и порученная пользователем активация браузерного доступа описаны в [physis-browser-access.md](physis-browser-access.md). `GENESIS_DEPLOY_TARGET=hostinger`, `GENESIS_DEPLOY_ANDROID=false`. В описанном здесь выпуске прямой SSH не использовался; ручных production SQL не выполнялось.
