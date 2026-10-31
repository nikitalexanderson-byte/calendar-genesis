# Genesis Tasker 3.1.3 — build4: проверка устройства и сборок

Срез прочитан `2026-10-30T07:16:09.179776+00:00`. Проверены **24** текущих локальных `outputs/v313/*build4*.log`: 4 Android build logs, 4 web logs и 16 instrumentation logs. Отчёт сохраняет первоначальные ошибки и повторные проверки раздельно. Кандидат 5 в работе; этот документ не объявляет его проверенным и не является READY выпуска.

Анализ выполнялся без ADB, Gradle, CI и изменений приложения/тестов. `test-matrix.csv` и `release-checklist.md` не обновлялись. Имена файлов build4 не доказывают SHA установленного APK; SHA финального подписанного кандидата должен фиксироваться отдельно в манифесте выпуска.

## Как считались результаты

- Терминальный статус учитывается только при наличии `class` и `test` в том же блоке `INSTRUMENTATION_STATUS`.
- `1` — начало, `0` — PASS метода, `-2` — FAIL, `-4` — ignored/opt-in capture. Завершающий runner `INSTRUMENTATION_CODE: -1` означает завершение runner и не отменяет FAIL методов.
- Три диагностических `STATUS_CODE: 0` без `class/test` в notification-arm исключены из счёта. `captureTeamReport` с `-4` не превращён в PASS, хотя runner напечатал `OK (21 tests)`.
- Получено **114 терминальных событий**: **98 PASS / 15 FAIL / 1 IGNORED**, 74 различных пары class/method. Это события разных запусков, включая повторы; `initializationError` — ошибка инфраструктуры, тело несуществующего теста не выполнялось.
- На момент среза все 16 instrumentation logs имеют финальный результат runner; начатых методов без терминального статуса нет. В частности habit-notification-actions уже завершён: 3 события, 1 PASS / 2 FAIL.

Полный машинный индекс с именами, строками, исходными reason, размерами и SHA-256 всех 24 логов и трёх supporting JSON: [build4-method-status-index.json](../../../outputs/v313/build4-method-status-index.json). Raw logs сохранены; индекс их не переписывает.

## Сборки, unit, lint и web

| Источник | Фактический итог | Ограничение / история |
| --- | --- | --- |
| [android-build4.log](../../../outputs/v313/android-build4.log) | BUILD FAILED | `SharedTeamReportScreen.kt:199/201`: неявный `maxWidth` receiver. Первоначальная ошибка не удалена. |
| [android-build4b.log](../../../outputs/v313/android-build4b.log) | BUILD FAILED | `CalendarAndTodayFlowTest.kt:50/70/78`: unresolved `calendarName` в androidTest. |
| [android-build4c.log](../../../outputs/v313/android-build4c.log) | BUILD SUCCESSFUL, 8m33s; `lintRelease` завершён | Последующая успешная сборка; не стирает предыдущие два FAIL. |
| [android-build4-unit-summary.json](../../../outputs/v313/android-build4-unit-summary.json) | **891 total / 883 non-skipped / 8 skipped / 0 failures / 0 errors**, 157 suites | Это не 891 PASS. Причины 8 skip этим summary не раскрыты. |
| [android-build4-test-refinements.log](../../../outputs/v313/android-build4-test-refinements.log) | AndroidTest BUILD SUCCESSFUL, 33s | Отдельная сборка уточнённых fixtures; не является новым полным unit/release прогоном. |
| [web-install-build4.log](../../../outputs/v313/web-install-build4.log) | Завершённый install log | Не доказывает публикацию. |
| [web-lint-build4.log](../../../outputs/v313/web-lint-build4.log) | 0 errors / 2 warnings | Два предупреждения `@next/next/no-img-element`, не ноль предупреждений. |
| [web-tests-build4.log](../../../outputs/v313/web-tests-build4.log) | **785 tests / 785 PASS / 0 FAIL / 0 skipped** | Точный итог Node runner; не Android device tests. |
| [web-build4.log](../../../outputs/v313/web-build4.log) | Сборка завершена успешно | Лог подтверждает читаемые public/legal pages, 13 locale dictionaries и precache 117 entry / 402 visual assets локальной сборки; production deploy не выполнялся этим проходом. |

