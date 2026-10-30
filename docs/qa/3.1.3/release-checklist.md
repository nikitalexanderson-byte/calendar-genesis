# Genesis Tasker 3.1.3 — условия выпуска

Срез 30 октября 2026 перед завершением Android build4: **QA выполняется, итоговые gates NOT RUN; деплой3.1.3: NOT RUN; Google Play Alpha120: NOT RUN; Google Play Production: BLOCKED**. Подтверждённые результаты ниже относятся к указанным запускам. Исправленные после candidate3 исходники/fixtures ещё не проверены новым Android APK. Пользователь поручил после проверки выпуск и замену скриншотов Play; этот файл не разрешает пропуск условий готовности.

## Подтверждённый QA-прогресс

| Проверка | Результат фиксированного запуска | Доказательство |
| --- | --- | --- |
| Web после Quinta/export | frozen install, lint0errors/2warnings,785/785tests без skips, build:beget успешен; legal/13locale bundles/precache117+402, largestJS349997bytes | `outputs/v313/web-{install,lint,tests}-build4.log`, `web-build4.log` |
| PHP8.3/SQLite |75/75scripts PASS +188/188syntax PASS, isolated; live Google/SMTP/WebPush и отдельная personal-mindmap transport fixture не проверены | `outputs/v313/backend-fixture/final-run/summary.json` |
| Браузерные новые Oracle компоненты |44variants:22Olympus+22Oracle/guide,110scopes,0найденных overflow/letter split/clipping; persistence/reroll/legacy storage/focus PASS. RU/EN4ширины и DE/EL/SR360px, обе схемы | `output/playwright/v313/summary-final.json`, `functional-final.json`, `QA-REPORT.md` |
| Native candidate3 unit/build |157suites,891tests,0errors/failures,8skipped opt-in HTTP; debug/AndroidTest build и lintRelease успешны | `outputs/v313/android-candidate3-build.log`, JUnit XML в `android/app/build/test-results/testDebugUnitTest/` |
| Candidate3 core |Realme18/20 и API26 18/20; одинаковые2fixtureFAIL. Today/Calendar checkbox+undo+recreate PASS; Дела selector и locale expectation не прошли | `outputs/v313/realme-candidate3-core.log`, `api26-candidate3-core.log` |
| Candidate3 выбранные suites |UI regression8/9, native Quinta FAIL; model4/4 PASS. Data/reminders20/41:11UI fixtures +10невалидных многофазных reminder checks; отдельный expired-session1FAIL на seed/save | `outputs/v313/realme-candidate3-{regressions,model,data-reminders,expired-session}.log` |
| Android build4 и source-after-build повтор |**NOT RUN**: session46188 выполняется, завершённый результат ещё не внесён | Заполняет основной агент после завершения сборки и аппаратных тестов |

PASS фиксированного suite не закрывает более широкий release gate. Перекрывающиеся запуски не складываются как уникальные сценарии;891unit tests включают8skips. В `test-matrix.csv` широкие обязательные строки сохраняют NOT RUN с проверенными частями в actual; исторические `RUN-*` отдельно содержат6PASS/6FAIL и pending Android run. Старый UI batch не завершил298случаев:225завершённых, затем нулевой viewport team report. Полная классификация и границы — `bug-register.md`.

## Подтверждённое исходное состояние

- Публичный `https://genesiscalendar.com/android-update.json`: `3.1.2 / 119`, minimum supported `2.7.0 / 76`, APK SHA-256 `4d9047e0b974b32b50f1f83adb85f2c58a7a6038b838fe17e6d0fd249af67f97`.
- Публичный deploy-meta: commit `b6810c3d9e5e3caf945945732de83930b33fe0a0`, run `40967953514`, deployed `2026-10-29T22:51:42Z`. Перед merge требуется учесть изменения master после базы рабочей ветки `3b92293b`.
- Play Console: приложение `Genesis Tasker`, package `ru.genesis.calendar`, существующий Closed testing — Alpha. Версия `3.1.2 / 119` — **Available to testers on Google Play**, full rollout, 178 регионов. All app bundles содержит13версий, максимальный119; поиск120 дал0/No results. Поэтому кандидат120 не выбран механически.
- Play Dashboard: **Production Inactive**, **Apply for production disabled**, 11 opted-in testers; Google требует не менее12 opted-in непрерывно14дней. Публичный Production сейчас невозможно начать доступными действиями агента. Не добавлять тестировщиков/права/регионы ради обхода этого условия.
- `GENESIS_DEPLOY_ANDROID=false`. В GitHub существуют четыре секрета постоянной подписи: `GENESIS_ANDROID_RELEASE_KEYSTORE_B64`, `GENESIS_ANDROID_RELEASE_STORE_PASSWORD`, `GENESIS_ANDROID_RELEASE_KEY_ALIAS`, `GENESIS_ANDROID_RELEASE_KEY_PASSWORD`. Проверены только имена, значения не читались. В локальном процессе signing env отсутствуют. Play service-account secret/fastlane/publisher API в действующей схеме не обнаружены; публикация выполняется через доступную существующую UI-сессию Play Console.
- GitHub Releases отсутствуют; APK/AAB сохраняются workflow и на сайте. Существующий `android-trial.yml` даёт подписанный APK выбранной ветки без деплоя. Древний `docs/android/RELEASE_RUNBOOK.md` описывает alpha и прежний хостинг; при конфликте применять текущие workflow, AGENTS и эти фактические наблюдения.
- SSH, production-БД и данные телефона для этой инвентаризации не использовались и не менялись. Браузерные действия были read-only; Save/Publish/Upload в Play не нажимались.

