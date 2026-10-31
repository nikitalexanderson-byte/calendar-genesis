# Genesis Tasker 3.1.3 — build5: историческая проверка журналов

Фиксированный срез: **2026-10-30 09:11:34.348134 UTC**. Этот документ описывает build5, включая неуспешные попытки и завершённые повторы. Он **не является финальной приёмкой 3.1.3, отчётом build6 или разрешением выпуска**.

Основной источник — [candidate5-method-status-index.json](../../../outputs/v313/candidate5-method-status-index.json), SHA-256 `0aaeacc389d494c145f04ba6a6b90c7b861327459e77072bddd2f26f9ee2041b`. Независимый повторный подсчёт: [candidate5-method-status-validation.json](../../../outputs/v313/candidate5-method-status-validation.json). Читаемое сопоставление с матрицей: [candidate5-evidence-mapping.md](../../../outputs/v313/candidate5-evidence-mapping.md). Индекс фиксирует размеры, SHA-256, строки результатов, stack/reason, незавершённые методы и историю повторов; исходные журналы не переписаны.

## Область и идентичность исходников

В срез входят **17** файлов `outputs/v313/**/*build5*.log`: 5 журналов Gradle, 10 instrumentation-прогонов, 1 ошибка запуска instrumentation и 1 диагностический crash log. Прогоны относятся к эмуляторам API26/API35 и изолированным QA fixtures. Новая аппаратная приёмка Realme/Samsung этим набором не подтверждается; результаты build4 сохранены в [отдельном отчёте](device-build4-validation.md).

Подписанные APK/AAB candidate5 относятся к source `597f38e8e9b4912470a0ab9fc96a01a7ebeeead5`, workflow [41017909881](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41017909881). Их статические проверки описаны в [signed-candidate-validation.md](signed-candidate-validation.md). Имена локальных журналов не доказывают SHA установленного APK или состав test host.

HEAD при создании индекса — `153da56adabd0a40c236d9316e9e1dfe21720576`; на тот момент были незакоммиченные изменения fixtures и `WholeWordText.kt`. Поэтому найденные индексом исходные файлы, SHA и строки всех 110 методов характеризуют **source snapshot**, а не автоматически исторический test APK.

Следующий source freeze — `225cf634c3545a486c50595e0344798cdb426ea6`. Сравнение release scope с подписанным source candidate5 показывает только `android/app/src/main/java/ru/genesis/calendar/ui/WholeWordText.kt`: аварийное уменьшение текста для сохранения целых слов. Исправленные fixtures входят в новый freeze. Существующие результаты build5 не проверяют это новое поведение автоматически. Root запустил [trial6 41034673895](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41034673895); его артефакты и локальный build6 этим проходом не скачивались и не проверялись.

## Подсчёт результатов

- Получено **136 терминальных событий: 123 PASS / 9 FAIL / 4 SKIP**, 110 различных пар class/method. Повторы одного метода в разных прогонах сохранены; это не 136 уникальных сценариев приёмки.
- `INSTRUMENTATION_STATUS_CODE: 1` — начало метода; `0` — PASS; `-2` — FAIL; `-4` в этих журналах — `AssumptionViolatedException`, пропуск. Четыре пропуска не включены в PASS.
- Независимый подсчёт исходных строк дал 139 начал, 123 статуса `0`, 9 статусов `-2`, 4 статуса `-4` и один диагностический `-1` без class/method. Последний означает невозможность запуска instrumentation, не результат тела теста.
- Сохранены **3 начала без терминального результата**. Финальный `INSTRUMENTATION_CODE` и статус отдельного метода учитываются раздельно. Отсутствие финала runner не превращает частично успешный набор в завершённый PASS.
- После создания индекса все 17 журналов повторно захешированы: изменений не обнаружено. Все 110 определений методов найдены в исходниках на момент среза.

Завершённые повторы **API35 13/13** и **API26 portable 3/3**, приведённые ниже, уже учтены в срезе 09:11:34. Их нельзя повторно прибавлять к 123 PASS.

## Сборки

| Журнал | Зафиксированный результат | Область |
| --- | --- | --- |
| [android-build5.log](../../../outputs/v313/android-build5.log) | BUILD SUCCESSFUL, 12m 8s | Завершён локальный Gradle-запуск, включая `lintRelease`; не свидетельство установки подписанного APK. |
| [android-build5-fixture2.log](../../../outputs/v313/android-build5-fixture2.log) | BUILD SUCCESSFUL, 3m 22s | Сборка уточнённых fixtures. |
| [android-build5-test-final.log](../../../outputs/v313/android-build5-test-final.log) | BUILD SUCCESSFUL, 30s | Сборка androidTest, не самостоятельный device PASS. |
| [android-build5-test-portable.log](../../../outputs/v313/android-build5-test-portable.log) | BUILD FAILED, 6s | Защитная проверка `Debug application ID must end in .debug and remain separate from production`. Первоначальная ошибка сохранена. |
| [android-build5-test-portable-retry.log](../../../outputs/v313/android-build5-test-portable-retry.log) | BUILD SUCCESSFUL, 45s | Исправленный повтор сборки androidTest; предыдущий FAIL не удалён. |