## Instrumentation: каждый запуск

| Лог | Терминальные события | PASS | FAIL | IGNORED | Финал runner |
| --- | ---: | ---: | ---: | ---: | --- |
| [api26-build4-core-retest.log](../../../outputs/v313/api26-build4-core-retest.log) | 20 | 20 | 0 | 0 | `OK (20 tests)` |
| [api26-build4-core.log](../../../outputs/v313/api26-build4-core.log) | 20 | 19 | 1 | 0 | `Tests run: 20,  Failures: 1` |
| [api26-build4-flows.log](../../../outputs/v313/api26-build4-flows.log) | 13 | 7 | 6 | 0 | `Tests run: 13,  Failures: 6` |
| [api26-build4-store-capture-preflight.log](../../../outputs/v313/api26-build4-store-capture-preflight.log) | 1 | 0 | 1 | 0 | `Tests run: 1,  Failures: 1` |
| [realme-build4-core.log](../../../outputs/v313/realme-build4-core.log) | 20 | 18 | 2 | 0 | `Tests run: 20,  Failures: 2` |
| [realme-build4-habit-background-arm.log](../../../outputs/v313/realme-build4-habit-background-arm.log) | 1 | 1 | 0 | 0 | `OK (1 test)` |
| [realme-build4-habit-background-verify.log](../../../outputs/v313/realme-build4-habit-background-verify.log) | 1 | 1 | 0 | 0 | `OK (1 test)` |
| [realme-build4-habit-notification-actions.log](../../../outputs/v313/realme-build4-habit-notification-actions.log) | 3 | 1 | 2 | 0 | `Tests run: 3,  Failures: 2` |
| [realme-build4-language-walkthrough.log](../../../outputs/v313/realme-build4-language-walkthrough.log) | 1 | 0 | 1 | 0 | `Tests run: 1,  Failures: 1` |
| [realme-build4-notification-arm.log](../../../outputs/v313/realme-build4-notification-arm.log) | 3 | 3 | 0 | 0 | `OK (3 tests)` |
| [realme-build4-notification-verify.log](../../../outputs/v313/realme-build4-notification-verify.log) | 1 | 1 | 0 | 0 | `OK (1 test)` |
| [realme-build4-regressions.log](../../../outputs/v313/realme-build4-regressions.log) | 21 | 20 | 0 | 1 | `OK (21 tests)` |
| [realme-build4-reminder-recovery.log](../../../outputs/v313/realme-build4-reminder-recovery.log) | 4 | 2 | 2 | 0 | `Tests run: 4,  Failures: 2` |
| [realme-build4-task-background-arm.log](../../../outputs/v313/realme-build4-task-background-arm.log) | 1 | 1 | 0 | 0 | `OK (1 test)` |
| [realme-build4-task-background-complete.log](../../../outputs/v313/realme-build4-task-background-complete.log) | 1 | 1 | 0 | 0 | `OK (1 test)` |
| [realme-build4-task-reminder-actions.log](../../../outputs/v313/realme-build4-task-reminder-actions.log) | 3 | 3 | 0 | 0 | `OK (3 tests)` |

В следующих таблицах общий префикс класса — `ru.genesis.calendar.`. Имена методов приведены полностью. `L` — строка терминального `STATUS_CODE` в соответствующем raw log; исходный stack находится перед ней.

### Core: первоначальные запуски и повтор

A — [api26-build4-core.log](../../../outputs/v313/api26-build4-core.log); B — [api26-build4-core-retest.log](../../../outputs/v313/api26-build4-core-retest.log); C — [realme-build4-core.log](../../../outputs/v313/realme-build4-core.log).

