# GENESIS 3.1.3 / 120 — проверка и выпуск 31 октября

## Состояние

Продолжение PR #331, ветка `codex/v3.1.3-today-trackers`. Производственный код на текущем срезе: `010afbf27fb80549ccb2c0e40fabcafdafd567b5`. Основной checkout пользователя с незакоммиченными изменениями Фюзиса сохранён. Для QA используется отдельный пакет `ru.genesis.calendar.v313.debug`; установленное основное приложение Samsung пока не изменено.

Подписанный кандидат: workflow [41214668210](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41214668210), выполняется. Отменённый 41213272833 предшествовал последнему исправлению перевода и финальным кандидатом не считается. Deploy, установка основного приложения Samsung и Play Alpha120 пока не завершены.

## Законченные исправления

- Сетка интервальной привычки сохраняет раскрытие при переносе завершённой карточки; отметки можно снять после завершения. Исторический прогресс конечной цели сохраняется при последующей паузе и возобновлении. Исходные сценарии BUG019/020 повторно прошли на API26 и Samsung.
- Панель поиска личных дел резервирует собственную фактическую высоту. Последняя кнопка проекта остаётся доступной над панелью. Полный CRUD, статус Completed→Active, отмена удаления, удаление только пустого UUID-проекта, поиск/фильтр/сортировка и открытие через новую Room/repository прошли на Samsung и API35.
- Автопрокрутка при перетаскивании останавливается над полностью видимой новой целью. Выбор цели ограничен видимыми lazy items и рабочей областью. На API35 и Samsung прошли реальные переносы задачи из входящих в проект и подпроект, а целого списка — в подпроект и обратно. Проверены сохранённые задачи и связи списка. В тесте дополнительно раскрывается конкретный дочерний элемент длинного входящего блока перед чтением координат; жест, время удержания и проверки результата сохранены.
- Длинный текст о покровителе дня переводится вместе с подписью «Части тела». Проверены все семь дней недели на 13 языках помимо русского. Отдельно добавлен шаблон доступного имени переноса целого списка на всех 14 языках; названия пользователя подставляются буквально.
- Новые 13 PNG олимпийцев включены в offline precache. Существующие изображения сохранены.
- Управление таймером проверено через реальный редактор привычки: выключить, сохранить, открыть повторно, включить и сохранить; история таймера не меняется, выключенная панель и действие запуска отсутствуют.

## Доказательства

Все пути ниже относятся к локальному рабочему дереву выпуска; `outputs/` и `output/` содержат сырые журналы и снимки и не публикуются как исходный код.

| Область | Подтверждённый результат | Доказательство |
| --- | --- | --- |
| Web до последней строки перевода | frozen install, lint 0 errors / 3 img warnings, 788/788 tests, 0 skips, build PASS; 121 entry + 415 visual assets | `outputs/v313/web-final24-{install,lint,test,build}.log` |
| PHP | 75/75 изолированных скриптов + 188 syntax checks; без production config/DB и внешних mail/http | `outputs/v313/backend-fixture/final19/summary.json`, `php-final19.log` |
| Native main26 | 158 suites / 900 tests / 0 failures / 0 errors / 0 skips, debug/test build PASS | `android-build26-debug-unit.log`, `candidate26-unit-results/`, `candidate26-unit-totals.json` |
| Native main29, окончательный код | 158 suites / 900 tests / 0 failures / 0 errors / 0 skips; debug APK SHA256 `a409464f32e1ef981369c2272eba0b1c0ad9c17c3fbd60b166460d4a6ff79996` | `android-build29-debug-unit.log`, `debug-candidate29/manifest.json`, `candidate29-unit-results/` |
| Web main29, окончательный код | frozen install, lint 0 errors / 3 warnings, 788/788 tests / 0 skips, build PASS; precache 121+415 | `web-final29-source.txt`, `web-final29-{install,lint,test,build}.log` |
| API35 переносы и перевод длинных абзацев | 4/4 PASS; реальные четыре переноса, 7×13 полных абзацев и два сценария владельца жеста | `api35-build27-drag-copy-host.log`, `api35-build27-drag-proof.json` |
| Samsung основные сценарии | 42 terminal PASS до остановки старого тестового жеста; app26 не менялся. Дальнейший исправленный жест, тема/Today, literal translations, полные абзацы и Diary PASS отдельным запуском. Один main-language walkthrough завершился ошибкой SnapshotStateObserver; повтор выявил новый untranslated list hint, исправленный в source29 | `samsung-build26-final-core.log`, `samsung-build27-final-tail.log`, `samsung-build28-main-locales-retest.log` |
| API35 настройки/восстановление/конфликты | 16/16 PASS, включая реальный editor timer flag, history, feedback switches, backup merge/draft/rollback и Cancel/busy conflict UI | `api35-build28-settings-backup-conflict.log` |
| Локализация до нового list hint | Samsung: 14 языков, 696 состояний, 0 Russian/word-split findings; Diary 28 профилей, 644 checkpoints, обе темы, 360dp/font1.3 | `samsung-build21-locales-diary.log`, `samsung-proof21/*.json` |
| Samsung main29, точный повтор | 6/6 PASS: полный обход 14 языков / 720 состояний / 0 Russian или word-split findings; все 7×13 абзацев, literal fields, interval + timer flag, реальные четыре переноса и полный CRUD проектов | `samsung-build29-locales-timer-projects.log`, `samsung-proof29/` |
| API35 main29 | 3/3 PASS: обычный чат и два набора translation regressions | `api35-build29-messenger-literal-copy.log` |
| Web 13 олимпийцев | 40 профилей / 520 диалогов / 0 failures; RU/EN 360/390/768/1440, остальные языки 360, обе схемы | `output/playwright/v313/final19-olympians-retest.txt` |
| Store screenshots | 12 native PNG 1080×1920, синтетические данные, RU6+EN6, исправленный полный английский абзац | `play-listing-final27/manifest.json`, `store-final27/` |

