# GENESIS Android — фактическая архитектура internal alpha

Срез 23.09.2026. Ветка `codex/android-native-bootstrap` от `ebfb4601cd7d2e96dfcebc3a47d1145be03ca48c`; изменения находятся в working tree. Существующий модуль `android/` продолжен. Native Kotlin/Compose single Activity; старый `BrowserLauncherActivity.java` не является launcher нового приложения. Native UI не использует WebView/JS runtime. Production, SSH и deploy в этой работе не использовались.

## Идентичность и границы

- Debug: `ru.genesis.calendar.debug`, versionCode 6 / `2.0.0-alpha01`, internal alpha, установлен на согласованный realme RMX5000 / Android 16 API36. Release сохраняет `ru.genesis.calendar`; постоянный release key пока не согласован. Debug→release не обещан как бесшовное обновление.
- `GenesisApplication.workspaceScope` сейчас выбирает **локальное** `internal-validation-v1` (debug) или `local-drafts-v1` (release). Это не user.uid сайта и не новое cloud workspace. Нативный вход не перепривязывает эти данные автоматически.
- Task/habit local models — текущий ограниченный продуктовый слой. Их нельзя отправить как полный web workspace или назвать синхронизированными. Облачная структура, миграции и merge ещё требуют реализации.
- Точная матрица отсутствующих групп находится в `PARITY_MATRIX.md`; наличие упакованного изображения или pure domain-функции не означает готовый экран.

## Слои и реальные связи

| Слой / файлы (под `android/app/src/main/java/ru/genesis/calendar`) | Ответственность | Ограничения |
| --- | --- | --- |
| `MainActivity.kt`, `ui/GenesisApp.kt` | Compose: Сегодня, задачи, календарный список, привычки, трекеры, настройки; открыть task из notification | Нет полноценного навигационного graph/back-stack; product parity частичная |
| `ui/GenesisViewModel.kt` | Task StateFlow/error, создание/изменение/завершение | Полная account-scoped ViewModel/session orchestration ещё не интегрирована |
| `ui/AuthorControls.kt` | Нативные date/time/priority controls | Визуальное и поведенческое соответствие web ещё не проверено |
| `data/TaskRepository.kt` | Room transaction, task revision/CAS, tombstones, local outbox, изменения reminder schedule | LocalTask — title/description/date/time/zone/priority/done/reminderAt; не все web task fields |
| `data/HabitsRepository.kt`, `ui/HabitsScreen.kt` | Локальный encrypted habit document, editor/library/history/базовые XP/Лавры | `localSchema=1` отдельно от web tracker schema16; продвинутые workflow не завершены |
| `data/TrackersRepository.kt`, `ui/TrackersScreen.kt` | Локальные планы/наблюдения сна, шкала настроения/заметки/история, version guards | Отдельный encrypted document; нет cloud import, reward side effects, полной аналитики/воздержания UI; интеграционная проверка новых файлов ещё идёт |
| `data/GenesisDatabase.kt` | Room tasks/reminders/outbox/documents, Flow observers | Outbox существует только локально; network drain/ACK не реализованы |
| `data/LocalPreferences.kt` | DataStore: Standart/Experimental, display/input calendars, 24/12h | Scope локальный; не server account theme/preferences |
| `domain/GenesisCalendar.kt`, `SacredCatalog.kt`, `LunarEphemeris.kt`, `RecurrenceEngine.kt` | Civil dates, 3 календаря, справочники, recurrence | Pure domain; task recurrence editor/storage/scheduler не подключены |
| `domain/habits/*` | Scoring/history/ranks/goals/reward ledger | Полные quests/achievements/protection/tracker modules ещё не перенесены |
| `domain/trackers/*` | Sleep duration/scoring/timezone, исходная mood scale, abstinence scoring/streak | Сон/настроение подключены локально; воздержание пока domain-only; новые unit tests ещё ожидают интеграционный запуск |
| `reminders/ReminderScheduler.kt`, `ReminderReceivers.kt` | AlarmManager, notifications/actions, restore, stale/dedup guards | Сейчас один task reminder, один процесс; actual background/hardware coverage отдельна |
| `data/LocalCipher.kt` | Android Keystore AES-GCM для локальных полей | Не SQLCipher; Room сам по себе не шифрует metadata |
| `security/WorkspaceCipher.kt` | Точный web AES-GCM primitive и recovery wrap/unwrap | Не auth, не cloud import, не полный sync/recovery UI |
| `auth/*` | Native Google Credential Manager, encrypted cookie/CSRF, verified session panel | Bootstrap не вызывается; cloud data не загружаются; backend endpoints не опубликованы |