| Класс | Метод | A: API26 initial | B: API26 retest | C: Realme initial |
| --- | --- | --- | --- | --- |
| `ui.TaskCompletion313Test` | `staleAndDeletedCheckboxSnapshotsNeverOverwriteOrResurrectTasks` | PASS `0` · L15 | PASS `0` · L15 | PASS `0` · L15 |
| `ui.TaskCompletion313Test` | `cancellationDoesNotBecomeASaveErrorAndReleasesTheCompletionGuard` | PASS `0` · L29 | PASS `0` · L29 | PASS `0` · L29 |
| `ui.TaskCompletion313Test` | `importedInvalidEndMetadataCompletesOneOccurrenceAndPreservesTheRest` | PASS `0` · L43 | PASS `0` · L43 | PASS `0` · L43 |
| `ui.TaskCompletion313Test` | `rapidTapsShareOnePendingWriteWhileDifferentTasksCanComplete` | PASS `0` · L57 | PASS `0` · L57 | PASS `0` · L57 |
| `ui.TaskCompletion313Test` | `todayCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation` | PASS `0` · L71 | PASS `0` · L71 | PASS `0` · L71 |
| `ui.TaskCompletion313Test` | `calendarCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation` | PASS `0` · L85 | PASS `0` · L85 | FAIL `-2` · L110 |
| `ui.TaskCompletion313Test` | `invalidOccurrenceRequestsReportErrorsWithoutMutatingTheSeriesOrBlockingRetry` | PASS `0` · L99 | PASS `0` · L99 | PASS `0` · L124 |
| `ui.TaskCompletion313Test` | `affairsCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation` | PASS `0` · L113 | PASS `0` · L113 | PASS `0` · L138 |
| `ui.Release313UiTest` | `periodNavigationAndMenuStartAtMonthWhileSolarDatesRevealTheSelectedDay` | PASS `0` · L128 | PASS `0` · L128 | PASS `0` · L153 |
| `ui.Release313UiTest` | `everyYearDescriptionStartsCollapsedAndCanBeExpanded` | PASS `0` · L142 | PASS `0` · L142 | PASS `0` · L167 |
| `ui.Release313UiTest` | `timelineRevealsThreeDistinctCardsInTemporalOrderAndOpensTheirOrientation` | PASS `0` · L156 | PASS `0` · L156 | PASS `0` · L181 |
| `ui.Release313UiTest` | `todayShowsOnlyConfiguredActiveTrackersAndUsesWholeSummaryActions` | PASS `0` · L170 | PASS `0` · L170 | PASS `0` · L195 |
| `ui.Release313UiTest` | `drawerPlacesWholeStatusLinesAndBackgroundNoticeBeforeThreePlainActions` | PASS `0` · L184 | PASS `0` · L184 | PASS `0` · L209 |
| `ui.Release313UiTest` | `symbolicMoodScaleKeepsSelectionAndDoesNotSplitItsLabels` | PASS `0` · L198 | PASS `0` · L198 | PASS `0` · L223 |
| `ui.Release313UiTest` | `olympianSymbolsOpenAllThirteenDescriptionsAndTheGuideHasEverySectorAndGoal` | PASS `0` · L212 | PASS `0` · L212 | PASS `0` · L237 |
| `ui.Release313UiTest` | `timerHasAnOutlinedSubBlockAlignedCollapseAndNoBrokenStopwatchLabel` | PASS `0` · L226 | PASS `0` · L226 | PASS `0` · L251 |
| `ui.Release313UiTest` | `abstinenceIsCreatedAndRecordedInHabitsUsingTheSameTodayRepository` | PASS `0` · L240 | PASS `0` · L240 | PASS `0` · L265 |
| `ui.Release313UiTest` | `everyOracleLocaleRendersItsOwnCompleteReferenceAndModal` | FAIL `-2` · L297 | PASS `0` · L254 | FAIL `-2` · L322 |
| `ui.Release313UiTest` | `completeMonthDescriptionsHaveNoInnerScrollAndTodayAlignsWithTheName` | PASS `0` · L311 | PASS `0` · L268 | PASS `0` · L336 |
| `ui.Release313UiTest` | `ganttKeepsFourScalesInOneRowAndFitsHelpLabel` | PASS `0` · L325 | PASS `0` · L282 | PASS `0` · L350 |

