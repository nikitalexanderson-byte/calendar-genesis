# GENESIS: текущее состояние — 18 октября 2026

Последние3 UI-просьбы19 октября подготовлены и проверены: [окно задачи блоками, обзор пространств и иконки действий проекта](genesis-task-blocks-project-tools-2026-10-19.md). Следующий основной блок — G4; число открытых функциональных ID остаётся21.

Последнее указание пользователя18 октября **отменяет прежний запрет промежуточных выпусков**: сначала опубликовать готовое, затем продолжать основной промпт и выпускать проверенные этапы до указания «стоп». [Совместимый веб-выпуск](genesis-web-ready-release-2026-10-18.md) опубликован: C1–C6 server/web, G1/G2 и последние UI-уточнения, PR #197/#198, master/production `2157ed8059c4f708a927ed1be69a0fe1f31ebe0c`, workflow `39161929950` success. SHA/health/assets и неизменный Android2.9.0/95 подтверждены. Расширенные E4/restore/F с minimumWriterProtocol7 сохранены только в `codex/genesis-complete-acceptance`; они ожидают совместимого Android. Текущий сервер/web сохраняет protocol6. Исторические запреты в отчётах отдельных checkpoint больше не являются действующим ограничением.

19 октября UI-просьбы по спискам и шапке опубликованы в PR #199/#200: [блоки окна списка и описание пространства](genesis-list-layout-2026-10-19.md), master/production `629ba5d5575763cee45c2120cb34e6df5b525e44`, workflow39175259705 success; SHA/health/asset и Android2.9.0 подтверждены. G3 server/первый веб-экран опубликован в [PR #201](https://github.com/nikitalexanderson-byte/calendar-genesis/pull/201), master/production `71da6c735977b15d434cc82a415d629f694831a7`, workflow39181636397 attempt2 success; SHA/health/asset и неизменный Android подтверждены. [Приёмка G3](genesis-workflow-wip-2026-10-19.md):13 серверных групп с реальными bulk/C1/C2/C5/restore/concurrency,328 web tests,14 browser languages и обе темы×4 ширины. G3 остаётся частичным до native/cold-offline/архивного UI и общей приёмки. Всего открытых ID21:20 частичных и G4 как1 блок первичной реализации. Рекламные материалы завершены самим пользователем и больше не входят в работу.

## Подтверждённые публикации

Опубликованные C5/C4 и G1–G2 server/web реализованы и проверены — [обмен данными](genesis-data-exchange-2026-10-18.md), [командные отчёты](genesis-team-reports-2026-10-18.md), [спринты, оценки и ограничения](genesis-agile-2026-10-18.md).365 web tests,37 самостоятельных PHP suites, реальные HTTP browser flows,14 языков, обе темы ×четыре ширины. Общий tsc сохраняет8 прежних ошибок; специализированный mindmaps harness в последнем regression не запускался. Следующий основной блок — G4 после новых UI-просьб. [Актуальный остаток](genesis-remaining-work-2026-10-18.md):21 открытый ID,1 блок первичной реализации и20 частичных; это не процент готовности.

- F1: PR #192, master/production `178200c4fd1e4889558cffbb427fb87f6888d21a`, workflow `39058401746`, attempt 2 success. GitHub billing block снят; SHA/health подтверждены.
- E5 export: PR #193, master/production `5bf126e99d7ff8b92787f2d0261c51c9ec5a31c5`, workflow `39070503817` success. Вся история CSV и JSON backup доступны в «Привычки → Прогресс → Данные привычек». SHA/health подтверждены. Это последняя проверенная production-точка перед новым выпуском переводов/панели.
- Переводы/панель: PR #195, master/production `e0da266909fda4b4fa576a5f87e4bec8798a755d`, workflow `39074394425` success. SHA/health подтверждены; встроенные поля переводятся без изменения пользовательских данных, майндмепы находятся слева в группе проектов. Дополнительно проверены 1176 строк сакральных каталогов (28 практик ×14 языков ×3 поля): неожиданных русских строк в некириллических локалях нет. Это текущая подтверждённая production-точка перед следующим срезом F2.
- F2, личные рекорды: PR #196, master/production `36027d89ae5fb052f01f34ddf654d88148ae84cc`, workflow `39076193420` success. Подтверждены SHA/health, 326 tests и 8 browser cases в обеих темах ×360/390/768/1440. Это последняя опубликованная точка перед приостановкой деплоев.
- Android остаётся **2.9.0/95**, SHA256 `a04a3b8c85d6b3977fc634f7f3779b5cac3ff93eddc2bd27ac006b2c50449243`. GENESIS_DEPLOY_ANDROID=false.

## Подготовлено и проверено отдельно

- G1–G2 server/web: opt-in backlog/sprints, полная пагинация, lifecycle с явными carry-over decisions, независимые points/часы и0/null, суммы/assignees/C4, C1/C5 round-trip и old-client preservation. Atomic rollback, current ACL/CAS/replay, два browser contexts, потерянные committed create/complete responses и mounted offline draft подтверждены.8 before/39 after PNG,14 языков, две темы ×4 ширины. Нативный UI, durable cold-offline draft, дальнейшие G3/G4/B/C-интеграции и общая приёмка остаются открытыми. [Подробный отчёт](genesis-agile-2026-10-18.md).

- Три последних UI-уточнения реализованы и проверены: [пространство, pin и единые списки](genesis-workspace-ui-refinements-2026-10-18.md).365 web tests, lint/build, обе темы ×4 ширины,14 языков, клавиатура, переключение пространств и перенос списков.24 before и44 after PNG. Это дополнительный UI-срез; число открытых ID основного промпта остаётся21. Production и Android не обновлялись.

