# C1: массовые действия в Android — 20 октября 2026

Начальная точка: свежий origin/master `8b32ac4`, PR #227. Deploy `39376229705` завершён успешно; production SHA совпадает, health успешен, все 90 фактических JS/CSS entry/preload ресурсов отвечают 200. Публичный Android остаётся 2.9.0/95. Операторский SSH не использовался.

## Аудит и границы

Web `SharedBulkActions.tsx` и `shared-bulk-model.ts` уже используют durable API `server/src/shared-bulk.php`; native gateway, client и project UI пока не предоставляют массовых действий. Существующие task checkboxes завершают задачи, а drag перемещает их — эти жесты сохраняются. Начинаем с одного отдельного экрана массовых действий выбранного проекта, открываемого из его меню.

Сервер поддерживает выбор явных id/projectId/revision (до 1000) либо всю замороженную filter/sort/queryVersion выборку без скачивания всех задач, восемь действий и обязательный preview. Preview живёт 600 секунд; requestId и точное тело нужно сохранить до первой отправки. Выполнение поштучное, не атомарное. Confirm/cancel/advance/resume повторяемы по operationId; worker и HTTP делят lease/backoff. Отчёт — по 100 строк, история — по 20 операций; scope/options имеют ограниченную пагинацию. Имена пересчитываются с текущими ACL: свежая редактированная/скрытая строка не должна наследовать старый title. CUSTOM_FIELD_MOVE_REQUIRES_MAPPING сейчас теряется в общем BULK_NOT_ALLOWED; проверим эту C1/C3 связь на реальном synthetic API.

## Предлагаемый экран

Выбор задач → параметры одного действия → предпросмотр с числом затронутых подзадач → явное применение → живой отчёт с конфликтами/пропусками и отменой оставшихся задач. История позволяет вернуться к операции после закрытия приложения. Приоритет, исполнитель, статус, срок (задать/сдвинуть/очистить), метки, перенос, архив и корзина используют существующие серверные контракты. Дата вводится независимо от календаря отображения. Обычные task checkboxes/drag и прежняя task outbox остаются на своих местах.

Локальный журнал шифруется существующим Keystore-хранилищем, разделён по аккаунту/проекту, защищён CAS. Храним только выбранные ссылки/действие/неподтверждённую команду и operationId; отчёты и имена не сохраняем. Неоднозначный preview повторяется ровно с прежним requestId/body. Смена аккаунта, контроллера, отключение общих дел и отмена coroutine не допускают позднего применения ответа. Перед новой операцией и confirm проверяем существующую очередь задач. Старые очереди не очищаем. Offline/ACL/restart/expired-preview показывают понятное восстановление.

## Direction contract

THESIS: пользователь меняет сразу несколько задач осознанно и видит результат каждой. Экран расширяет текущие общие дела.

OWN-WORLD: существующие STANDART paper/green/gold и тёмная схема, Affairs заголовок, одинаковые 48dp действия с подсказками, единые кнопки раскрытия, обычная читаемая сетка полей. Имена пользователя не переводятся.

STORY: сначала выбрать объём, затем действие, проверить последствия и применить. При частичной ошибке оставшиеся результаты доступны отдельно.

FIRST VIEWPORT: заголовок/история/обновить/закрыть, название проекта, выбранный объём и задачи; основное действие в нижней панели. В широком окне читаемая ограниченная ширина, на телефоне поле на всю строку без горизонтального overflow.

FORM: code-led расширение существующего native экрана; без нового визуального мира и библиотеки.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## План проверки

До изменения UI: baseline выбранного проекта, обе схемы ×360/390/768/1440. JVM: контракты всех действий, revision/queryVersion, CAS/потерянный ответ/receipt/аккаунт/очередь/ошибка записи, редактирование ACL без сохранения прежних имён. Реальный loopback PHP: preview/replay/confirm/advance/report/history, конфликт и C3 move mapping. UI API28/35: явный/весь выбор, запрет выбора как completion, preview/apply/report, expiry/queue/offline/recreation/ACL/история/календарь. Один initial visual pass и один подтверждающий после исправлений; обязательные frozen install/lint/test/build и native release/R8.

Этот срез сам по себе не закрывает C1 и все зависимости: signed release/device/Google и сквозные C/B/G/E/F/A4 остаются отдельной приёмкой. Общий остаток — 21 частичный ID и 14 K/U/L. Миграции и ручные изменения production-БД не планируются.


## Реализация и исходная приёмка

Добавлены SharedBulkProtocol/SharedBulkDraftService, отдельный encrypted bulk purpose и маршруты существующего AuthSessionClient/SharedWorkspaceGateway. Журнал использует PlanningJournal CAS и содержит только выбор/действие, замороженный preview request и operationId. Неполный/malformed receipt оставляет команду pending; после неоднозначного ответа тот же requestId/body повторяется до подтверждения. Обычная task outbox не меняется; перед новой операцией и confirm она проверяется. Каждая операция и выборка разделены по actor/project; UI отвергает поздние ответы после закрытия, смены scope или паузы.