Основной локальный путь: Compose → ViewModel/repository → Room transaction → StateFlow → Compose. Task save одновременно меняет encrypted task, revision, local outbox и reminder records; после commit отменяет старые системные PendingIntent/notification и назначает новое расписание. Habit mutation записывает целый зашифрованный документ атомарно, включая историю, цели, прогресс и доступный ledger subset. Сон/настроение используют отдельный `DocumentRecord(scope,"trackers")` с AAD `$scope/trackers`, localSchema1 и version guards; неизвестная/повреждённая schema не заменяется пустой. Null observations сохраняются отдельно от явно выбранных нулевых/neutral значений. Эти записи не начисляют XP/Лавры и не отправляются на сервер.

## Диск, ключи и конфиденциальность

Room `genesis.db` находится в private credential-encrypted storage. Содержимое задачи защищено LocalCipher с AAD `$scope/$taskId`; документ привычек — AAD `$scope/habits`. Android Keystore alias `genesis.local.v1`, AES-256-GCM с новым IV. В таблицах остаются технические незашифрованные поля: scope/ID/revision, done/deleted, время/статус reminder и local outbox metadata. Это осознанно не называется полностью зашифрованной базой.

Auto backup отключён существующим Manifest. Потеря Keystore key/переустановка сейчас не имеет завершённого безопасного local recovery workflow; нельзя обещать восстановить local-only черновики. Ошибка decrypt/schema не должна превращаться в пустой overwrite. HabitDocument tests покрывают неизвестную/повреждённую schema; общий hardware/WAL/backup audit ещё не выполнен.

Auth session хранится отдельно в private preferences `genesis.native.auth.v1` под LocalCipher/AAD собственного origin. Browser cookies не импортируются. Persisted native cookie/CSRF не даёт права автоматически присвоить локальному scope серверный user.uid. Любой будущий account-binding flow должен отдельно определить миграцию черновиков, cancellation workers/alarms, поздние ответы и logout.

## Календарь, повторения, время

Date-only остаётся `LocalDate`, часы — `LocalTime`, назначенный reminder — epoch instant + сохранённый zoneId задачи. Сакральный год сохраняет исходную web границу 20 марта; 12×30 дней + 5/6 дней Апейрона. Lunar table содержит 2537 точных new-moon instants, экспортированных исходным `astronomy-engine`; поддерживаемый диапазон пользовательских дат 1900–2100, вне него ошибка вместо скрытой аппроксимации.

RecurrenceEngine сохраняет web-правила interval/filter/exclusion/материализованных occurrences. Но LocalTask пока не содержит полный recurrence wire state и не создаёт серию. Нельзя заявлять «повторения работают в приложении» только по 9 календарным unit tests. Редактор задач отвергает неоднозначное/отсутствующее время DST; domain API также имеет явную overlap policy. Перерасчёт всех задач при смене timezone ещё не завершён.

## Локальные напоминания

Сущность `ReminderRecord(scope,id,taskId,occurrenceId,revision,at,state,deliveredAt)` хранится в Room. Сейчас task reminder ID — `$taskId:0`, то есть один reminder на задачу; множественные reminders и recurring occurrence модель полного продукта ещё не реализованы. PendingIntent identity включает opaque scope/id/action в URI, extras содержат scope/id/revision; intents explicit/immutable.

`setExactAndAllowWhileIdle` используется при разрешённом exact-alarm доступе; иначе `setAndAllowWhileIdle` с честным приблизительным статусом. Delivery проверяет scope, revision, pending, task done/deleted, актуальную task revision и permission/channel. Room conditional transition и one-process Mutex подавляют повтор/stale races; receiver не ждёт сеть. Notification обезличена; действия открыть, выполнить, отложить10min, отключить работают с IDs/revision.

Restore вызывается на старте приложения и системными receivers. До первого unlock credential-encrypted storage недоступно; device-protected копии личного содержимого нет. Просроченные сигналы не воспроизводятся лавиной. Между DB commit и AlarmManager side effect нет общей системной транзакции: старт/restore исправляет доступное pending расписание, но crash recovery во всех точках ещё не испытан. Несколько процессов не поддерживаются этим Mutex-контрактом.