## QA и артефакты

| ID | Условие | Статус | Требуемое доказательство / оставшееся действие |
| --- | --- | --- | --- |
| REL01 | Сохранены пользовательские изменения, отдельная ветка от origin/master | NOT RUN | Итоговый git status/diff и сверка с актуальным master; не перезаписывать исходную рабочую папку |
| REL02 | Реестр сверён с каждым экраном, диалогом, меню и условным действием | NOT RUN | feature-inventory.md + фактический control sweep, новые найденные ID добавлены |
| REL03 | Все применимые обязательные строки матрицы завершены | NOT RUN | В актуальных обязательных acceptance-строках нет FAIL/BLOCKED/NOT RUN; N/A обоснованы. Исторические RUN-строки/неуспешные логи сохраняются |
| REL04 | Воспроизводимый вылет на галочке устранён | NOT RUN | Candidate3 Today/Calendar и guards PASS на Realme/API26; Дела selector исправлен после APK. Финальный повтор всех путей, shared и Samsung ещё нужен; исходный Samsung stack отсутствует |
| REL05 | Основные UI-правки проверены на Realme | NOT RUN | Core18/20 и отдельные360dp light screenshots есть; полный light/dark/font1.0/1.3 sweep, новый team-report IME regression и финальный crash/ANR scan ещё нужны |
| REL06 | Ширины390/768/1440 и ориентация проверены | NOT RUN | Web Oracle44variants пройдены; они не заменяют полный native sweep. CSS px, Compose viewport и физический экран фиксировать отдельно |
| REL07 | Все14языков полны и проверены | NOT RUN | Web SSR/content/bundles14PASS; browser визуально5языков в ограниченном scope. Native locale-loop остановлен fixture; новый14-locale UI/notes/font1.3 проход нужен |
| REL08 | Новые Oracle функции работают в обоих клиентах | NOT RUN | Web draw/meanings/persistence/reroll/legacy/focus и native RU core candidate3 PASS. Финальный native, остальные языки и authenticated web↔Android roundtrip ещё нужны |
| REL09 | Привычки / timerEnabled / abstinence не теряют данные | NOT RUN | Unit/repository/web roundtrip + реальный restart: disabled timer time-only без XP/блокировки другого таймера |
| REL10 | Завершение задач и награды идемпотентны | NOT RUN | Repeat tap, offline replay, complete/uncomplete и связанные счётчики/XP на актуальном кандидате |
| REL11 | Auth / sync / роли / изоляция / crypto подтверждены | NOT RUN | PHP75scripts и unit fixtures PASS не заменяют live Google/два клиента/роль/revoke. Отдельный expired-session run остановлен на seed/CAS; повтор нужен |
| REL12 | Напоминания подтверждены в реальной фоновой работе | NOT RUN | Не использовать смешанный batch: verify шёл до arm, account scope наследовался. Запустить arm → process stop → ожидание → verify отдельно; записать permissions/channel/Doze/OEM. TASK_CHANNEL importance0 и volume0 не означают auth bug; слышимость отдельно |
| REL13 | Сохранность при119→120 проверена | NOT RUN | Подписанные APK одной identity, синтетические данные/ключи/session/outbox/settings/reminders, без clear/uninstall |
| REL14 | Минимальная Android API26 и существенные API проверены | NOT RUN | API26 candidate3 core18/20 с теми же2fixtureFAIL; полный набор после фиксов не выполнен. Другие API и Samsung остаются отдельными проверками |
| REL15 | Производительность и продолжительная сессия проверены | NOT RUN | Заранее заданные start/scroll/large-map/memory/network критерии, сравнение с119, crash/ANR scan |
| REL16 | Полные обязательные web/API проверки прошли | NOT RUN | Последний локальный web run785/785 + install/lint/build PASS; isolated PHP75/75 + syntax188PASS. Зафиксировать финальный source commit/flags; live/отдельная personal-mindmap transport fixture этим не подтверждены |
| REL17 | Native unit / UI / lint прошли на конечном коде | NOT RUN | Candidate3 unit157suites/891tests/8skips, build/lint PASS; Android build4 ещё выполняется. Затронутые UI/fixture регрессии и финальные JUnit/APK hashes должны быть внесены после него |
| REL18 | Подписанный кандидат APK проверен до merge | NOT RUN | Существующий android-trial.yml из рабочей ветки, SHA-256, cert, metadata, minified critical flows |
| REL19 | AAB и APK имеют правильные настройки | NOT RUN |3.1.3/120, package, подпись, non-debuggable, min26/target37, manifests, mapping,16KB/ELF, assets, Google OAuth |
| REL20 | Миграция089 совместима и имеет план восстановления | NOT RUN | Isolated timeline/old-writer/atomic rollback/backup/account-cascade tests PASS; перед CI подтвердить runtime-backup и финальный deploy. Автоматический database rollback запрещён |
| REL21 | Новый тарифный foundation сохраняет текущий доступ | NOT RUN | PHP feature-access/subscriptions/profile и web tests PASS. Ручной admin grant/lifetimePremium, live sync/restart/смена устройства ещё не выполнены |
| REL22 | Bug register / manifest / final report согласованы | NOT RUN | Все исправления перепроверены; один commit и hashes финальных артефактов; честные счётчики и непроверенные состояния |