Один экран общих дел: выбор строк или всех результатов фильтра, восемь действий, собственный календарь ввода, обязательный preview, явное применение, остановка оставшихся задач, поштучный отчёт и история. Текущий filter/sort/queryVersion замораживается и при восстановлении родительского загрузчика проекта; обычные task completion/drag остаются прежними. Отчёты, имя задачи и project/option names читаются заново с ACL; при offline/revocation старые live данные удаляются. Отчёт переключает серверные страницы по100 и раскрывает по5 строк. Выборы и поля на всю ширину, повторно используются Affairs icons/tooltips/disclosures и STANDART light/dark. Новые32 подписи переведены на14 языков; пользовательские имена/метки не переводятся.

Web/server C1/C3 связь: mapping-required при переносе больше не теряется в общем отказе. Web использует существующий перевод shared-work, bulk locale check учитывает тот же общий runtime catalog. Реальный PHP custom-field тест подтверждает skipped и неизменную revision; общий server bulk suite подтверждает121 all-results, потомков, восемь действий, частичные результаты, конфликты, lease/backoff, cancel/resume и ACL redaction.

До finish-review прошли520 JVM без failures/errors/skips, включая C1/C3/C5/C6 loopback HTTP. C1 HTTP создаёт только свои два synthetic проекта в локальной fixture:131 задач, lost preview replay с одной операцией, confirm без повторной мутации, report/history paging, все восемь действий, конфликт одной из двух задач, move, archive cascade и soft-trash. Свои проекты после теста архивируются, своя label удаляется; production не используется.

Подтверждающий native прогон: API28 и API35 — по19 выполненных functional/storage/integration cases, capture-only case отдельно skipped (20 в runner). Включены recreation формы и родительского проекта, сохранение frozen scope, direct task opening, роли, old queue, потерянный ответ, три input calendars, отключённые сакральные функции и unavailable action metadata. Сохранены8 baseline,68 initial и68 confirming native originals, обе схемы ×360/390/768/1440, font130 и14 языков.8 public web screenshots подтверждают обе схемы/четыре ширины без horizontal overflow; Google-card heading rgb(19,36,38). В preview API4338 не подменяет production; публичная страница на preview4344 не имеет настоящей Google-сессии.

После initial pass компактный preview показывает selected/affected, полный набор счётчиков остаётся у запущенного отчёта; в форме показан выбранный объём. Успешный move preview обязан содержать читаемые destination project/status names; unavailable destination нельзя подтвердить. Capture fixture содержит реальную actionInfo-структуру сервера. Предыдущие initial preview кадры остаются историей до уточнения fixture; confirming originals подтверждают destination metadata. После finish-review исправлены две material findings: адаптивная общая высота кнопок выбора и локализованная дата истории в часовом поясе устройства с явными zone/UTC offset. Отдельно task links включают архивные задачи с текущим ACL: существующая read-only карточка показывает поля и историю комментариев, без редактирования и отправки новых комментариев.

Обязательные frozen install/lint/360 web tests/build:beget прошли. В lint — два прежних img warning. Debug/JVM/test APK и unsigned release/R8 после archive-adapter прошли. Совместная ранняя debug/release компиляция с локальным2GiB heap остановилась на GC thrashing; раздельные повторы с4GiB через CLI успешны, без изменения CI/CD или gradle.properties.

Финальный diff-check обнаружил отсутствующие bulk/options маршруты в allowlist нативного HTTPS транспорта. Добавлены только точные маршруты и методы; HTTP acceptance теперь проверяет тот же guard, отрицательные unit cases исключают посторонние query/method/path. Финальные522 JVM —0 failures/errors/skips, включая реальный guarded PHP HTTP. API28/35 — по22 выполненных functional/storage cases и одному отдельно пропущенному capture-only entry (23 в runner). Архивная карточка owner остаётся read-only без comment mutation, обычная активная карточка сохраняет edit/retry.68 confirming originals пересняты после двух review-исправлений, валидны и не пусты. Финальные debug/test APK и отдельная unsigned release/R8/lintVital сборка успешны. Логи: output/native-bulk-transport-debug-build.log, native-bulk-finish-functional-emulator-5554.log /5556.log, native-bulk-finish-release-build.log. Независимый Verdict Pass: обе material findings resolved, disposition ship в пределах этих двух исправлений; это не является подписанной общей release-приёмкой. Documentation handoff сохраняет существующую дизайн-систему без новых токенов.

Не проверены: физический Samsung, настоящий Android landscape и production Activity/system bars, подписанный R8 runtime и реальный Google/native HTTPS, применение к реальной пользовательской очереди и все сквозные C/B/G/E/F/A4 зависимости. C1 native scope этого этапа — один выбранный проект; mixed-project/native saved-view и остальные интеграции остаются открытыми. Публичный Android остаётся2.9.0/95. Новых миграций, ручных production DB изменений и операторского SSH нет.