API26 retest — 20/20 PASS. В представленном наборе нет отдельного Realme core-retest, поэтому исходные Realme FAIL галочки календаря и locale reference остаются явными; PASS другого устройства не подменяет их результат.

### api26-build4-flows.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `CalendarFlowTest` | `sacredMonthYearAndApeironRenderOriginalArtWithoutChangingTaskCalendar` | PASS `0` · L15 |
| `CalendarAndTodayFlowTest` | `singleThemeTodayAndCalendarExposeWebDayDetails` | PASS `0` · L30 |
| `TaskRecurrenceFlowTest` | `taskEditorStoresOneClassicSeriesAndProjectsTomorrow` | FAIL `-2` · L82 |
| `ProjectsFlowTest` | `projectScreenOffersNativeEditor` | FAIL `-2` · L126 |
| `ProjectsFlowTest` | `projectAndTaskAssignmentPersistEncrypted` | PASS `0` · L140 |
| `ProjectsFlowTest` | `longPressDragMovesTaskBetweenProjectsAndBackToChaosBox` | FAIL `-2` · L175 |
| `ProjectsFlowTest` | `draggingNearBottomAutoScrollsProjectDestinations` | FAIL `-2` · L208 |
| `ProjectsFlowTest` | `chaosBoxTaskCanBeMovedIntoProjectWithoutGoogleAccount` | FAIL `-2` · L245 |
| `ProjectsFlowTest` | `longPressDragMovesChaosTaskToProject` | FAIL `-2` · L278 |
| `HabitLifecycleFlowTest` | `fiftyDistinctDatesRetainLaurelsThroughDeleteAndRestore` | PASS `0` · L293 |
| `HabitLifecycleFlowTest` | `pauseArchiveDeleteRestoreKeepIdentityHistoryAndEarlierPenalty` | PASS `0` · L307 |
| `HabitLifecycleFlowTest` | `accountArchivePausesTimerAndColdReplayRetainsEncryptedBytesAndOutboxIdentity` | PASS `0` · L321 |
| `HabitPeriodGoalFlowTest` | `threeExecutionsPersistAsThreeEntriesAndOneDayWithoutADailyObligation` | PASS `0` · L336 |

### api26-build4-store-capture-preflight.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `StoreListing313CaptureTest` | `captureSixFinalScreensWithSyntheticData` | FAIL `-2` · L76 |

### realme-build4-habit-background-arm.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `BackgroundReminderTest` | `armAccountAlarmAndPersistOfflinePreferences` | PASS `0` · L15 |

### realme-build4-habit-background-verify.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `BackgroundReminderTest` | `verifyDeliveryAfterProcessDeathAndDurableLocalData` | PASS `0` · L15 |

### realme-build4-habit-notification-actions.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `HabitReminderActionsFlowTest` | `exactHabitQuickActionIsIdempotentStaleClickIsReadOnlyAndMeasuredActionNeedsInput` | FAIL `-2` · L34 |
| `HabitReminderActionsFlowTest` | `snoozeRetainsOriginalTargetAcrossRecoveryAndRespectsQuietHoursAndDeviceBudget` | PASS `0` · L48 |
| `ReminderFlowTest` | `notificationOpensTheStoredRecord` | FAIL `-2` · L88 |

### realme-build4-language-walkthrough.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `NativeTranslationWalkthroughTest` | `visitMainScreensInEverySupportedLanguage` | FAIL `-2` · L762 |