## Распространение

| ID | Условие | Статус | Требуемое доказательство / оставшееся действие |
| --- | --- | --- | --- |
| PUB01 | Существующий workflow синхронизирован с120 | NOT RUN | Review diff deploy.yml: только3.1.3/120, неизменные guards сертификата, startup, class checks, hashes, разрешённые Hostinger roots |
| PUB02 | Кандидат загружен на существующий Alpha | NOT RUN | Проверенный AAB, Console version120, прежние тестировщики/регионы/подпись; uploaded ≠ available |
| PUB03 | Play install/update и pre-launch проверены | NOT RUN | Реально установленная из Play120, update119, OAuth; отчёт pre-launch получен и разобран либо конкретный blocker |
| PUB04 | Скриншоты карточки заменены | NOT RUN | Capture test подготовлен, но финальные реальные synthetic кадры3.1.3 и Console save ещё не подтверждены. Заменить5старых tasker-306*.png в RU/EN, проверить порядок/обрезку/читабельность; web QA PNG не заменяют native listing |
| PUB05 | Play policy / listing / декларации проверены | NOT RUN | Target API,16KB, exact-alarm/installer declarations, Data safety, account deletion, privacy, review access, rating, страны |
| PUB06 | Публичный Production разрешён Console | BLOCKED | Dashboard:11 opted-in, требуется≥12 за14дней; Apply disabled. Нужны реальные действия/ожидание владельца и решение Google, не обход |
| PUB07 | Подписанный APK опубликован штатным deploy.yml | NOT RUN | Только после QA gates: push/merge master, временно разрешённый Android deploy, Actions success, вернуть flag=false |
| PUB08 | Сайт после deploy проверен | NOT RUN | /deploy-meta.json==masterSHA, /api/health, android-update120/hash,302 download, HTTPS/MIME/cache; публичныйAPK скачан и hash/install сверены |
| PUB09 | Play-релиз фактически доступен | NOT RUN | Различать uploaded/testing/in_review/rolling_out/published; подтвердить страницу, регион, версию и установку; Production blocker не скрывать |
| PUB10 | План остановки/восстановления готов | NOT RUN | Git revert для web/API, не автоматический DB rollback; pause rollout и новый больший versionCode для Android;119 поверх120 не ставить |

## Подписанный APK из рабочей ветки без деплоя

