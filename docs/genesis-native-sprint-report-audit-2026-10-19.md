# G4/native: отчёт выбранного спринта

Продолжение после source-приёмки G3/PR #214. Основание — свежий `origin/master` 46d8432. Сохраняются существующие [server/web отчёты](genesis-sprint-reports-2026-10-19.md), Native Affairs и STANDART. Общий остаток: 21 частичный ID/14 K/U/L.

## Контракт

- POST `/shared/projects/:project/planning/sprints/:sprint/report` с unit tasks/points/hours; `/check` с token; `/sources` с token, kind tasks/events/changes, metric/date/cursor. Это чтение. Текущие права и fingerprint проверяются сервером до каждой страницы.
- Стартовый план, уже выполненное, факт, остаток, перенос, текущий состав; изменения состава/оценок. Tasks/points/hours независимы, 0/null различаются. Отсутствующая история не превращается в нулевую производительность.
- Дневные точки включают разрывы, partial coverage, WIP и статусы. Даты читаются в сохранённом календаре/часовом поясе запуска. Нет нового writer protocol, SQL или миграций. Действуют серверные пределы 20000 событий/наблюдений/IDs, ответ sources — до100 строк.
- Report token связан с actor/project/sprint/unit/asOf/fingerprint; не писать его в логи, URL или локальный кеш. `REPORT_CHANGED`, отсутствующая история, слишком большая история и потеря доступа имеют разные состояния. После отмены/смены аккаунта поздние ответы игнорируются.

## Один следующий экран

Расширить существующее планирование: у выбранного спринта действие открытия отчёта. Экран наследует Affairs header,48dp icon actions/tooltips, существующие поверхности и типографику. Единицы и текущий период доступны сверху, затем компактные строки плана/факта; графики и подробные данные раскрываются отдельно. На широком окне навигация рядом с содержимым, на телефоне — компактный поток без обязательной широкой таблицы.

Показывать burndown, WIP с выбором статуса и cumulative flow. Цвет дублируется подписями/числами; доступна текстовая дневная детализация. Линии не проходят через неизвестную историю. Число открывает разрешённые источники; страницы не теряют строки. Исторические оценки отделены от текущей задачи. Для архива/переноса задача заново читается по её текущему проекту и показывается внутри отчёта общими компонентами чтения карточки — без переделки глобальной навигации и редактора.

Сохранить поведение web: при потере сети в уже открытом экране остаётся помеченный устаревший агрегат, источники/токен/карточка очищаются; после подключения нужно явное обновление. Между процессами отчёт не сохраняется. При отзыве доступа скрываются также названия и агрегаты, родительское планирование получает уведомление. Любое новое чтение источника и настоящей задачи требует сети. Это не закрывает общую cold-offline приёмку A4.

## Приёмка перед публикацией

Проверить planning/not-started, active/completed, missing start/end, 0/null, points/hours, partial/gaps,30 статусов и крупные значения; источники0/100/131, архив/перенос, неизвестные записи, изменившийся token/права/данные и поздние ответы. Проверить утрату/возврат сети, смену единицы/спринта/аккаунта, защиту от старого ответа и сохранность прежних planning/workflow/task/list сценариев. Сначала модель/границы и один полный экран, затем один пакетный visual pass обеих схем ×360/390/768/1440dp,14 языков/font130; максимум один confirming pass после общего исправления. Не выпускать официальный APK на основании gateway fixtures; живой Google/HTTP, физические устройства/TalkBack и release runtime перечислить отдельно.

Аудит не означает реализации G4. SSH и production-БД не использовались. Подготовленная protocol7/E4/F ветка не объединяется автоматически.

## Direction contract

THESIS: selected sprint planning gains a read-only plan/fact view with explicit unknown history and inspectable sources. No new top-level product navigation is introduced.

OWN-WORLD: existing STANDART paper/green/gold Material roles, Affairs header/disclosures, 48dp outlined and icon actions, current theme typography. No new assets, library or visual identity.

STORY: choose a sprint, compare the launch plan and current outcome, inspect daily gaps and sources, then freshly read a moved or archived task. Unit changes never reinterpret points as hours.

FIRST VIEWPORT: existing Affairs heading and refresh action; unit, period and section navigation above compact metric rows on phone, beside them at 720dp and wider. Details and graphs use the same vertical flow.

FORM: ordinary extension of existing native planning, with inherited composition; no concept seed or comp is owed. Both phone widths and tablet/desktop classes use the same content and independent navigation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