### realme-build4-notification-arm.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `ReminderFlowTest` | `notificationChannelDiagnostics` | PASS `0` · L27 |
| `NotificationReliabilityTest` | `distinctTaskAndHabitChannelsAndNotifications` | PASS `0` · L42 |
| `NotificationReliabilityTest` | `armDiagnosticAlarm` | PASS `0` · L56 |

### realme-build4-notification-verify.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `NotificationReliabilityTest` | `verifyDiagnosticAfterProcessDeath` | PASS `0` · L15 |

### realme-build4-regressions.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `ui.SharedTeamReportUiTest` | `fullSourcePagesOpenARecheckedTaskAndSystemBackReturnsThroughTheFlow` | PASS `0` · L15 |
| `ui.SharedTeamReportUiTest` | `captureTeamReport` | IGNORED `-4` · L34 |
| `ui.SharedTeamReportUiTest` | `changingPeriodOrTimeZoneKeepsConditionsAndRemovesOldTaskLinks` | PASS `0` · L48 |
| `ui.SharedTeamReportUiTest` | `landscapeSystemKeyboardKeepsConditionsAndReportReachable` | PASS `0` · L62 |
| `ui.SharedTeamReportUiTest` | `aChangedReportCannotOpenAnOldTaskAndOfflineClearsResults` | PASS `0` · L76 |
| `ui.SharedTeamReportUiTest` | `allThreePeriodCalendarsPreserveTheSelectedCivilBounds` | PASS `0` · L90 |
| `ui.MobileWorkspaceVisualTest` | `mindmapGivesCanvasSpaceAndProtectsEditedNodeOnBack` | PASS `0` · L105 |
| `ui.MobileWorkspaceVisualTest` | `sharedProjectKeepsTaskDestinationAndEveryViewReachable` | PASS `0` · L119 |
| `ui.QuintaTerminologyTest` | `packagedCalendarNamesKeepRussianAndUseQuintaInEveryOtherLanguage` | PASS `0` · L134 |
| `ui.Android310AcceptanceTest` | `monthIllustrationsFollowTheFullDescriptionHeightWithoutNestedScrolling` | PASS `0` · L149 |
| `ui.Android310AcceptanceTest` | `yearSelectionRestoresTheChosenMonthInEveryCalendar` | PASS `0` · L163 |
| `ui.Android310AcceptanceTest` | `todayTasksAndHabitsHaveTheSameSeparationAsTheDayHeader` | PASS `0` · L177 |
| `ui.Android310AcceptanceTest` | `solarDatesOpenTheirActualMonthAndSelectedDayInEveryCalendar` | PASS `0` · L191 |
| `ui.Refinements306InteractionTest` | `sleepHeaderAndEmptyStateBothOpenTheRealPlanEditor` | PASS `0` · L206 |
| `ui.Refinements306InteractionTest` | `personalEventAndMeetingSaveTheirRealRecordTypes` | PASS `0` · L220 |
| `ui.Refinements306InteractionTest` | `stillPressOnBlankViewportAddsAtTheDocumentPointButPanAndReadOnlyDoNot` | PASS `0` · L234 |
| `ui.Refinements306InteractionTest` | `compactSearchKeepsSortFilterAndCloseInOneRowAndPreservesQuery` | PASS `0` · L248 |
| `ui.MobileReview4Test` | `teamHistoryStartsCollapsedAndRevealsOnlyFiveMoreAtATime` | PASS `0` · L263 |
| `ui.MobileReview4Test` | `cancellingAHiddenSharedPageDoesNotBecomeAnErrorButRealFailuresRemainVisible` | PASS `0` · L277 |
| `ui.MobileReview4Test` | `exactOfflineCircleSupportsZoomSelectionAndOpeningTheCivilDate` | PASS `0` · L291 |
| `ui.MobileReview4Test` | `circleSelectionOutlinesSectorsWithoutStrokingTextOrGlyphPaths` | PASS `0` · L305 |