Существующий `.github/workflows/android-trial.yml` запускается вручную с выбранной веткой, принимает стабильную3.1.3 и использует те же GitHub signing secrets. Для проверки Play-кандидата до публикации в этот же workflow добавлены `lintPlay` и `bundlePlay`. Он выполняет native unit tests, lint, `assembleRelease`, сверяет certificate, metadata, zipalign и отсутствие debuggable; сохраняет immutable APK, Play AAB, SHA и оба mapping на14дней. У Play-варианта проверяется отсутствие разрешения сторонней установки пакетов. Это необходимо, поскольку прежний workflow выдавал только APK, а локальные signing secrets недоступны. Сайт, переменная Android deploy и Play не изменяются. Историческое имя artifact `genesis-android-3.0-trial-<run_number>` не означает beta package.

Команды для основного агента после commit/push и готовности соответствующих проверок; здесь не выполнялись:

```powershell
gh workflow run android-trial.yml --repo nikitalexanderson-byte/calendar-genesis --ref codex/v3.1.3-today-trackers
gh run list --repo nikitalexanderson-byte/calendar-genesis --workflow android-trial.yml --limit 3
gh run view <run-id> --repo nikitalexanderson-byte/calendar-genesis
gh run download <run-id> --repo nikitalexanderson-byte/calendar-genesis --dir outputs/v313/signed-candidate
```

В исходниках trial workflow уже есть `:app:bundlePlay` и `lintPlay`; его успешный подписанный запуск ещё NOT RUN. Play APK собирает финальный `deploy.yml` через `:app:assemblePlay`, также проверяя отсутствие `REQUEST_INSTALL_PACKAGES`, startup и release classes. Финальный дистрибутив после merge может иметь другой hash из-за метаданных; его нужно сопоставить с проверенным source commit и ещё раз проверить, а не автоматически переносить PASS с debug.

Перед установкой production120 на Realme проверить сертификат и существующую версию. `adb install -r` не очищает данные, однако после обновления120 нельзя безопасно вернуть119 простым downgrade. Нужны проверенные export/recovery и сценарий сохранности существующих данных. Изолированный debug-пакет этого риска не имеет, но также не закрывает upgrade gate.

## Замена скриншотов Google Play

Read-only проверен путь: `Grow users → Store presence → Store listings → Edit default listing → Phone assets`. Карточка Live, default `ru-RU`, дополнительный `en-US`; у обоих показаны5старых файлов: `tasker-306-board.png`, `tasker-306-today.png`, `tasker-306-calendar-month.png`, `tasker-306-calendar-year.png`, `tasker-306-sleep.png`.

Требования, отображённые самой Console:2–8phone PNG/JPEG, каждый≤8MB, стороны320–3840px, aspect16:9или9:16. Подготовить реальные кадры финального интерфейса с синтетическими данными, корректным9:16кадром (например1080×1920), без растяжения интерфейса и личных данных. Тестовый полный экран Realme1080×2400 не имеет9:16; адаптировать постановку кадра/capture, не обрезать важные действия. После замены default проверить EN: локализованные assets могут сохраняться независимо от default fallback.

Загрузка идёт через `Add assets`, удаление заменяемых скриншотов — только после подготовки полного нового набора и локальной проверки. Затем review/save и Publishing overview. Если Console требует новое принятие юридического соглашения или отсутствует доступ, остановиться на конкретном препятствии, не принимать его автоматически. Иконка и feature graphic не требуют смены по пользовательскому поручению.

## Официальные требования на дату проверки

- [Target API](https://support.google.com/googleplay/android-developer/answer/11926878): с31августа2026 новые mobile app updates должны target API36или выше. В исходниках37; окончательный merged manifest ещё проверяется.
- [16KB pages](https://developer.android.com/guide/practices/page-sizes): проверить все реальные native `.so` и их ELF/ZIP alignment либо зафиксировать отсутствие native библиотек; Java/Kotlin сами по себе не отменяют проверку зависимостей и фактического APK.
- [Preview assets](https://support.google.com/googleplay/android-developer/answer/9866151): актуальные кадры реального приложения, без вводящих в заблуждение элементов; ограничения конкретных Phone assets выше прочитаны в Console.
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [удаление аккаунта](https://support.google.com/googleplay/android-developer/answer/13327111), [подготовка выпуска](https://support.google.com/googleplay/android-developer/answer/9859348) и состояние деклараций конкретного приложения подлежат финальной проверке; не считать прежнее заполнение актуальным без сверки поведения3.1.3.

Актуальность политики и состояние Console проверяются перед фактическим submit ещё раз. Доступ к UI Console есть; это не доказательство выполнения всех деклараций или разрешения Production.