- C6, проектные права: checkpoint `50df33b`, `genesis-project-access-2026-10-18.md`. Серверный индекс и web preview/apply, CAS/replay, inheritance/exclusions, privacy history/maps, три browser-сессии и все14 языков проверены; обе темы ×4 ширины. Нативный UI и будущие C/G-интеграции ещё открыты.
- C3, поля: checkpoint `4c8436c`, `genesis-custom-fields-2026-10-18.md`. API/редактор/карточка/список/типовые query и saved views, encrypted versions/values, архив/type successor, required и0/false проверены;365 web tests, чистый PHP regression suite,14 языков и16 viewport/theme cases. Открыты шаблоны/автоматизации/import/export, зависимые B/G и native. C1 теперь также подготовлен и проверен: `genesis-templates-2026-10-18.md`.

- C1, сервер и web: encrypted библиотека/редактор, сохранение из задачи/проекта, четыре системных шаблона на14 языках, preview/maps/atomic apply, CAS/replay, удаление/восстановление и актуальные C6-права.365 web tests, PHP regression и C1/migrations,32 viewport/theme cases и28 языковых сценариев подтверждены; общий tsc имеет8 прежних ошибок без новых C1. Native и зависимые интеграции ещё открыты.

- F1–F3, веб и нативные data-контракты: `genesis-habit-goal-analysis-2026-10-18.md`. Добавлены календарь выполнения и исходные записи, отдельные знаменатели количества/целей, честная неизвестная legacy-доступность, causal explicit skip и защита XP двух клиентов. 364 web и 296 native JVM tests; нативный UI/upgrade/device acceptance остаются открыты. Следующий основной этап — C6 как основание C1–C5, затем G и зависимые B.

- Продолжение в общей непубликуемой ветке: `genesis-unpublished-acceptance-2026-10-18.md`. Включены подготовленные E4 и Android cancellation; добавлены нативные codecs/merge protocol7 и веб-предпросмотр/применение backup. Это рабочая ветка без merge в master. Полный нативный UI, F/C/G и общая приёмка ещё не завершены; запрет деплоя действует.

- Android cancellation: `codex/android-shared-cancellation`, `1b0ef16`, draft PR #194. Точная ошибка со снимка воспроизведена до исправления; после него 284 JVM и 10 emulator API28 UI tests прошли. Без merge/выпуска приложения по поручению пользователя. Отчёт `genesis-android-shared-cancellation-2026-10-18.md` находится в этой отдельной ветке.
- Переводы/панель опубликованы: 319 tests, все 14 языков через модель/аудит; реальные EN Artemis/Apollo 16 browser cases, панель 8 cases, обе темы ×360/390/768/1440, до/после. Состав/границы: `genesis-habit-translations-toolbar-2026-10-18.md`.
- F2, личные рекорды опубликованы: исправлен числитель процента, убран скрытый cap 100%, сохранена история вне плана, показаны знаменатель, уникальные даты и отсутствие базы. Полный F2 остаётся открыт: календарь выполнения, факт/план количества/длительности и история пауз требуют дальнейшей сквозной работы.
- Незавершённая интеграция E4/E5: `codex/web-habit-backup`, checkpoint `71e1490`; lifecycle `codex/web-habit-lifecycle-complete`, `a046e7f`. Сохранённые ветки не включены в текущий веб-выпуск. Нельзя активировать protocol7 с нарушением синхронизации выпущенного Android 2.9.0.

## Выпущенные основные этапы

Состав предыдущих выпусков подробно сверен в `genesis-current-status-2026-10-17.md`: A1–A3, B3/B6, D1–D3, E1–E3; работающие B1/B2/B4/B5/B7 имеют оставшиеся зависимые интеграции. Срочный UI-срез Android 2.9.0 опубликован, полный нативный промпт ещё открыт.

## Оставшийся основной объём

- E4/E5: веб/data-model pause/archive/delete/restore и backup preview/conflicts/apply, reset/CAS/replay уже проверены в непубликуемом checkpoint; остаются полная нативная UI, старый offline outbox upgrade и device/общая приёмка.
- F1–F3: веб-аналитика новых типов и экономика/causal skip/merge проверены в `8276f8d`; остаётся полная native UI и сквозная экономика всех последующих C/G/B операций.
- C: сервер/web C1–C6 проверены; последние срезы C5/C4 описаны в отдельных отчётах. Открыты native, будущие workflow/WIP/оценки и зависимые B/G-интеграции, общая приёмка и фактический Hostinger runtime после снятия запрета деплоя.
- G1–G2: server/web backlog/спринты и points/часы проверены; native, дальнейшие интеграции и общая приёмка открыты. G3: server/web workflow/WIP опубликован, native/cold-offline/архивный UI и общая приёмка открыты. G4: отчётность по настоящим событиям ещё требует первичной реализации.
- Интеграции B1/B2/B4/B5/B7 и полная A4/K/U/L-приёмка; затем оставшийся нативный этап. Физическая внешняя push-доставка и live Google sync не объявлены подтверждёнными.

Порядок продолжения: новые UI-просьбы → G4 → зависимые B1/B2/B4/B5/B7 и C1–C6 → затронутая native UI/protocol6/7/offline upgrade → общая приёмка и экономика. C5/C4/G1/G2 server/web прошли проверку, native/интеграции ещё открыты. Проверенные совместимые веб-этапы публикуются через штатный workflow по разрешению пользователя18 октября. Android ожидает отдельной совместимой приёмки. Ручной SSH и production DB edits в этом продолжении не использовались.