Точный счёт unit tests из JUnit XML этим индексом не пересчитывался. Успех Gradle не заменяет отдельную классификацию skips, unit, instrumentation и runtime-проверок. Web-файлы с именами `*candidate5*.log` не входят в шаблон `*build5*.log` и не прибавлены к Android-событиям.

## Instrumentation: каждый прогон

| Журнал | PASS | FAIL | SKIP | Незавершённые методы | Финал / состояние |
| --- | ---: | ---: | ---: | ---: | --- |
| [api26-build5-core-locales.log](../../../outputs/v313/api26-build5-core-locales.log) | 23 | 1 | 0 | 0 | `shortMsg=Process crashed.`, runner code 0; прерывание процесса на методе 24. |
| [api26-build5-locale-single-root.log](../../../outputs/v313/api26-build5-locale-single-root.log) | 1 | 1 | 0 | 0 | Завершён, 2 tests / 1 failure, 330.425s. |
| [api26-build5-locales-drag-final.log](../../../outputs/v313/api26-build5-locales-drag-final.log) | 0 | 3 | 0 | 0 | Завершён, 3 tests / 3 failures, 17.502s. |
| [api26-build5-locales-drag-portable.log](../../../outputs/v313/api26-build5-locales-drag-portable.log) | 3 | 0 | 0 | 0 | `OK (3 tests)`, 461.978s. |
| [api26-build5-project-flows-capture.log](../../../outputs/v313/api26-build5-project-flows-capture.log) | 7 | 1 | 0 | 0 | Завершён, 8 tests / 1 failure, 46.322s. |
| [api26-build5-reminder-recovery-actions.log](../../../outputs/v313/api26-build5-reminder-recovery-actions.log) | 3 | 1 | 0 | 0 | Завершён, 4 tests / 1 failure, 27.139s. |
| [api35-build5-release313-hostgl-installed.log](../../../outputs/v313/api35-build5-release313-hostgl-installed.log) | 13 | 0 | 0 | 0 | `OK (13 tests)`, 67.02s. |
| [api35-build5-release313-swangle.log](../../../outputs/v313/api35-build5-release313-swangle.log) | 2 | 0 | 0 | 1 | Нет финала runner; Windows QEMU host crash. |
| [api35-build5-ui-full.log](../../../outputs/v313/api35-build5-ui-full.log) | 1 | 0 | 0 | 1 | Нет финала runner; Windows QEMU host crash. |
| [api35-build5-ui-software.log](../../../outputs/v313/api35-build5-ui-software.log) | 70 | 2 | 4 | 1 | Нет финала runner; Windows QEMU host crash. |
| **Всего** | **123** | **9** | **4** | **3** | История событий, не полная приёмка. |

[api35-build5-release313-hostgl.log](../../../outputs/v313/api35-build5-release313-hostgl.log) отдельно содержит `Unable to find instrumentation info` / `INSTRUMENTATION_FAILED`, строка 3 — classless status `-1`. Ни один метод в этой попытке не выполнен; она исключена из 136 событий, но остаётся в индексе.

### Девять исторических FAIL

Общий префикс классов — `ru.genesis.calendar.`. `L` — строка терминального статуса исходного журнала. Полные стеки ошибок находятся в raw logs; поле reason индекса ограничено 4000 символами на событие.