Полные web/native unit/build и точный обход языков на source29 завершены. Исторические FAIL и остановленные запуски сохранены и не включаются в число новых успешных полных запусков. Terminal PASS отдельного метода не объявляется успехом всего прерванного runner. Основные 48 разных методов завершились PASS в совокупности main26 core, test27 tail и точного main29 retest; это три запуска с явно разным происхождением, а не выдуманный единый 48/48 runner.

Один запуск test27 дал `SnapshotStateObserver` multithread error во время обхода. Причина по одному stack trace не установлена; журнал сохранён. Следующий полный обход выявил конкретный непереведённый drag hint, исправленный в main29. Полный main29 walkthrough завершился без этой ошибки и без исключений из аудита.

Снимки source27 сделаны на уже окончательных видимых экранах. Diff main27→main29 меняет только шаблон доступного имени переноса списка в личных проектах; этот элемент не представлен на 12 снимках карточки. В Play сохранены RU6 и EN6 с новыми именами `tasker-313-final27-<lang>-*.png`; оба Save as draft стали disabled, подтверждения и screenshot сохранены в `play-final27-{ru,en}-draft.{txt,jpg}`. Это ещё не публикация карточки.

## Распространение

| Этап | Текущее состояние |
| --- | --- |
| Подписанные APK/AAB 3.1.3/120, прежний сертификат, minified startup | Выполняется |
| Merge master и deploy.yml Hostinger | Не выполнено |
| Публичные deploy-meta / health / update120 / APK hash / download redirect | Не выполнено |
| Samsung SM-A566E: обновление основного пакета поверх 119, без clear/uninstall | Не выполнено |
| Google Play Alpha120, RU/EN новые снимки и Data safety | Подготовка; draft не означает публикацию |
| Google Play Production | Console не допускает до выполнения срока закрытого тестирования; состав тестировщиков и трек не менялись |

## Границы и непроверенные состояния

Сохранённая матрица содержит 197 acceptance rows и отдельные исторические RUN rows. Одна успешная проверка не переносится автоматически на все их контракты. Не заявлены PASS для отсутствующих или не выполненных live-сценариев: свежий OAuth/consent/revoke на Play-доставленном APK, полный обмен всех коллекций двумя реальными аккаунтами, администраторские/provider операции, физическая слышимость и reboot/OEM на Samsung, реальный TalkBack walkthrough и полный стресс-бенчмарк. Закрытый Alpha и публичный Production имеют разные условия доступности. Новые юридические соглашения не принимались.

SSH вручную не использовался. Production-БД вручную не читалась и не изменялась. Rollback кода — Git revert и обычный deploy; автоматический database rollback запрещён.
