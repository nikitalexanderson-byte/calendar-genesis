# E4/E5/F1–F3 и общая приёмка A4: текущий срез

Рабочая ветка `codex/habit-lifecycle-completion`; checkpoint `bb7eb96`, затем merge актуального `origin/master` с исправлением памяти CI. Подготовлен кандидат Android2.9.3/98, ещё не опубликован. Production остаётся `d4922d6eef7d4edc63c8474bba770d85210be306`, Android2.9.1/96.

## Реализовано и проверено

- Native lifecycle: отдельные active/pause/archive/deleted состояния, конфликты, сохранение ID/истории/наград, уникальные completed даты для порога49/50. Повтор команды сохраняет зашифрованные байты и outbox identity. Таймер при архивировании приостанавливается. Время конфликтов учитывает24h/AMPM.
- Native переносимая JSON-копия и полный CSV; checksum, allowlist, валидация всего файла, preview/keep/copy, детерминированные ID, пауза при восстановлении, отсутствие Google-связей и нового начисления наград. Зашифрованный Room draft разбит на части для файлов больше CursorWindow. Atomic apply/receipt/clear и injected rollback проверены.
- Native отчёты используют историю правил и доступности, отдельные знаменатели целей/объёма, открытые периоды и неизвестную доступность. Есть сравнение одинаковых прошедших частей, отсутствие процентного прироста к нулю, исходные записи и переход в историю, фактический Today, полный лунный год больше370 дней.15 JVM parity/calendar checks и3 настоящих UI/storage сценария входят в проверку.
- По13 lifecycle/backup/report функциональных случаев прошли на API28, API35 и Samsung SM_A566E/API36. Две фазы восстановления, разделённые настоящим force-stop QA package, прошли на всех трёх устройствах. Logs: `output/ef-native/final/`.
- Protocol6 offline Room outbox после upgrade объединяется с protocol7 lifecycle, сохраняет собственное название, удалённую паузу и web-only данные; потерянный ответ после commit и повтор не удваивают XP/журнал. Пройдено на всех трёх устройствах: `output/ef-native/protocol-upgrade-*.log`.
- Browser journal: encrypted IndexedDB, отдельные записи вкладок, scoped AAD/CAS, сохранение файла/выборов/исходного fingerprint, явное восстановление и обновление preview, выгрузка повреждённой записи и scoped discard, quota retry, offline сохранность.24 браузерных проверки прошли,8 PNG обеих схем/360/390/768/1440: `output/a4-journal-edges.log`, `output/playwright/a4-journal-final-*`. При cold load journal повторяет открытие после готовности ключа аккаунта; ошибка инициализации имеет явный повтор.
- Пустой и незавершённый числовой порядок поля сохраняется отдельно от wire integer.9 браузерных проверок подтвердили два reload, конфликт, rebase и ровно одно сохранение корректного числа: `output/a4-number-phase3.log`.

## Проверки сборки

Финальные frozen install, web lint (0 errors,2 прежних image warnings),457 web tests, i18n audit всех14 языков и build:beget прошли: `output/a4-ui-final-*.log`. Полный JVM прогон723 cases/715 выполнены/8 opt-in skips/0 failures, native lint/R8 PASS после последней унификации controls: `output/a4-ui-publish-native.log`.

Native lintRelease и unsigned production-origin release/R8 прошли: `output/a4-ui-publish-native.log`.68 UI/data/auth holders инициализированы ART на всех трёх устройствах без установки unsigned APK: `output/a4-ux-release-runtime/receipt.json`, `output/a4-ui-publish-art.log`. Это не signed MainActivity или functional release-приёмка.

Все4 timer backup parity vectors прошли отдельно и в полном JVM-прогоне: running Pomodoro, полночь и сохранённый DST-сеанс с двумя датами в clean/copy режимах. Причинный DAG сравнивается по ID независимо от порядка массива. Источник fixture: `output/generate-backup-timer-parity.mjs`; receipt: `output/efa-backup-timer-parity.log`.

Asset verifier учитывает grouped i18n sources и сохранённые static Gregorian season assets по существующим Gradle/source-set объявлениям. Byte gate PASS:552 public originals совпали с source/copy/APK,1 native-only original и102 каталога проверены. Изображения не удалялись и не заменялись. Receipt: `output/a4-ui-publish-assets.log`.

## Дизайн и визуальные границы

STANDART, ассеты и Universal UI сохранены. Restore choices укорочены до «Копия» с полным accessible name; второстепенные действия — общие иконки; нативные формы используют общий радиус. Сетка отчёта адаптируется к ширине без вложенной горизонтальной прокрутки, разные состояния имеют отдельные графические отметки. Переход к исходным данным и истории использует bring-into-view, сравнение раскрывается по запросу.

98 native capture/metrics файлов:74 API28,16 API35,8 Samsung;48dp и viewport bounds прошли с допуском одного физического пикселя округления.40 base кадров дополнительно сняты с ожиданием compositor frames. Физические PNG1440dp restore на API35 остаются пустыми при успешных semantics/bounds; визуальная приёмка этих кадров не заявляется. Некоторые source/font130 кадры показывают предыдущую позицию прокрутки. Bounds не подменяют визуальную проверку; эти состояния остаются явно непроверенными. Материалы: `output/ef-native/round-1`, `final`, `paint-confirm`, `review`.

## Samsung и оставшиеся действия

Пользователь подключил Samsung; signed upgrade95→96 установлен без очистки данных. Существующая учётная запись и подключения Google Calendar/Tasks сохранились. В настоящем аккаунте обнаружен конфликт зашифрованного пространства; обе копии сохранены, keep-local/keep-remote не выбирались. Диагностика ограничена UI, без чтения токенов и приватной БД. В кандидате97 реализовано конкретное сравнение local/remote/base всех конфликтующих полей и защита SHA256 fingerprint от устаревшего подтверждения. Новые конфликтные сценарии и scoped encrypted outbox прошли на трёх устройствах;9 native PNG показывают обе схемы и пагинацию.

В A4 добавлены durable editing/pending/received состояния шаблонов, автоматизаций, применения шаблона и ручного retry запуска.59 текущих browser checks через IndexedDB подтверждают cold discovery, два независимых writer, точный replay после потерянного ответа и неизменные ID/revisions;16 прямых IDB checks дополнены230-task/12.6MB encrypted cold recovery и legacy numeric apply. Прежний65-check прогон не прибавляется к повторному.13/13 native lifecycle-проверок планирования прошли на каждом из API28/API35/Samsung в предназначенном `ru.genesis.calendar.g1qa.debug`; первоначальный запуск в ghttps QA guard не засчитывается. [Подробности A4](genesis-a4-editor-recovery-2026-10-22.md).

Дополнительный UI проход унифицировал native control corners10dp/minimum48dp, восстановление по смысловым блокам и icon actions. Source/font130 повторно визуально приняты на Samsung и tablet в обеих темах; tablet restore PNG по-прежнему пустые при успешных semantics/bounds и не приняты визуально. Сообщения, desktop priority alignment и восстановление символов описаны в [UI/reliability audit](genesis-ui-reliability-audit-2026-10-22.md).

Живой Google-вход с нуля, два связанных настоящих аккаунта, финальный signed98 и полный production walkthrough ещё не подтверждены. Прежние TypeScript diagnostics вне этого среза остаются: `output/a4-final-typecheck.log`; typecheck PASS не заявляется. Количество полностью принятых ID до выпуска не уменьшалось.

Операторский SSH и ручные изменения production-БД не использовались. Независимый review не проводился; проверки выполнялись inline.
