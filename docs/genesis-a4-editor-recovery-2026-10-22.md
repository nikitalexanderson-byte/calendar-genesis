# A4: восстановление редакторов и сравнение конфликтов

Кандидат Android2.9.2/97 и web-код находятся в `codex/habit-lifecycle-completion`. Публикация этого среза ещё не завершена. Production на момент проверки: `d4922d6`, Android2.9.1/96.

## Изменения

- Редакторы шаблонов и автоматизаций сохраняют собственный ввод в зашифрованном device journal с отдельным writer для каждой вкладки и AAD аккаунта/проекта/назначения. Черновик восстанавливается по явному действию; открытие не отправляет команд. Для templates/automations/template-apply используется transactional IndexedDB с пределом20 записей и20MB plaintext на запись; старые localStorage записи сохраняются до явного восстановления и CAS-удаления.
- Полная неизменная команда с operation ID и счётчиком попытки сохраняется до HTTP. Неизвестный ответ блокирует изменение команды; retry повторяет её точно. Только однозначный отказ первой попытки позволяет вернуться к редактированию. После неизвестной попытки поздний409 не объявляет её непринятой.
- Ответ проверяется по scope, ID, ревизии, настройкам или полному набору mapping ID. Durable receipt позволяет закончить обновление интерфейса без повторной мутации. CAS cleanup не удаляет новую запись другой вкладки.
- Применение шаблона имеет собственный journal; библиотека показывает незавершённое применение по названию исходного шаблона. Исходные повреждённые зашифрованные записи можно выгрузить; отказ квоты блокирует отправку до успешного сохранения.
- Незавершённые числовые строки отделены от wire number: сроки, интервалы, порядок шаблонного поля, пользовательские значения, leadDays и WIP. Пустота/минус/дробная часть не превращаются в NaN или прежнее число при отправке. Значения двух задач используют разные стабильные ключи. Старые journal записи без raw numeric metadata продолжают читаться.
- Native account conflict показывает все local/remote/base значения, собственные названия и даты. Выбор «Телефон»/«Сайт» доступен после раскрытия всех страниц. Выбор привязан к UID и fingerprint полного сравнения; новый конфликт требует нового просмотра. Эквивалентные JSON numbers10/10.0 не создают ложный конфликт. User content отображается обычным текстом.

## Проверки

- Frozen install, lint (0 errors,2 прежних image warnings),457 web tests,14-language i18n audit и build:beget PASS: `output/a4-ui-final-*.log`.
- 723 JVM cases:715 executed,8 opt-in skips,0 failures/errors. Native lintRelease и unsigned production-origin R8 PASS после финальной унификации радиусов: `output/a4-ui-publish-native.log`.68 released holders прошли ART на API28/API35/Samsung API36;552 public originals,1 native-only original,102 catalogs byte parity PASS: `output/a4-ui-publish-art.log`, `output/a4-ui-publish-assets.log`.
-59 текущих browser checks для template/automation/apply через IndexedDB: editable/cold/pending recovery, два writer, потерянный ответ после commit, отсутствие auto replay, ровно одна ревизия/набор объектов. Evidence: `output/a4-idb-template-phase{1,2,3}.log`, `output/a4-idb-automation-phase{1,2,3}.log`, `output/a4-idb-template-apply-phase{1,2}.log`. Прежние65 checks и отдельные raw numbers двух задач остаются историческими доказательствами, без суммирования с повторным прогоном.
-16 прямых проверок настоящего IndexedDB: большой encrypted journal, cold read, legacy recovery, quota rollback, CAS, гонка за20-й слот, delayed-write sign-out protection: `output/a4-idb-direct.log`. Настоящий сервер принял4 722 568-byte manifest/230 tasks;12 595 705 encrypted bytes восстановились через cold UI, а explicit retry сохранил operation ID/revision и все описания по10000 символов: `output/a4-large-template-phase{1,2,3}.log`. Legacy numeric apply повторно принят через новую UI/IDB сохранность: `output/a4-idb-legacy-apply-ui.log`.
-2 live cross-tab checks PASS: уже открытая вкладка обнаруживает новый encrypted IDB draft без reload и без HTTP-мутации: `output/a4-idb-cross-tab.log`.
-14 core native cases на каждом из API28/API35/Samsung: transport/CAS, stale fingerprint, сохранность encrypted bytes/outbox, выбор обеих сторон, busy/cancel,48dp, scoped offline records и отзыв доступа в UI: `output/a4-native/final/*/core-functional.log`.
- Контрактные случаи сохранения, потери ответа, недопустимого receipt, retry и scoped CAS также включены в обязательный `pnpm test`: `tests/shared-editor-device-drafts.test.mjs`, `tests/draft-number.test.mjs`, `tests/workflow-device-drafts.test.mjs`.

## Дизайн и границы

Сохранены STANDART, все ассеты и Universal UI. Повтор/отмена/удаление/обновление используют существующие общие компоненты; второстепенные действия компактны и имеют локализованные доступные имена. Восстановление, редактор, preview и история разделены по смыслу. Показаны короткие действия с названием черновика и временем.

Есть4 before и24 browser after PNG: обе схемы/360/390/768/1440. Проверены44px и границы recovery controls.9 native PNG показывают light/dark/busy/pagination на трёх устройствах, включая фактический landscape API35. Материалы: `output/playwright/a4-*-final-*.png`, `output/a4-native/final/*/workspace-conflict-captures`.

Не заявляются: новый signed MainActivity/Google-вход до выпуска, синхронизация двух настоящих Google-аккаунтов, реальное разрешение конфликта Samsung без выбора владельца данных, полный production walkthrough и исправление прежних TypeScript diagnostics. Tablet restore PNG остаются пустыми при успешных semantics/bounds; визуальная приёмка этих состояний не заявляется. Source/font130 повторно проверены на Samsung и tablet в обеих темах.13/13 lifecycle-проверок планирования прошли на каждом устройстве в предназначенном g1qa package; прежний guard failure не засчитывается.

Операторский SSH, чтение приватной production-БД/токенов и ручные изменения БД не использовались. Настоящие версии телефона и сайта не выбирались автоматически. Независимые агенты не запускались.