| Прогон / строка | Класс и метод | Зафиксированная причина / последующий статус |
| --- | --- | --- |
| core-locales, L446 | `NativeTranslationWalkthroughTest.visitMainScreensInEverySupportedLanguage` | Compose detach lifecycle: `Must run runDetachLifecycle() once after runAttachLifecycle() and before markAsDetached()`. Отдельный [crash log](../../../outputs/v313/api26-build5-crash.log) называет QA `TestWorkspaceActivity`. Это сохранённый crash тестового процесса; он не доказывает повтор пользовательского вылета на галочке. |
| locale-single-root, L50 | `NativeTranslationWalkthroughTest.visitMainScreensInEverySupportedLanguage` | Assertion `Russian interface remnants`: украинская общая кириллица и синтетические пользовательские заголовки в китайском шаблоне. Позднее portable-проверка завершилась PASS; ранний assertion сохранён. |
| locales-drag-final, L36 | `NativeTranslationWalkthroughTest.dynamicCopyKeepsUserTitlesAndLocaleDatesLiteral` | API26 `PatternSyntaxException: U_ILLEGAL_ARGUMENT_ERROR` в `\p{IsCyrillic}` test helper. Последующий portable-повтор PASS. |
| locales-drag-final, L71 | `NativeTranslationWalkthroughTest.visitMainScreensInEverySupportedLanguage` | Та же несовместимая regex в helper. Последующий portable-повтор PASS. |
| project-flows-capture, L68 | `ProjectsFlowTest.draggingNearBottomAutoScrollsProjectDestinations` | `ComposeTimeoutException`, 10000ms. Последующий portable-повтор PASS с окончательными bounds и проверкой projectId. |
| locales-drag-final, L97 | `ProjectsFlowTest.draggingNearBottomAutoScrollsProjectDestinations` | Повторный `ComposeTimeoutException`, 10000ms. Сохранён отдельно от первого FAIL и последующего PASS. |
| reminder-recovery-actions, L88 | `ReminderFlowTest.notificationOpensTheStoredRecord` | Assertion поиска записи под модальным окном release notes. Диагностика и исправление fixture описаны ниже; retest после freeze225 ещё нужен. |
| ui-software, L445 | `ui.HabitFeedback310Test.previewDoesNotWriteProgressAndNotificationTestUsesTheRealAndroidChannel` | `ComposeTimeoutException`, 5000ms. Успешный повтор этого метода данным snapshot не подтверждён. |
| ui-software, L831 | `ui.MobileReview4Test.exactOfflineCircleSupportsZoomSelectionAndOpeningTheCivilDate` | `The SVG must be painted, not only present in the DOM: 5 colors`. Успешный повтор данным snapshot не подтверждён; сбой QEMU не стирает уже полученный assertion. |

### Четыре пропуска

Все четыре находятся в `api35-build5-ui-software.log` и имеют `-4` / `AssumptionViolatedException`:

| Строка | Класс и метод | Причина |
| --- | --- | --- |
| L219 | `ui.DailyAdviceUiTest.captureNativeAdviceAndSettings` | Opt-in capture assumption не выполнена. |
| L536 | `ui.HabitPracticeUiTest.capturePracticeWindowAndStateChoice` | Opt-in capture assumption не выполнена. |
| L731 | `ui.MindmapsIntegrationTest.nativeTaskReferenceRoundtripAndPdf` | Требуется `scripts/mindmaps` fixture и reverse-порт 4341. |
| L760 | `ui.MindmapsIntegrationTest.offlineRetryConflictAndRestartKeepEveryDraft` | Та же неактивная HTTP fixture. |

Эти сценарии не прошли проверку тела теста и не считаются PASS.

## Завершённые повторы и границы доказательств

**API26 portable — 3/3 PASS.** Проверены динамический текст с пользовательскими заголовками, проход языков и автопрокрутка назначения проекта. [translation-portable-report.json](../../../outputs/v313/api26-build5-translation-portable-report.json) содержит **994 состояния**, все 14 языков `ru/en/el/de/fr/es/it/pt/pl/sr/uk/zh/tr/ja`, `traversalComplete=true`, `russianFindings=[]`, `wordSplitFindings=[]`, `failure=null`; последний checkpoint — `ja/calendar/reference-sacred/close`.

Этот нулевой результат относится к записанным состояниям fixture на API26. Он не доказывает отсутствие разрывов во всех возможных пользовательских строках, на всех экранах, размерах, масштабах шрифта или в новом `WholeWordText` freeze225.

[projects-auto-scroll-final.json](../../../outputs/v313/api26-build5-projects-auto-scroll-final.json) фиксирует viewport `(0,252)-(1080,1794)`, полностью видимый destination `(42,1529)-(1038,1784)`, размер **996 × 255 px**, scroll `1155 → 10190`, release scroll `10253`, drop point `(540,1593.5)`. Успешный метод также проверяет projectId после drop. Ранний [auto-scroll-proof.json](../../../outputs/v313/api26-build5-projects-auto-scroll-proof.json) сохранён как отдельное предшествующее доказательство, а не заменяет окончательные bounds.

**API35 host GL — 13/13 PASS.** `Release313UiTest` завершён полностью. Методы проверяют начало месяца и переход к выбранному солнечному дню; свёрнутые описания года; полный текст месяца и положение «Сегодня»; drawer; настроение и видимость созданных трекеров; таймер; воздержание; ряд масштабов Ганта; трёхкарточный расклад и ориентацию; выбранные узкие подписи; локализованные описания Оракула и олимпийские символы. Это fixture-проверки перечисленных методов, не полная приёмка каждого функционального раздела.

