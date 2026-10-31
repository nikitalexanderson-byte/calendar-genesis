# Genesis Tasker 3.1.3 — build6: фактические результаты и оставшиеся проверки

Итоговый исторический срез build6 уточнён **30 октября 2026, 15:16 +03:00** после остановки API35. Это отчёт по raw-журналам, не разрешение выпуска. Результаты более позднего candidate7 и ограниченные followup8 приведены отдельно в [device-build7-validation.md](device-build7-validation.md). Исторические FAIL, SKIP и NO_RESULT build6 сохранены; результат отдельного метода не переводит широкую acceptance-строку в PASS.

Машинный индекс: [build6-evidence-index.json](../../../outputs/v313/build6-evidence-index.json). В нём SHA-256, размер и mtime каждого raw log, start/terminal события, причины FAIL/SKIP, активные методы, 157 frozen JUnit XML build6 и отдельный контекст build7 с его XML/manifest/runtime. Источник текущих восьми test-файлов сравнивается с frozen source7; compile не переносится на последующие edits. Read-only генератор: `python outputs/v313/index-build6-evidence.py`. Поздние запуски не добавляются к totals build6.

## Сборка и unit tests

| Источник | Фактический результат | Граница |
| --- | --- | --- |
| `android-build6.log` | BUILD FAILED; `OutOfMemoryError: GC overhead limit exceeded`, debug/release Kotlin compilation | Ошибка ресурсов сборочного процесса, не app crash. |
| `android-build6-serial.log` | BUILD SUCCESSFUL, 15m 10s | Повтор с ограниченным параллелизмом; не signed/runtime acceptance. |
| `android-build6-https-fixture.log` | BUILD SUCCESSFUL, 4m 26s | Сборка отдельного HTTPS debug/test package. |
| `android-build6-fixture-retest.log` | BUILD SUCCESSFUL, 5m 23s | Сборка уточнённых fixtures, отдельно от запуска их тел. |
| `outputs/v313/candidate6-unit-results/` | **157 suites, 891 tests, 0 failures, 0 errors, 0 skips** | Пересчитаны actual XML; не повторён результат candidate3 с восемью skips. |

Восемь ранее пропущенных HTTP unit integrations действительно исполнены: `CustomFieldHttpIntegrationTest` 2/2, `DataImportHttpIntegrationTest` 1/1, `ProjectAccessHttpIntegrationTest` 1/1, `SharedAutomationHttpIntegrationTest` 1/1, `SharedBulkHttpIntegrationTest` 1/1, `SharedTemplateHttpIntegrationTest` 2/2. Это изолированный локальный HTTP стенд, не live Google/production.

## Instrumentation: каждый запуск отдельно

Все имена журналов находятся в `outputs/v313/`.

| Журнал | PASS | FAIL | SKIP | Завершённость |
| --- | ---: | ---: | ---: | --- |
| `realme-build6-core-light.log` | 22 | 1 | 0 | 23/23 terminal, suite FAIL. |
| `realme-build6-completion-retest.log` | 9 | 0 | 0 | `OK (9 tests)`. |
| `realme-build6-locales.log` | 1 | 1 | 0 | 2/2 terminal, suite FAIL. |
| `api26-build6-emergency-fit-notification.log` | 2 | 0 | 0 | `OK (2 tests)`. |
| `api26-build6-store-ru.log` | 0 | 1 | 0 | Исторический capture-fixture FAIL. |
| `api26-build6-store-ru-retest.log` | 1 | 0 | 0 | `OK (1 test)`; см. ограничение темы ниже. |
| `api26-build6-store-en-retest.log` | 1 | 0 | 0 | `OK (1 test)`; см. ограничение темы ниже. |
| `api26-build6-https-auth.log` | 22 | 3 | 0 | 25/25 terminal, suite FAIL. |
| `api26-build6-https-ui.log` | 32 | 3 | 7 | 42/42 terminal; 6 optional captures и 1 необходимый IME сценарий пропущены. |
| `api26-build6-mindmaps.log` | 1 | 1 | 0 | 2/2 terminal, suite FAIL. |
| `api26-build6-habit-exchange-portable.log` | 1 | 0 | 0 | Первая native фаза обмена; host verification и concurrent фазы проверяются отдельно. |
| `api26-build6-habit-exchange-race.log` | 1 | 0 | 0 | Native concurrent фаза PASS; host `exchange-verify-race` — отдельное доказательство. |
| `api35-build6-ui-all-hostgl.log` | 200 | 24 | 60 | **284/322 terminal**, ещё 1 start без результата, 37 методов не начаты. Финала runner нет. |