Task/habit/daily-goal/achievement channels созданы со стабильными IDs, sync channel тихий. Планирование привычек и дневной цели, quiet hours и полностью управляемые пользовательские звуки ещё не реализованы. Существование channel не равно delivery. DND, force stop, выключенный телефон и системный запрет не обходятся. Аппаратное испытание task reminder находится в работе; здесь оно не отмечено PASS заранее.

## Авторизация и сервер

`AuthPanel(app)` предоставляет только явные действия. Последовательность: GET session → CSRF-protected POST native challenge → Credential Manager Google button → POST ID token → verified server identity. Нет автоматического login при открытии панели. Challenge определяет serverClientId/nonce; HTTP-клиент допускает лишь fixed HTTPS origin и четыре session/auth пути, отвергает redirects. Generation guard не позволяет позднему response обновить новую session/UI. Logout сначала очищает local credential, затем пробует revoke прежней server session; неудача server revoke сообщается отдельно.

Стабильные Android dependencies в интегрированной сборке: Credentials/credentials-play-services-auth **1.6.0**, Google ID **1.1.1**. Проверенная более новая Google ID1.2.1 потребовала Kotlin metadata2.4, несовместимую с текущим Kotlin2.2; выбрана поддерживающая нужный button flow stable1.1.1, проверка metadata не выключалась. Более ранние audit-заметки с рекомендацией1.2.1 описывали discovery, а не окончательную build-конфигурацию.

В PHP локально добавлены `server/src/native-auth.php` и routes native challenge/token в существующем API. Сохранены browser OAuth и CSRF helpers; identity проходит прежний `genesisUpsertGoogleUser`, чтобы не создавать другой binding по email. JWT RS256 проверяется OpenSSL по доверенному фиксированному Google PEM endpoint; `iss/aud/exp/iat/nonce` проверяются; challenge одноразовый. Portable PHP8.3.35: syntax/44 standalone checks PASS; independent security review и HTTP tests обязательны перед публикацией. Подробный контракт/ограничения — `AUTH_PROTOCOL.md`; console/signing действия — `MANUAL_STEPS.md`.

Текущий web workspace `keyMode=account` использует server escrow: backend хранит зашифрованный ключ и выдаёт его подтверждённой сессии. Это не zero-knowledge E2EE. WorkspaceCipher совместим с AES-GCM форматом, но live bootstrap/key import ещё не выполнены. Google Calendar/Tasks grants отделены от identity и остаются серверной интеграцией; Android получает одноразовый server auth code через AuthorizationClient, а token exchange и хранение refresh token выполняет backend.

## Что ещё не является синхронизацией

OutboxRecord с `state="local"` фиксирует локальные изменения; он не отправляется на backend. Пока нет полного web schema adapter, `workspace-sync-state.ts` merge, CAS retry, tombstone roundtrip, conflict UI, WorkManager transport и account/session-scoped queue invalidation. Зависимость WorkManager в Gradle не означает наличие рабочего sync worker. FCM configuration, registration/sender и remote-change pipeline не реализованы.

Без сети доступны известные локальные записи/расписание. Новое изменение сайта не может появиться на устройстве без будущей sync-интеграции. Не существует второго Android→Google exporter, Firebase Auth или отдельной production-БД.

## Ресурсы и проверка

Gradle Sync task копирует разрешённые публичные оригиналы в generated assets без перекодирования. `android/tools/verify-assets.mjs` сверяет исходник/копию/распакованный APK entry. Текущий `ASSET_MANIFEST` фиксирует 527 selected originals byte parity PASS для своего APK, но visual slots частичны; отдельно перечислены31 невыбранный media file и неподдержанные/неперенесённые SVG/compositions. Карточки Стойхейона,14 элементов Теокиклоса и rank artwork не объявлены пользовательскими экранами только из-за packaging.

Итог интеграции: debug/AndroidTest APK build PASS, 50 JUnit PASS (включая 11 tracker tests), lint 0 errors / 37 warnings. Native task/habit/mood UI, settings persistence и ограниченный набор notification device tests PASS; точная область — DEVICE_TESTS.md. Проверки не заменяют полный privacy/reboot/release matrix. Сводные команды, актуальный APK SHA/signature и следующий шаг находятся в `STATUS.md`; все отсутствующие сценарии — в `PARITY_MATRIX.md`. Публичный download CTA/release manifest/App Links не активированы; существующий GitHub→Beget workflow не заменён.
