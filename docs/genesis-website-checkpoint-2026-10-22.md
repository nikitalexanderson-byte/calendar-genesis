# Промежуточный web/API-релиз — 22 октября 2026

Пользователь разрешил деплой сайта после текущих проверок и приостановил новые сборки Android. Кандидат подготовлен в `codex/website-checkpoint-2026-10-22` от свежего `origin/master` `f152a9f224714fcc98819ea4e01153589cc21d4e`. Локальная native acceptance-ветка сохранена отдельно; Android-файлы и native-acceptance workflow в этот PR не переносятся. `GENESIS_DEPLOY_ANDROID` переключён с `true` на `false`; существующий deploy.yml пропускает все native build/sign/publish steps и исключает downloads/android-update.json из website-only upload. Схема CI/CD и разрешённые серверные корни не меняются.

## Что входит

- Same-project перемещение/завершение сохраняет task.updated и прежнее состояние вместо ложного выхода из проекта, с regression на точную историю отчёта.
- Общий порядок записи задачи/спринта и свежие planning snapshots; защищённые recovery-команды и свежие права в task/workflow; доступный Cancel без прав на запись.
- Отчёт сохраняет сводку/единицу при offline и обновлении, очищает недоступные источники; исходные пользовательские названия сохраняются. Общие компактные icon actions и стили используются в затронутых web-панелях.
- Legacy Yandex OAuth использует существующий account-scoped redirect; публичный вход остаётся Google-only. Исправления типов и локализованных feedback-строк из ранее подготовленного web-среза сохранены.
- RFC 2047 encoder темы/имени отправителя, standalone regression и три локализованных welcome introductions. [Gmail: результаты и ограничения](genesis-email-deliverability-2026-10-22.md), [вводный экран](genesis-welcome-intro-2026-10-22.md).

Из общей точки `8dcecdc` перенесены только собственные web/API-изменения через трёхсторонний patch. Параллельные обновления Aretology, авторство и все новые изображения из текущего master сохранены. В PR нет изменений `public/`, `android/` или миграций БД. Секреты, приватные config/runtime/SQLite и соседние сайты не читались и не менялись.

## Проверки кандидата

На итоговой web-ветке: frozen install PASS; lint PASS с двумя прежними img warnings; `tsc --noEmit` PASS; **498 web tests PASS**, i18n audits PASS; build:beget PASS; standalone email suite **299 assertions PASS**. Результат включает новые тесты свежего master и предыдущие локальные проверки срезов. Первый audit этой новой Windows working copy остановился из-за CRLF в generated `server/resources/shared-notification-copy.json`; штатный exporter восстановил LF, Git не показал содержательных изменений. Исходный failure log сохранён, повторные test/build/email прошли; ранее успешные install/lint/types без причин не повторяли.

Receipt/logs — в `output/website-checkpoint/` локальной acceptance working copy. Там же source patch manifest:51 исходно выбранный файл и23 исключённых native файла; позже добавлены результаты L3 и этот release protocol. Source patch не является полной копией репозитория. Скриншоты/локальные app checks подробно привязаны к своим срезам; Android APK для них собраны до нового ограничения пользователя и не выпускаются. Новых Android сборок после указания не запускали.

Далее штатный порядок: commit/push этой web-ветки, PR backend acceptance, merge в master и ожидание Deploy GENESIS. После деплоя проверить совпадение `/deploy-meta.json` с текущим master, `/api/health`, web/assets/Google-only entry и неизменность Android update manifest. На момент этого preflight результат production ещё не заявляется; окончательный SHA/run/health сохраняются отдельным release receipt.

Inbox-доставка нового письма Gmail, fresh Google OAuth/Calendar roundtrip, общая межклиентская и физическая a11y-приёмка этим промежуточным релизом не доказаны. Пользовательский скриншот старого письма уже подтвердил SPF/DKIM/DMARC pass. Операторский SSH не использовался. Полный основной промпт остаётся открытым:11/32 принятых ID,21 частичный, отдельно14 K/U/L.