`INSTRUMENTATION_STATUS_CODE` 0 — PASS, -2 — FAIL, -4 — assumption skip. Финальный `INSTRUMENTATION_CODE: -1` присутствует и у успешных запусков: сам по себе он не означает FAIL; учитываются terminal события и runner summary. Разные запуски одного метода не складываются как уникальные пользовательские сценарии.

В окончательном raw-журнале последняя запись — start285 `SharedWorkspaceUiTest.customViewerSeesValuesIncludingArchivedDataWithoutEditableControls`; результатов38 методов нет. Ранний срез280/281 успел дополниться четырьмя terminal событиями до остановки собственного AVD root в13:40:33, без очистки данных. Stop-note сохраняет раннее число280; итоговые200/24/60 взяты из raw, а не из этой заметки. Один завершённый метод упал при teardown: Activity не перешла в DESTROYED, последний переход PAUSED. `lastanr` read истёк через8s, crash buffer пуст, kernel snapshot показывает sleeping process; это не доказывает ни app crash, ни QEMU crash. Точный [tail38](api35-build6-tail.md) построен из каталога322 методов и совпал со всеми285 наблюдавшимися ordinal/class/method starts,0mismatch:34 functional и4 capture. Поздний проход7 сопоставлен отдельно, исходным NO_RESULT не присвоен PASS.

## Что именно подтверждено

- В Realme core все **14 методов `Release313UiTest` PASS**: календарная навигация/солнечный день, спойлеры года, полный текст месяца и «Сегодня», drawer, настроение и созданные трекеры, таймер/воздержание, Гант, три карты, 13 олимпийских символов/справочник и узкие подписи. Это сценарии fixture; полный обход всех элементов, состояний и тем из этого не следует.
- В отдельном Realme retest все **9 методов `TaskCompletion313Test` PASS**. Проверены Today/Calendar/«Дела», обычная задача/серия, undo/recreation, быстрые нажатия, разные occurrences, stale/deleted snapshots, cancellation и неправильные metadata/запросы. Исходный core FAIL `affairsCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation` возник после DB commit до обновления UI; после bounded ожидания реального checkbox state он прошёл. Исторический FAIL не удалён. Samsung и подписанный релиз этим не проверены.
- На API26 PASS `Release313UiTest.fiveHundredLetterTaskTitlesStayCompleteAtBothFontScales` и `ReminderFlowTest.notificationOpensTheStoredRecord`. Ранее мешавшее окно release notes обработано реальным действием теста; успешный повтор относится к этой fixture.
- В незавершённом API35 suite уже есть terminal PASS всех 5 методов `HabitFeedback310Test` и всех 4 `MobileReview4Test`, включая реальный канал уведомлений и фактическую SVG отрисовку. Они закрывают соответствующие прежние assertions, но не завершают suite и не доказывают слышимость звука/OEM фон.
-38 required fixture skips API35 сопоставлены по **точной паре class/method** с API26 HTTPS UI/Mindmaps:33 PASS,4 FAIL,1 IME skip. Отсутствующих совпадений нет. Результат API26 сохраняется отдельно; исходным API35 skips не приписан PASS.

