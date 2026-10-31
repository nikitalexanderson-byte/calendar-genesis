# Genesis Tasker 3.1.3 — build7: проверенные результаты и открытые условия

Срез **30 октября 2026, 15:16 +03:00**. Frozen debug/test candidate7 — source `2f32e3cb3764ed4e22b4b19c92f2fb6a6a936ba1`. Это отчёт о конкретных запусках, не итоговый PASS приложения или разрешение выпуска. После freeze7 изменены основной код и три test fixtures; для source8 отдельно подтверждены только unit tests ниже, полный build/runtime ещё требуется. Deploy3.1.3, Google Play Alpha120 и замена listing assets этим отчётом не подтверждены.

Raw результаты и SHA-256: [build6-evidence-index.json](../../../outputs/v313/build6-evidence-index.json), отдельный раздел `build7_context`. Build6 totals/FAIL/SKIP/NO_RESULT сохранены отдельно в [историческом отчёте](device-build6-validation.md). Индекс выполняет только чтение локальных артефактов; APK source определяется frozen manifest, а не текущим HEAD.

## Frozen сборка и unit tests

| Доказательство | Результат | Граница |
| --- | --- | --- |
| `android-build7-serial.log` | BUILD FAILED,24s | Историческая ошибка вызова/quoting сохранена. |
| `android-build7-serial-quoted.log` | BUILD SUCCESSFUL,17m23s | Успешная компиляция source7, не subsequent source edits. |
| `android-build7-https-fixture.log` | BUILD SUCCESSFUL,6m52s | Отдельный HTTPS debug/test package. |
| `candidate7-unit-results/`, `build7-unit-evidence.json` | **157 suites,895 executed tests,0failures,0errors,0skips** | Frozen actual XML; более поздние run directories не подменяют этот результат. |
| `debug-candidate7/manifest.json` | Debug APK SHA-256 `043a824e8888d9505652672a10aa1dddb4a192c608437d7ca26c9a6493bfd438`; test APK `a0581cf7e616fd2323aa1ebfe42e584c5ce3c545355fecff46e4ecd9b3361223` | Manifest/source7/JUnit metadata согласованы; это debug artifacts. |

Статические проверки подписанных APK/AAB candidate7 того же source — [signed-candidate-validation.md](signed-candidate-validation.md). Package/version/certificate/manifests/R8/ELF/ZIP не подтверждают запуск подписанного APK, Play-generated splits или финальный код после7.

Поздний source8 `7883c12081895eddf1431a94315cf1aebd67324e`: root сохранил actual157 XML в `candidate8-unit-results/`, **898executed/0failures/0errors/0skips**, включая `SharedBulkQueryTest`10/10 с тремя новыми cancellation/account guards. Это отдельный unit-only PASS; serial build ещё находился на lintAnalyze. Полный build, targeted UI, signed/runtime source8 не признаются завершёнными из этого факта. Индекс хранит их в `candidate8_unit_followup`, отдельно от6/7.

## Instrumentation: каждый запуск отдельно

Все журналы — в `outputs/v313/`. Assumption skips подсчитаны отдельно; успешный финальный `INSTRUMENTATION_CODE:-1` сам по себе не означает FAIL.

| Журнал | PASS | FAIL | SKIP | Итог |
| --- | ---: | ---: | ---: | --- |
| `realme-build7-locales.log` | 2 | 0 | 0 | Завершён,2/2. |
| `realme-build7-release313-dark-font130.log` | 14 | 0 | 0 | Завершён,14/14. |
| `realme-build7-background-arm.log` | 1 | 0 | 0 | Отдельная arm фаза перед process kill. |
| `realme-build7-background-verify.log` | 1 | 0 | 0 | Отдельная verify фаза с delivery-before-relaunch assertion. |
| `api26-build7-bulk-first.log` | 1 | 0 | 0 | Exact bulk chooser, первый целевой запуск после boot. |
| `api26-build7-https-targets.log` | 6 | 1 | 0 | Завершён,7/7; Query Configure FAIL. |
| `api26-build7-mindmaps.log` | 1 | 1 | 0 | Завершён,2/2; task/PDF method остановлен до PDF. |
| `api26-build7-store-ru.log` | 1 | 0 | 0 | Только capture execution; acceptance/upload отдельно. |
| `api26-build7-store-en.log` | 1 | 0 | 0 | Только capture execution; acceptance/upload отдельно. |
| `api35-build7-planning-reports.log` | 23 | 1 | 2 | Завершён,26/26;2 optional captures. |
| `api35-build7-workspace-tail.log` | 44 | 10 | 5 | Завершён,59/59;5 optional captures. |
| `api35-build7-doze-arm.log` | 1 | 0 | 0 | Arm перед kill/screen-off/forced deep idle. |
| `api35-build7-doze-verify.log` | 1 | 0 | 0 | Verify с cutoff, сохранённым до unforce. |