### realme-build4-reminder-recovery.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `ExpiredSessionReminderTest` | `expiredServerSessionPreservesEveryAccountLocalDataAndHabitAlarms` | PASS `0` · L15 |
| `HabitReminderRecoveryTest` | `delayedHabitReminderIsDeliveredOnceAndCompletionCancelsIt` | FAIL `-2` · L89 |
| `HabitReminderActionsTest` | `initializationError` | FAIL `-2` · L141 |
| `NotificationReliabilityTest` | `migratingChannelsPreservesDisabledAndVibrationSettings` | PASS `0` · L156 |

### realme-build4-task-background-arm.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `ReminderFlowTest` | `prepareScreenOffReminder` | PASS `0` · L15 |

### realme-build4-task-background-complete.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `ReminderFlowTest` | `verifyDeliveredAndCompleteAction` | PASS `0` · L15 |

### realme-build4-task-reminder-actions.log

| Класс | Метод | Итог / код / строка |
| --- | --- | --- |
| `ReminderFlowTest` | `persistedCompletionSurvivesFreshProcess` | PASS `0` · L15 |
| `ReminderFlowTest` | `fiveRemindersPersistAndCancelTogether` | PASS `0` · L29 |
| `ReminderFlowTest` | `snoozeAndStaleVersionAreIdempotent` | PASS `0` · L43 |

## Разбор неуспешных состояний и оставшиеся проверки

| Источник / метод | Что подтверждено | Статус после среза |
| --- | --- | --- |
| API26 core initial / `everyOracleLocaleRendersItsOwnCompleteReferenceAndModal` | `assertExists` FAIL | Тот же метод API26 retest PASS; исходный FAIL сохранён. |
| Realme core / `calendarCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation` | Ожидался `ToggleableState=Off`; assertion FAIL | Повтор на следующем кандидате обязателен; не объявляется исправленным анализом. |
| Realme core / `everyOracleLocaleRendersItsOwnCompleteReferenceAndModal` | `assertExists` FAIL | API26 PASS не закрывает Realme. |
| API26 flows / recurrence + пять Projects методов | 6FAIL: selected-state, отсутствие узлов/scroll targets и touch injection | Полные имена и результаты выше; не классифицировать все как product или fixture без воспроизводителя. |
| API26 store preflight / `captureSixFinalScreensWithSyntheticData` | Fixture пытается создать привычку в прошлом: `Начало привычки не может быть в прошлом.` | 1 FAIL; шесть финальных store-кадров этим запуском не получены. |
| Realme language walkthrough | Assertion `Russian interface remnants` | 1 FAIL; 1013 states и findings разобраны ниже; исправления v5 в работе, RETEST NOT RUN здесь. |
| Reminder recovery / `delayedHabitReminderIsDeliveredOnceAndCompletionCancelsIt` | CAS/tombstone старого статического fixture ID: `Привычка изменилась. Откройте её заново.` | Fixture/root-ID исправление для следующего кандидата; этот запуск остаётся FAIL. |
| Reminder recovery / `HabitReminderActionsTest#initializationError` | Запрошен отсутствующий class; `Failed loading specified test class` | Инфраструктурный FAIL; не результат quick-action функции. Правильный class — `HabitReminderActionsFlowTest`. |
| Habit actions / `exactHabitQuickActionIsIdempotentStaleClickIsReadOnlyAndMeasuredActionNeedsInput` | `No compose hierarchies found in the app` | Завершённый FAIL fixture/activity lifecycle; требуемое действие не подтверждено этим запуском. |
| Habit actions / `notificationOpensTheStoredRecord` | `Unlock device manually before the notification-opening test` | FAIL предусловия устройства; открытие записи по notification требует повторной проверки. |

## Фоновые уведомления: что действительно подтверждено