Realme translation report содержит **1084 состояния**, все 14 языков завершены, `traversalComplete=true`, `wordSplitFindings=[]`, но **50 Russian findings**. `Таймер привычки` остаётся в13 нерусских языках, `: снять отметку` — в 12; для uk suffix не отмечен. Это продуктовый дефект локализации, а не основание ослаблять фильтр. Ноль wordSplit findings относится только к записанным состояниям/строкам/масштабам данного fixture. Изменённые переводы требуют нового полного прогона.

## Причины FAIL и исправления для следующего кандидата

| Сценарий | Установленный факт / классификация | Следующее обязательное действие |
| --- | --- | --- |
| `SharedWorkspaceUiTest`,16 FAIL в `selectFixtureProject:837` | Тест ждёт `shared-view-list` внутри закрытого popup. В main выбор находится за `shared-view-selector`. В этом проходе тела этих16 сценариев не исполнены. | Helper открывает selector → «Список», затем ждёт actual query; assertion после Back проверяет реальный selector с accessible name «Список». Результаты повторного класса42 в build7 приведены отдельно. |
| `SharedPlanningLifecycleUiTest.emptySprintCanBeCompletedWithoutInventingTaskDecisions` | Сразу после IO preparation ищется ещё не материализованный lazy child. `show` также не гарантировал готовность editor.load. | Bounded enabled/journal/busy/error ожидания → lazy scroll → реальный finish. Исходный outcomes=0 сохранён; добавлены state/revision/receipt/draft-removal assertions. |
| `SharedPlanningLifecycleUiTest.inputCalendarsKeepCivilDatesAndSavedYearContextAcrossDstAndReopen` | Тест ищет Text «Закрыть», main использует иконку `author-date-close` с contentDescription «Закрыть». | Используется actual tag/accessible label; все civil-date/year/timezone assertions сохранены. |
| `SharedPlanningUiTest.assignmentUsesExistingTaskPatchAndKeepsZeroAndHours` | Patch/значения уже проверены; после выбора спринта первая task-row может быть вне lazy viewport. | Дождаться actual sprint read, материализовать точную task-row прокруткой, проверить visible/enabled move. |
| `MindmapsIntegrationTest.nativeTaskReferenceRoundtripAndPdf` | `save-task` — фиксированный footer вне `task-editor-scroll`; performScrollTo незаконен. | Оба Save нажимаются с assertDisplayed/assertEnabled; task roundtrip,1task, удаление ветки и1000-node PDF assertions сохранены. |
|3 метода `NativePlanningHttpsIntegrationTest` | Actual native report parser бросает `SPRINT_REPORT_INVALID`. Root/Android агент разбирает main protocol. | Повторить3 failed метода после protocol fix, затем UI report/G suite. Не объявлять fixture. |
| `SharedGSuiteHttpsUiTest.parentWorkflowBacklogSprintStartCarryoverAndHistoricalSourcesUseTheSameTasks` | Timeout на `report-overview` после открытия actual sprint report; согласуется с тем же protocol path. | Source теста не изменён; повтор после main protocol fix обязателен. |
| `SharedSprintReportUiTest`, `SharedWorkflowUiTest`, `SharedTeamReportUiTest` | Отдельные ошибки lazy/readiness/actual landscape IME. Разбор и правки переданы Android агенту; этот отчёт их не редактировал. | Новый целевой прогон с сохранением исходных disabled/empty-role/full-input-bounds assertions. |
| Store capture | Ранний FAIL при поиске ещё не загруженного timeline; RU/EN retests terminal PASS. Root отдельно установил, что auto schedule переопределял ожидаемую тёмную схему. | Переснять обе схемы/языка с проверкой actual app theme; прежний runner PASS не принимает неправильную тему и не доказывает upload в Play. |

На момент build6 три причины ещё **не установлены**; поздние факты и границы исправлений приведены в отчёте build7:

