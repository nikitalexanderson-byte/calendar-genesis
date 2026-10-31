# API35 build6 — точный незавершённый tail

Окончательный raw log содержит 284 terminal результата: **200 PASS / 24 FAIL / 60 SKIP**. Метод285 начат без результата;286–322 не начинались. Минимальный список без terminal результата — **38 методов:34 функциональных и4 capture**. Это дополнение к повтору уже упавших методов после исправлений; оно не отменяет24 исторических FAIL.

Каталог состоит из322 методов в source `2f32e3cb3764ed4e22b4b19c92f2fb6a6a936ba1`. Порядок: case-sensitive JVM class names, внутри класса JUnit4 DEFAULT — signed Java String.hashCode имени метода, затем имя. Все285 наблюдавшихся ordinal/class/method совпали точно, расхождений0. Чтение исходников и сопоставление не являются запуском тестов.

Машинные файлы: `outputs/v313/api35-build6-tail-catalog.json` и `outputs/v313/api35-build6-tail-groups.json`. В каталоге сохранены source paths/hashes/строки, все322 метода и точные execution states.

## Минимальные группы

| Группа | Методов | Состав |
| --- | ---: | --- |
| `workspace-functional` |18| Только оставшиеся функциональные методы SharedWorkspaceUiTest, включая начатый285. |
| `standalone-functional` |16| SleepPlan310Test2, TaskCompletion313Test9, TaskerDrawerTest1, TodayTrackers312Test2, WorkspaceDragHostTest2. |
| Optional capture |4| Отдельные flags/запуски, не смешивать со34 функциональными. Отсутствие запуска остаётся NOT RUN, а не assumption SKIP. |

У каждой группы есть готовая строка `classArgument` для runner `-e class`. Скрипт исполнения не запускался. Выбор устройства, установленного APK, runner и сохранение runtime доказательств остаются у root. Если root уже повторяет весь SharedWorkspaceUiTest42метода, группа18 входит в этот повтор; повторно добавлять её не нужно. PASS TaskCompletion на Realme не закрывает эти девять методов именно на API35.

```powershell
$genesisTailPlan = Get-Content -LiteralPath outputs/v313/api35-build6-tail-groups.json -Raw | ConvertFrom-Json
$genesisTailPlan.groups | Where-Object required | Format-List id,count,classArgument
```

## Все методы без terminal результата