Завершены с PASS: notification-arm — 3 метода; diagnostic verify — 1; habit arm — 1 / verify — 1; task prepare — 1 / complete — 1; task reminder actions — 3. Это 11 терминальных PASS в корректных отдельных фазах. Дополнительно recovery дал 2 PASS (`ExpiredSessionReminderTest` и migration уникальных каналов), а habit actions — 1 PASS snooze/quiet-hours/device-budget. Они перечислены по отдельным raw logs выше.

Армирование и последующая верификация процесса сохранены отдельными результатами; не считать один arm доказательством доставки. Проверки `verificationStartedAt` и durable state относятся к указанным методам, без расширения на reboot/force-stop/все OEM-сценарии.

Диагностика notification-arm: `importance=4`, `soundConfigured=true`, `vibration=true`, `DNDfilter=1`; при этом **notification volume=0**, `ringerMode=1`, `globalSoundConfigured=true`. Следовательно конфигурация звука/различие ресурсов проверены, **слышимый звук на Realme не подтверждён**. Из 3 диагностических status 0 дополнительные PASS не создавались.

## Реальная IME и ignored capture

[realme-build4-team-ime-proof.json](../../../outputs/v313/realme-build4-team-ime-proof.json): `imeBounds=[110,493][2268,1080]`, `inputBounds=Rect.fromLTRB(170.0, 241.0, 2208.0, 433.0)`, `inputFullHeight=192`, `viewportBounds=Rect.fromLTRB(170.0, 170.0, 2208.0, 433.0)`, `density=3`.

У поля bottom 433 px, верх фактической IME 493 px: этот зафиксированный input помещается выше клавиатуры с зазором 60 px и сохраняет высоту 192 px. Отдельный PASS `landscapeSystemKeyboardKeepsConditionsAndReportReachable` отражён в regression log. Это узкое доказательство данного экрана/состояния; оно не превращает opt-in `captureTeamReport` (`-4`) в выполненный capture и не подтверждает все окна приложения.

## Языковой обход: FAIL и точный объём

Источник: [realme-build4-translation-report.json](../../../outputs/v313/realme-build4-translation-report.json) и language-walkthrough log. **14 языков, 1013 состояний, 368 flagged Russian occurrences, 46 word-split occurrences (4 unique texts)**. Это количества наблюдений, не 368 уникальных доказанных untranslated строк. Метод завершился FAIL на Russian-remnants assertion; финальные assertions метода не объявляются пройденными.

| Locale | States | Russian findings |
| --- | ---: | ---: |
| `ru` | 74 | 0 |
| `en` | 71 | 10 |
| `el` | 74 | 15 |
| `de` | 74 | 15 |
| `fr` | 73 | 15 |
| `es` | 73 | 15 |
| `it` | 73 | 15 |
| `pt` | 73 | 15 |
| `pl` | 73 | 14 |
| `sr` | 73 | 107 |
| `uk` | 74 | 105 |
| `zh` | 66 | 14 |
| `tr` | 70 | 14 |
| `ja` | 72 | 14 |

| Word-split text (уникальная строка) | Наблюдений |
| --- | ---: |
| `Καθήκοντα για την ημέρα` | 10 |
| `7 · 30 Οκτωβρίου 2026` | 10 |
| `Gewohnheits-Tracker` | 8 |
| `Завдання для дня` | 18 |

В отчёте исключено 12 явно заданных synthetic user strings; это не автоматическое исключение любых кириллических слов. Правило audit: `Russian-only letters and known Russian source phrases; shared Cyrillic words are not language proof.`. Общая кириллица сербского/украинского сама по себе не доказывает русский остаток; findings требуют содержательной проверки и повторного обхода после исправлений.

## Граница результата

Исторические ошибки сборок и все 15 неуспешных instrumentation событий сохранены. Никакой FAIL не переименован в PASS из-за последующего исправления source, более позднего теста на другом устройстве или неверного class selector. Build4 не является итоговой успешной регрессией кандидата 5. Samsung, финальная подписанная установка/обновление, 16 KB runtime, Play delivery/предзапуск и все неупомянутые состояния этим отчётом не подтверждаются.
