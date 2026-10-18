# Совместимый промежуточный веб-выпуск — 18 октября 2026

Пользователь прямо отменил прежнее условие ожидания всего промпта: сначала опубликовать готовое, затем продолжать работу и выпускать следующие проверенные этапы до указания «стоп». Повторное подтверждение промежуточных веб-выпусков не требуется. Полный объём требований сохраняется.

## Состав и совместимость

Рабочая ветка выпуска `codex/genesis-web-ready-release` создана от свежего origin/master36027d8 в прежнем управляемом worktree. Из сохранённой полной ветки `codex/genesis-complete-acceptance` перенесены C6/C3/C1/C2/C5/C4, G1/G2 и последние UI-уточнения. Исходный checkout, чужие изменения и .impeccable/review не затронуты.

Расширенные личные привычки E4/restore/F из полной ветки создают minimumWriterProtocol7; установленный Android2.9.0/95 поддерживает6. Поэтому эти изменения не входят в промежуточный выпуск. Веб-протокол остаётся6; старые habit models, history/merge, server writer guards и native sync сохранены из master. В GenesisCalendar перенесены только связанные с task-list UI изменения. Проверка diff новых shared modules относительно принятого checkpoint20636b2 показала их идентичность. Нельзя ослаблять writer guard ради выпуска.

Разрешены шаблоны задач/проектов, автоматизации, типовые пользовательские поля, проектные разрешения, перенос данных, точные командные отчёты и opt-in backlog/sprints/отдельные points/часы. G3/G4, дальнейшие B/C-интеграции и полный native UI не объявляются завершёнными. Существующие изображения, STANDART light/dark, календари и Google-only публичный вход сохранены.

При переносе разрешены конфликты двух native i18n файлов: подключён только новый shared-work catalog; неподготовленный habit-report catalog не добавлялся. Документы полной ветки описывают сохранённую разработку и не означают её включение в данный выпуск.

## Проверки перед публикацией

Frozen install, lint (0 ошибок и два прежних img warnings),327/327 web tests с i18n и build:beget прошли на ветке выпуска.90 mandatory precache entries,203 visual assets; largest JS349901 bytes. Fresh isolated PHP regression по всем56 самостоятельным suites существующего workflow прошёл, включая10001-task bulk и миграции. Специализированный mindmaps harness отделён существующим CI и не смешивается с этой выборкой. Изолированный browser config восстановлен; PHP fixture перезапущен.

Новые shared screens используют ранее принятые browser screenshots и14-language/theme/viewport acceptance из соответствующих отчётов. После сборки выпуска отдельный интеграционный browser smoke прошёл без Google mock: обе темы ×360/390/768/1440, планирование, оценки в отчёте и реальные planning/automations/custom-fields API200; переполнений и page errors нет.8 release PNG сохранены в output/playwright/web-ready-planning-*.png. Предварительный синтетический профиль с будущими личными данными protocol7 корректно открыл защиту восстановления; его данные не очищались. Приёмка совместимого выпуска использовала отдельный свежий browser context. Полный tsc, live Google roundtrip, physical external push и новый Android release не заявляются подтверждёнными.

## Публикация и откат

Только существующий .github/workflows/deploy.yml после merge в master. Проверены repository variables: GENESIS_DEPLOY_TARGET=hostinger, GENESIS_DEPLOY_ANDROID=false, GENESIS_MINDMAPS=true. Android APK/AAB не переиздаются. Миграции069–077 аддитивны; штатный workflow сохраняет server-only config и согласованную SQLite-копию. Откат кода — git revert выпущенного merge и новый workflow, без автоматического восстановления БД.

После выпуска зафиксировать PR, master SHA, workflow и /deploy-meta.json+/api/health; проверить опубликованные assets и прежний Android descriptor. SSH и ручных изменений production-БД не было.

## Остановка первого CI и исправление

PR197 слит как34078425c9b9875f3eb3a168cc9ab1851d74b7f2. Workflow39160405193 прошёл обычные проверки и остановился в специализированном shared-mindmaps suite до build/deploy: карты без project_id исчезали из списка и истории обычного участника. Production сохранил прежнюю версию.

Причина: PDO execute(array) связывает значение0 как строку; SQLite не приводит bare parameter в сравнении ?=0 к INTEGER. В общем предикате списка/истории добавлен CAST(? AS INTEGER)=0. Условия ограниченного проектного доступа не менялись. C6 regression дополнен проверками пространства для администратора с сохранённым restriction flag и обычного участника после снятия ограничения, включая историю. Существующие проверки скрытых проектов/карт остаются обязательными.

Локально повторены C6/shared-projects/shared-ui и все7 специализированных mindmaps suites на отдельном точном output/mindmaps-test.sqlite: успешно. Для migration suite локальному CLI явно подключена установленная SQLite3 extension; runtime-конфиги не редактировались. Исходные fixture config/DB/session файлы восстановлены. Исправление не меняет клиент, миграции или CI/CD-схему; новый merge повторно выполняет штатный workflow.

## Успешная публикация

PR #198 слит как `2157ed8059c4f708a927ed1be69a0fe1f31ebe0c`; штатный workflow `39161929950` завершился успешно. `/deploy-meta.json` подтвердил этот SHA и runId, `/api/health` — `ok:true`, естественный запуск worker и доступность email/push. Опубликованный SharedProjects JS проверен по URL из production precache:200. Android descriptor сохранил2.9.0/95 и прежний SHA256. Ручные SSH-подключения и изменения production-БД не использовались. C/G остаются открытыми до оставшихся native, интеграций и общей приёмки.