- `SharedBulkUiTest.choosingTasksNeverCompletesThemAndPreviewNeedsAnExplicitApply`:60s Compose/Espresso busy при ожидании `bulk-confirm`, без app crash stack и без исходного failure PNG. Соседние preview методы PASS не устраняют этот FAIL. Подготовлены passive gateway counters, last phase, journal phase, thread traces и native capture; timeout, animation и assertions сохранены.
- `SharedTemplatesUiTest.aFiftyFirstDependencyHasANameAndCannotDiscardTheProtectedGraph`: dep:51 прошёл UI `assertIsOn`, но journal после 30s содержал только dep:2…dep:50; logcat сообщает `Visible editor error: none`. Подготовлены passive autosave started/returned/failed events с dependencies и actual saved record. Это разрыв UI/persistence; простое увеличение времени или ожидание перед пользовательским действием не применяется.
- `SharedQueryBulkUiTest.perProjectStatusControlsRequireBothMappingsBeforeAnExplicitPreview`: timeout на `bulk-kind` после Configure. Source-risk: debounce `saveInput` отменяется сменой `state.busy`; cancellable IO способен закоммитить journal, затем потерять returned CAS stamp. Для доказательства добавлена passive трасса expected/returned stamps и actual input/command record. Условие ещё не воспроизведено диагностически; main не исправлен предположением.

Passive diagnostics используют только synthetic fixtures и не выводят cookie/CSRF/ключи. Внешние файлы: `planning313-*.json/.png`, `workspace313-select-*.json/.png`, `bulk313-*.json/.png/*threads.txt`. HTTPS internal files: `template-failure-dependency-save.json/.png`, `query-bulk-failure-<tag>.json/.png` в `/data/user/0/ru.genesis.calendar.ghttps.debug/files/`; это **не** external storage. Ошибки diagnostic capture добавляются как suppressed, исходная ошибка сохраняется. Новых Compose ожиданий в failure capture нет; `captureNativeWindow` использует штатную native capture реализацию.

Семь test-файлов из этого разбора вошли во frozen source `2f32e3cb` и успешно скомпилированы root в build7:17m23s,157 suites/895 executed unit tests/0failures/0errors/0skips. Это не результат build6 и не blanket runtime PASS. Следующие test-only изменения SharedWorkspace, TaskerDrawer и Mindmaps сделаны уже после freeze7; их новая compile/runtime проверка ещё требуется. Main code, Gradle и ADB этим агентом не запускались/не менялись. Hash и source-match каждого test-файла — в индексе.

## Сохранённые host-фазы обмена привычками

Обе native фазы1/1PASS дополнены подлинным [historical transcript](../../../outputs/v313/build6-habit-exchange-host-history.txt), извлечённым из исходной root tool history, без повторного выполнения. `exec-5e830637-40b6-4c4f-9c75-ecb8e2bb0745` exit0: `exchange-verify` подтвердил encrypted round-trip, полные backup/CSV, отсутствие повторных наград и отчёты во всех календарях; затем после nonzero-exit guard подготовлен независимый website race branch. После отдельного native concurrent метода `exec-69379bbf-b906-48b1-a5cf-00bc4f50002b` exit0 с таким же guard подтвердил daily XP once, обе quantity records, явное pause/archive resolution и уникальные reward events.

В transcript сохранены четыре execution IDs, точный stdout и порядок. У финального composite command включена только строка verifier; посторонние данные live UI не копировались. Отдельного исходного verifier JSON не существовало и ему не приписывается PASS. Это изолированные HTTPS fixtures, не live Google, signed upgrade или production sync.

## Приоритет следующих проверок