**Галочки — девять методов API26 PASS.** `TaskCompletion313Test` в core-locales завершил проверки Today/Calendar/«Дела», обычной задачи и серии, undo/recreation, быстрых повторов, разных occurrences, stale/deleted snapshots, cancellation и ошибочных metadata/запросов. Последующий lifecycle crash локализационного теста не отменяет эти терминальные PASS, но весь core-locales suite остаётся аварийно завершённым. Проверка подписанного релиза на Samsung/Realme этим не закрыта.

**Напоминания — три метода PASS, один FAIL.** Завершены recovery доставки привычки, idempotent/stale quick action и snooze с quiet hours/device budget. Открытие записи требует отдельного повторного прогона после исправления fixture.

## Уведомление: реальное окно «Что нового» перекрыло assertion

Диагностические [PNG](../../../outputs/v313/api26-build5-notification-open-failure.png) и [XML](../../../outputs/v313/api26-build5-notification-open-failure.xml) просмотрены отдельно после фиксации индекса. Скриншот показывает редактор задачи за открытым окном **«Что нового · 3.1.3»**. XML подтверждает заголовок этого окна и реальные действия «Закрыть» / **«Понятно»**. Следовательно, поиск текста записи выполнялся, пока модальное окно закрывало её от теста; исходный FAIL не является доказательством неправильного destination уведомления.

В source freeze `225cf634` `ReminderFlowTest.kt:112–115` ожидает настоящий заголовок release notes, находит включённую кнопку «Понятно», проверяет её наличие и нажимает её перед поиском точной записи и «Изменить задачу». Это взаимодействие с реальным модальным окном. Повтор данного сценария на новом APK **не подтверждён этим отчётом**; прежний статус остаётся FAIL до нового результата.

| Дополнительное доказательство | Bytes | SHA-256 |
| --- | ---: | --- |
| `api26-build5-notification-open-failure.png` | 186692 | `61a79d003823da173f4d1c1d4d00c81c8912bc4fcc4b5ac9d39dec7573396188` |
| `api26-build5-notification-open-failure.xml` | 27343 | `3e081e5bbe2cbe2e93ded3586b2b1ebeaf0ba25262bf691faa81a193499db9dc` |

## Три незавершённых прогона API35

[api35-host-emulator-crashes.json](../../../outputs/v313/api35-host-emulator-crashes.json) содержит Windows Application events **1000**, процесс `qemu-system-x86_64-headless.exe`, exception **`0xc0000005`**. Каждому оборванному журналу соответствует событие с разницей относительно его mtime **1.8–3.1 секунды**. Parent подтвердил падения host QEMU; диагностика не переименована в app crash.

| Журнал | Последний начатый метод | Что действительно завершено |
| --- | --- | --- |
| ui-full | current 2: `ui.Android310AcceptanceTest.yearSelectionRestoresTheChosenMonthInEveryCalendar` | Только 1 PASS; финала runner нет. |
| ui-software | current 77: `ui.Release313UiTest.timelineRevealsThreeDistinctCardsInTemporalOrderAndOpensTheirOrientation` | **76** результатов: 70 PASS / 2 FAIL / 4 SKIP. Это не 77 завершённых тестов и не 321 проверенный сценарий. |
| release313-swangle | current 3: тот же `timelineRevealsThreeDistinctCardsInTemporalOrderAndOpensTheirOrientation` | Только 2 PASS; финала runner нет. |

Незавершённым методам не присвоены PASS или FAIL. Успех завершённого host-GL повтора 13/13 сохранён отдельно и не дописывает результаты в оборванные журналы.

## Сопоставление с приёмкой и непроверенные состояния

Прочитаны все **18 колонок / 210 строк** `test-matrix.csv`. Состояние матрицы сохранено: **192 NOT RUN / 5 N/A / 1 BLOCKED / 6 PASS / 6 FAIL**. Индекс предлагает 55 совпадений по candidate-классам и 14 более узких сопоставлений методов с ID. Совпадение класса не означает, что широкая строка приёмки выполнена. `test-matrix.csv`, `release-checklist.md` и main/test source этим отчётом не изменялись.

Непроверенными в рамках этого исторического отчёта остаются:

- Retest исправленного notification fixture, habit-feedback и SVG assertion; тестирование `WholeWordText` freeze225 и окончательного build6.
- Финальная аппаратная приёмка на Realme и Samsung; все состояния 360/390/768/1440, обе схемы и увеличенный системный шрифт, полный TalkBack/control sweep.
- Установка и startup подписанного кандидата, ART/R8 runtime, обновление существующих пользовательских данных и работа на 16KB runtime.
- Live Google OAuth/синхронизация, Play-generated APK, приём Google Play, публикация и production-проверки.

При подготовке отчёта не запускались ADB, Gradle, CI, install, публикация или SSH. Production-БД, конфигурация и данные телефона не читались и не изменялись.