API35 workspace-tail включает `SharedWorkspaceUiTest`: **28PASS/9FAIL/5captureSKIP**, exact `SharedBulkUiTest`:1PASS, `SleepPlan310Test`:2PASS, `TaskCompletion313Test`:9PASS, `TodayTrackers312Test`:2PASS, `WorkspaceDragHostTest`:2PASS, `TaskerDrawerTest`:1FAIL. Поэтому общий результат **44PASS**, а не49.

Каждый из38 методов без terminal результата в build6 сопоставлен с7 по точной паре class/method: **27PASS/8FAIL/3captureSKIP**, отсутствующих совпадений0. Среди34 functional —26PASS/8FAIL; среди4 capture —1PASS/3SKIP. Это отдельный поздний результат; original build6 NO_RESULT не переписаны.

## Подтверждённые исправления

- Realme translation report: **1097 состояний,14 completedLanguages,traversalComplete=true,failure=null,russianFindings=0,wordSplitFindings=0**. [Файл](../../../outputs/v313/realme-build7-translation-report.json). Это обход записанных fixture состояний с фактическими настройками прогона; он не заменяет все размеры, IME и динамические строки.
- Realme `Release313UiTest`14/14PASS в тёмной схеме/font1.3: заданные assertions календарной навигации, текста/целей касания, drawer, созданных trackers, таймера/воздержания, Ганта и Oracle. Отдельные9 completion методов PASS на API35 дополняют ранее подтверждённые9/9 на Realme; Samsung и финальный signed runtime остаются отдельными.
- API35 `SharedPlanningLifecycleUiTest`2/2 и `SharedPlanningUiTest.assignmentUsesExistingTaskPatchAndKeepsZeroAndHours`1/1PASS после исправления настоящих selector/lazy/readiness шагов. Значения0/2.5, patch, civil date/calendar/year, state/revision/receipt/draft assertions сохранены.
- `SharedSprintReportUiTest`:11PASS/1optional captureSKIP; `SharedWorkflowUiTest`:9PASS/1optional captureSKIP. Это завершённые functional методы этих проходов.
- На настоящем изолированном HTTPS API26 три прежних `NativePlanningHttpsIntegrationTest` failures теперь3/3PASS; `SharedGSuiteHttpsUiTest.parentWorkflowBacklogSprintStartCarryoverAndHistoricalSourcesUseTheSameTasks`1/1PASS. Подтверждён изменённый report protocol в этой fixture; live Google этим не проверен.
- `SharedTemplatesUiTest.thePrimaryActionRemainsReachableWithTheKeyboardOpen`PASS с required IME opt-in и `aFiftyFirstDependencyHasANameAndCannotDiscardTheProtectedGraph`PASS. Исходный build6 dep:51 UI/journal разрыв сохранён; более поздний PASS без установленной причины не доказывает устранение исходной гонки.
- Exact bulk chooser PASS отдельно на API26 и в API35. Исходный60s Compose/Espresso idle FAIL build6 сохранён; он не объявлен решённым только из-за успешных повторов.

## Оставшиеся FAIL и проверяемые изменения после7