1. **Проверить изменения после freeze7 в новом кандидате.** SharedWorkspace/TaskerDrawer/Mindmaps test-only исправления, Query product fix и TeamReport IME остаются отдельными обязательными повторами. Фактические результаты7 и точное сопоставление старого tail38 — в следующем отчёте. Для unknown ошибок сначала сохранять диагностику, затем исправлять подтверждённую причину; не повторять до случайного PASS.
2. **Native report protocol.** Все3 прежних failed `NativePlanningHttpsIntegrationTest` метода, GSuite и functional SprintReport методы прошли в7. Их точные результаты не нужно повторять вместо чтения; final source8 acceptance остаётся отдельно. Не запускать общий HTTPS cohort одновременно на двух устройствах: один synthetic actor/quota fingerprint.
3. **Локализация и реальные размеры.** Повтор14 языков Realme выполнен в7:1097states,0Russian/wordSplit findings; это узкое доказательство записанных состояний. Actual light/dark, font1.0/1.3, native360/390/768/1440, portrait/landscape и IME требуют полной матрицы. Отдельный `SharedTemplatesUiTest.thePrimaryActionRemainsReachableWithTheKeyboardOpen` с `genesisTemplateKeyboard=true` прошёл в7; исходный required skip6 сохранён.
4. **Привычки web↔native.** Native portable/concurrent и обе последующие host verification фазы подтверждены отдельно с порядком и stdout выше. Не повторять их вместо чтения результата и не запускать unordered весь класс. Это не заменяет Google/live/device-account roundtrip и финальный signed upgrade.
5. **Живой аккаунт и напоминания.** Root подтвердил signed6 synced UI и phone-web own-record read/save; native readback/server duplicate count ещё отдельны. BackgroundReminderTest в правильном порядке прошёл на Realme и API35 forced deep Doze в7; cutoff/postTime proof сохранён. HabitReminderRecovery/ExpiredSession, остальные Google/account/conflict состояния, reboot+unlock,permissions/channel/DND/force-stop/OEM/слышимость остаются. Не запускать verify раньше arm и не менять account между фазами. Samsung checkbox и фон отдельно не подтверждены.
6. **Подписанный upgrade и финальный дистрибутив.**119→120 без clear/uninstall, несинхронизированные/зашифрованные данные, ключи/session/outbox/settings/reminders; затем minified startup/ART/R8,16KB runtime и фактически доставленный Play APK/splits. Статический PASS candidate5 из `signed-candidate-validation.md` не удостоверяет изменённый candidate7 source или Google Play runtime.
7. **Карточка и выпуск.** Переснять реальные RU/EN native screenshots с synthetic данными и actual темой, проверить порядок/читаемость/9:16, заменить старые assets в обоих listings и сохранить Console. Затем проверить Alpha install/update/pre-launch, actual publication status, штатный deploy и public APK hash/health/meta. Существующий Production blocker и политика/privacy/data safety требуют отдельного актуального Console подтверждения; этот агент Console не открывал.

Для точечного запуска используется `am instrument -w -r -e class 'полный.Класс#метод' <установленный-runner>`. Runner/application ID и APK должны соответствовать конкретному candidate7; HTTPS использует package `ru.genesis.calendar.ghttps.debug` и существующие CA/fixture arguments. Секретные аргументы не выводить в отчёт.

## Сопоставление с общей матрицей

В матрице **242 строки,18 колонок**:193 NOT RUN,5 N/A,1 BLOCKED,27 PASS,16 FAIL. Исходные210 строк сохранены поле-в-поле;32 узких historical RUN строки добавлены отдельно. Все193 mandatory статуса неизменны:192 NOT RUN и1 BLOCKED. RUN records не закрывают broad acceptance IDs; release-checklist обновлён с этими ограничениями. Bug-register этим отчётом не редактируется.

Помимо целевых regression tests остаются широкие `E2E-01…06`, `UPGRADE-01/02`, `REM-REAL-01…03`, `REM-SAMSUNG`,10 UI размер/тема/font строк,14 I18N строк, существенные OS API, measured performance119↔120, security boundaries и DIST checks. Нужны результаты по фактическим этапам create/edit/validation/cancel/save/reopen/restart/related-view/sync; одно открытие экрана либо совпадение candidate-класса не является PASS всей строки. У полного UI/контролов, TalkBack, долгой сессии/ANR/performance, live Google, signed upgrade и Play runtime нет завершённого доказательства в данном срезе.

SSH не использовался. Production-БД, конфигурация и личные данные устройства этим агентом не читались и не изменялись.