| Ordinal | Состояние | Вид | Класс и метод |
| ---: | --- | --- | --- |
|285|STARTED, NO RESULT|functional|`SharedWorkspaceUiTest#customViewerSeesValuesIncludingArchivedDataWithoutEditableControls`|
|286|NOT STARTED|functional|`SharedWorkspaceUiTest#searchAndAppliedFiltersResetAndTaskCanBeCompletedWithoutDragging`|
|287|NOT STARTED|functional|`SharedWorkspaceUiTest#savedEstimatesRemainReadableWhenPlanningIsOffAndRoleIsViewer`|
|288|NOT STARTED|functional|`SharedWorkspaceUiTest#projectsStartCollapsedThenSaveExpansionAndBoardChanges`|
|289|NOT STARTED|functional|`SharedWorkspaceUiTest#projectMenuOpensTheNativeAutomationLibraryWithoutChangingTasks`|
|290|NOT STARTED|functional|`SharedWorkspaceUiTest#customCreationHidesSacredDateControlsAndSavesGregorianDatesWhenFeaturesAreOff`|
|291|NOT STARTED|capture|`SharedWorkspaceUiTest#captureAffairsEntryProjectAndTaskInBothThemes`|
|292|NOT STARTED|functional|`SharedWorkspaceUiTest#estimateCardDistinguishesZeroClearAndNoopWithoutSendingItsSibling`|
|293|NOT STARTED|capture|`SharedWorkspaceUiTest#captureOriginalCustomCreation`|
|294|NOT STARTED|functional|`SharedWorkspaceUiTest#customReadOnlyDatesUseGregorianLabelsWhenSacredFeaturesAreOff`|
|295|NOT STARTED|functional|`SharedWorkspaceUiTest#customCreationSurvivesActivityStateAndCatalogChangesWithoutLosingOwnText`|
|296|NOT STARTED|functional|`SharedWorkspaceUiTest#newTaskUsesExplicitCreateAndViewerCannotEditOrComplete`|
|297|NOT STARTED|functional|`SharedWorkspaceUiTest#explicitRetryKeepsTheSameEstimateBodyAfterAnotherRefusal`|
|298|NOT STARTED|capture|`SharedWorkspaceUiTest#captureOriginalCustomTask`|
|299|NOT STARTED|functional|`SharedWorkspaceUiTest#customCreationHonorsExplicitEditPermissionBeforeOpeningTheForm`|
|300|NOT STARTED|functional|`SharedWorkspaceUiTest#archivedTaskValuesRemainReadOnlyForAnEditor`|
|301|NOT STARTED|functional|`SharedWorkspaceUiTest#viewerHasTaskDetailsWithoutWriteActions`|
|302|NOT STARTED|functional|`SharedWorkspaceUiTest#projectPlanningMenuOpensTheExistingTaskCard`|
|303|NOT STARTED|functional|`SharedWorkspaceUiTest#customCreationRequiresZeroAndFalseAndKeepsInputVisibleAfterServerRejection`|
|304|NOT STARTED|functional|`SharedWorkspaceUiTest#failedSaveKeepsDraftAndSaveActionThenRetryAndBackRestoreTheProject`|
|305|NOT STARTED|capture|`SharedWorkspaceUiTest#captureCustomTaskFields`|
|306|NOT STARTED|functional|`SharedWorkspaceUiTest#customTaskSavesTypedValuesInOnePartialPatchWithoutReplacingArchive`|
|307|NOT STARTED|functional|`SleepPlan310Test#sleepTimesAndScoringChoicesFitSymmetricRows`|
|308|NOT STARTED|functional|`SleepPlan310Test#moodDateUsesTheSelectedCalendarWithoutChangingTheDay`|
|309|NOT STARTED|functional|`TaskCompletion313Test#staleAndDeletedCheckboxSnapshotsNeverOverwriteOrResurrectTasks`|
|310|NOT STARTED|functional|`TaskCompletion313Test#cancellationDoesNotBecomeASaveErrorAndReleasesTheCompletionGuard`|
|311|NOT STARTED|functional|`TaskCompletion313Test#importedInvalidEndMetadataCompletesOneOccurrenceAndPreservesTheRest`|
|312|NOT STARTED|functional|`TaskCompletion313Test#rapidTapsShareOnePendingWriteWhileDifferentTasksCanComplete`|
|313|NOT STARTED|functional|`TaskCompletion313Test#todayCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation`|
|314|NOT STARTED|functional|`TaskCompletion313Test#calendarCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation`|
|315|NOT STARTED|functional|`TaskCompletion313Test#invalidOccurrenceRequestsReportErrorsWithoutMutatingTheSeriesOrBlockingRetry`|
|316|NOT STARTED|functional|`TaskCompletion313Test#affairsCheckboxesPersistOrdinaryAndSeriesCompletionAndUndoAcrossRecreation`|
|317|NOT STARTED|functional|`TaskCompletion313Test#differentSeriesOccurrencesNeverSilentlyShareOnePendingRequest`|
|318|NOT STARTED|functional|`TaskerDrawerTest#everyLanguageFitsAndRefreshBelongsToAccount`|
|319|NOT STARTED|functional|`TodayTrackers312Test#staleObservationCannotOverwriteSavedData`|
|320|NOT STARTED|functional|`TodayTrackers312Test#actualTodayMoodSleepAndAbstinencePersistThroughTheirEditors`|
|321|NOT STARTED|functional|`WorkspaceDragHostTest#cancellationReleasesTheSourceWithoutCommittingAMove`|
|322|NOT STARTED|functional|`WorkspaceDragHostTest#movingCardOutOfItsSourceBoardFinishesOnceWithoutDispatchingToDetachedNodes`|

## Capture flags

- `captureAffairsEntryProjectAndTaskInBothThemes`: собственного opt-in gate нет; по умолчанию phase=before, дополнительные `genesisCapturePhase`, `genesisPlanningFixture`, `genesisPendingFixture` меняют постановку.
- `captureOriginalCustomCreation`: `genesisCustomCreateBaseline=true`.
- `captureOriginalCustomTask`: `genesisCustomBaseline=true`.
- `captureCustomTaskFields`: `genesisCustomCapture=true`; locale arguments задаются отдельно.

Эти четыре метода не исполнялись в исходном batch. Статус визуальной приёмки, размеров, тем и всех контролов учитывается отдельно; список capture методов не закрывает его.

Данные root-stop описывают более ранний срез280; перед остановкой raw log дописал281–284. В качестве окончательного числа событий используется raw log. Отсутствует runner final, поэтому ни322 завершённых случаев, ни полный suite PASS не заявляются.