| Сценарий | Что доказано | Следующий обязательный результат |
| --- | --- | --- |
| Шесть Workspace task-creation методов | Тест нажимал общую кнопку «Создать», которая теперь открывает меню, и сразу искал отсутствующее поле. Main создаёт форму только через `shared-create-task-option`. | Test helper выполняет оба действия и проверяет displayed/enabled поля. Все value/revision/persistence assertions сохранены. Новый APK/runtime ещё требуется. |
| Workspace search | `shared-task-search` существует только после `shared-task-search-open`; прежний тест не раскрывал dock. | Реально раскрыть поиск; прежние query/filter/reset/completion assertions сохранены. |
| Workspace expansion/board | После открытия пространства меню команды имеет tag `shared-space-team`, прежний `shared-actions` там отсутствует. | Использовать фактическое меню и сохранить все expanded/board expectedRevision/title assertions. |
| Workspace explicit edit permission | У owner с `editTasks=false` разрешены контейнеры; общая кнопка создания закономерно enabled, а task/event/meeting options disabled. | Проверяются все три disabled options, enabled project option, отсутствие task-form и0 createAttempts. Запрет записи не ослаблен. |
| TaskerDrawer | Тест ожидал удалённый `app-account-status`, три строки и refresh справа. Согласованный UI содержит две строки и действия ниже. | Ровно2 строки, обе single-line/no clipping для14языков; порядок, refresh внутри `drawer-actions` ниже строк,48dp и14 callbacks. Следующий runtime требуется. |
| Mindmaps task/PDF | Save footer fix сработал и ordinary-task title roundtrip прошёл; прежний contentDescription «Карта» отсутствует. Main использует `mindmap-mode-toggle`; node dialog остаётся открыт после редактирования задачи. | Test закрывает node dialog, реально переключает структура→карта, проверяет оба labels/canvas. Прежние1task/delete/reopen/1000-node PDF assertions сохранены и пока не исполнены до конца. |
| QueryBulk Configure | Passive JSON показывает отмену input-save `LeftCompositionCancellationException`, затем repeated `PLANNING_DRAFT_CHANGED` со stamp=null при уже записанном input journal. Это product race в postcommit/cancellation/CAS path. | Root/Android исправляют source; before-fix deterministic evidence `candidate8-query-before-fix.xml` сохраняется. Не ожидать autosave в тесте перед Configure и не ослаблять preview/apply assertions. Candidate8 PASS не заявлен. |
| TeamReport landscape IME | `SharedTeamReportUiTest.landscapeSystemKeyboardKeepsConditionsAndReportReachable`FAIL с10s readiness timeout. | Root/Android разбирают реальную IME/readiness и полные границы поля/кнопки; полный ввод должен помещаться. Следующий runtime требуется. |

Три test-only файла после freeze7: `SharedWorkspaceUiTest.kt`, `TaskerDrawerTest.kt`, `MindmapsIntegrationTest.kt`; `git diff --check`PASS. Этот агент не менял main, не запускал Gradle/ADB и не выполнял Console/deploy. Их current hashes/source mismatch перечислены в индексе; compile/runtime7 на новые edits не переносится.

## Фоновые напоминания: правильные независимые фазы

На Realme отдельные `BackgroundReminderTest.armAccountAlarmAndPersistOfflinePreferences` и `verifyDeliveryAfterProcessDeathAndDurableLocalData` завершились1/1PASS каждая, с `am kill` между ними. `realme-build7-background-kill.json` подтверждает отсутствие PID выделенного debug package и `mainAppUntouched=true`. Оригинальный verify command передал `verificationStartedAt`; source assertion требует `expectedAt <= notification.postTime < verificationStartedAt`. Проверены также durable synthetic habit, настройки, pending preferences и outbox. Это реальное OS notification evidence после process death, не смешанный batch с verify до arm.

На API35 arm1/1PASS → kill → battery unplug → screen sleep → `force-idle deep`; raw arm proof содержит `Now forced in to deep idle mode`. Перед unforce root сохранил **deepState=IDLE,cutoffBeforeUnforce=1793361441598**, затем выполнил unforce/battery reset/wakeup и отдельный verify1/1PASS с этим более ранним cutoff. Assertion `notification.postTime < cutoff` исключает доставку только после выхода из Doze или запуска verifier. Нельзя выводить этот порядок только из имени лога: он отдельно подтверждён original execution `exec-701f08cd-3c92-4868-bbb1-ed66e0e1fe56`, exit0, точным аргументом и stdout в [historical host transcript](../../../outputs/v313/build7-reminder-host-history.txt). Root сообщил о завершённом восстановлении battery/idle/screen состояния.

Оба прохода используют изолированный `ru.genesis.calendar.v313.debug` и synthetic scope. Это не signed main, не force-stop/reboot, не Samsung и не проверка физической слышимости. Они не закрывают широкие REM rows или всю OEM матрицу.

## Подписанный Realme upgrade: узкие факты

Root выполнил **119 → подписанный candidate6/120**, source `225cf634c3545a486c50595e0344798cdb426ea6`, APK SHA-256 `d2fecf21ac478746a3bd4c296c4f9f7d95e15d1936d10db9a6f4acd91a9cea9f`, с прежним package/certificate и без clear/uninstall. Следующий кандидат будет отдельным обновлением уже установленной120; статический candidate7 не считается прямым119→7 runtime тестом.

Сохранённые root UI witnesses в `outputs/v313/`:

| Файл | Узкое наблюдение root после обновления |
| --- | --- |
| `realme-live-upgraded-offline-task-fields120.xml` | Открылись поля созданной на119 offline задачи; данные сохранены. |
| `realme-live-preserved-online-task-close120.xml` | Доступна ранее синхронизированная отдельная задача; это не доказательство свежей server синхронизации. |
| `realme-live-preserved-diary-open120.xml` | Открылась запись дневника с119 с сохранённым зашифрованным содержимым; его текст в QA документы не копируется. |
| `realme-live-preserved-habit-scroll120.xml` | Ранее созданная привычка отображается с отметкой выполнения и10points. Это не общая проверка всех reward replay. |

Проверялись отдельные уникальные synthetic records; их значения и любые личные строки не публикуются. Это UI witnesses сохранности, не отдельный аудит ciphertext/ключей/session/outbox. Индекс сохраняет только SHA-256/размер этих файлов, не содержимое. Wi-Fi/mobile data восстановлены в1. Ранний `UnknownHost` был из shell UID и **не доказывал отсутствия интернета на всём устройстве**; пользователь подтвердил рабочий browser internet.

Новый root snapshot `realme-live-sync-recheck-main120.xml/.png` после перезапуска signed main показывает account synchronized, без queue issue/error. Это **принятый UI статус**, пока не доказательство server duplicate count или полного web↔native roundtrip. Ранее наблюдавшаяся очередь не объявляется текущей ошибкой только на основании старого shell DNS probe.

Root отдельно подтвердил dedicated test account в браузере Realme; private profile/credentials не копируются в QA. В `realme-live-phone-web-current120.xml` две контролируемые task buttons видны ровно по одному разу; привычка и её исходное описание присутствуют. Для собственной начальной задачи root открыл editor, сохранил описание с119, добавил тестовое изменение и нажал Save через реальный UI. Witnesses: `realme-live-phone-web-edit-own-task120.xml`, `realme-live-phone-web-description-changed120.xml`, `realme-live-phone-web-task-saved120.xml`. Этот этап подтверждает **phone-web read/save**, а не server row duplicate count; readback изменения в native editor ещё выполнялся. Desktop main IAB не менялся.

## Условия, которые ещё не закрыты

Все193 mandatory статуса матрицы остаются прежними:192NOT RUN/1BLOCKED.242строки включают32 добавленных узких historical RUN records; это не финальная приёмка. [Release checklist](release-checklist.md) отражает частичные факты отдельно.

Требуются полный build и реальные UI повторы source8; все ширины/темы/font/IME; Samsung checkbox/фон; оставшиеся reminder сценарии, слышимость/OEM/reboot; полный signed update/runtime/data preservation; live Google и завершённый двухклиентный readback/duplicate-count; performance/ANR; конечные APK/AAB/Play-generated runtime. Выполненные background/Doze фазы выше не повторяются вместо чтения результата. Финальные screenshots RU/EN должны соответствовать конечному проверенному коду и быть действительно сохранены в Console. Alpha upload/availability, pre-launch, штатный deploy, public health/meta/APK hash остаются отдельными действиями. Production console blocker не обходится.

SSH этим агентом не использовался. Production-БД и private конфигурация не читались/не менялись.
