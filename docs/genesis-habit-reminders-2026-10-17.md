# E2 — фоновые напоминания привычек, 17.10.2026

## Состояние

Выпущен 2.8.12/92: [PR #185](https://github.com/nikitalexanderson-byte/calendar-genesis/pull/185), master/production `d4b517b794876820ae02ea94b04756f71c52e124`. E1 опубликован в PR #184, 2.8.11/91. E3–E5/F/C/G и остаточные B/K/U/L остаются обязательными. Штатный [CI 39000474521](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/39000474521) завершён успешно; SHA/health, официальные APK/AAB и Realme проверены.

Аудит: старый web `window.setTimeout` работал только при открытом приложении. Service worker сам по себе не сохранял расписание. Native AlarmManager уже переживал закрытие UI, но быстрое действие не адресовало точную привычку/день.

## Реализация

- Android сохраняет AlarmManager/WorkManager и boot/time/timezone recovery. Target содержит scope, habit ID, исходный гражданский день, UTC occurrence, rule ID и отдельный интервал. Действие повторно проверяется в Room transaction. Доступная бинарная/интервальная отметка идемпотентна; количество, длительность и качество требуют ввода. Старый день не превращается в сегодняшний.
- Устойчивое native «Отложить» хранит исходный target и отдельное время. Повтор request идемпотентен; соблюдаются день правила, тихие часы, budget. Лимит 4/12/24/64/128 в день и snooze 5/10/15/30/60 минут принадлежат устройству.
- Web: отдельный сознательный opt-in в существующих настройках привычек. UI показывает permission, готовность сервера, устройство, срок подготовленного расписания и ограничения браузера/ОС. Общие проекты не являются условием. Отключение личного канала сохраняет подписку общих дел.
- Переключатель дневной цели теперь назван «Напоминание о дневной цели»: индивидуальные привычки остаются независимыми. Сохранены мотивационные сообщения, спокойный/героический/ироничный тоны, время и 14 языков.
- Открытая вкладка использует UTC fallback только при отсутствии подтверждённого действующего фона. Общий worker receipt исключает второй показ fallback/push. Перед показом проверяются quiet/цели/правила/Google mirrors.
- Push содержит только канал и delivery ID. Worker проверяет текущий доступ, хранит receipt и минимальный scoped intent. Быстрое действие выполняется после открытия/разблокировки актуального workspace. Explicit input сохраняется через существующую encrypted очередь и показывает исходную дату; дата «Сегодня» не меняется.
- Сбой первой загрузки notice/worker intent сохраняет запрос и кнопку «Повторить». ACK следует после обработки. Logout снимает серверное устройство и локальные intent/receipt/ID пользователя; permission revoke проверяется при возвращении и периодически.

## Приватность, фон и совместимость

Web/native adapters строят одинаковую проекцию из окончательно объединённого документа перед encrypted PUT, только после отдельной проверки consent. Optional projection failure не блокирует личное сохранение.

Проекция: opaque ID, UTC, исходная дата/IANA-пояс, действие, язык/тон и quiet metadata; без titles/notes/diary/значений. Горизонт до 45 дней/2048 строк. До 256 последних прошедших строк сохраняются для snooze, остальная ёмкость — ближайшее будущее. Dense plan сокращает видимый срок. Учитываются DST gap/overlap, соседние civil dates, реальные режимы/дни отдыха daily goal, достигнутые period goals и Google mirrors.

Отдельные auth/CSRF endpoints `habit-reminders/*`: status, consent/revision устройства, workspaceVersion-checked plan, current delivery access, snooze. Revision tombstone после disable не позволяет позднему enable вернуть канал. Plan/subscription/target зашифрованы в SQLite; строгий whitelist запрещает лишнее содержимое.

Аддитивная миграция 068 не включает устройства автоматически и сохраняет envelope/history/protocol. Старый writer без projection сохраняет данные обычным способом, но фон получает needs-refresh и устаревшие jobs отменяются. Malformed optional projection обрабатывается через savepoint с тем же результатом. Writer protocol E1 версии 5 сохраняется.

Существующий cron/queue: стабильный receipt при refresh, revival действующего cancelled job, sent не отправляется вновь. Сеть вне SQLite writer lock, ack по текущему lease; concurrent/retry/ambiguous attempts резервируют budget. Access снова проверяет consent/expiry/quiet/current event. Bounded maintenance отменяет expired profiles и удаляет opaque receipts старше семи дней.

## Подтверждённые проверки

- Frozen install, полный lint (0 ошибок, два прежних img warnings), `pnpm test` **298/298** с i18n, `build:beget` прошли. Largest chunk 349901 bytes, лимит 350000 не изменён.
- Web/domain/worker: общие native vectors UTC/Berlin DST/Honolulu/Kathmandu/rest day, privacy/cap/dense overdue, exact actions/XP, explicit quantity/interval/quality; concurrent/restart receipts, revoked access, fallback reservation, show failure, scoped intent/ACK, snooze retry.
- PHP в изолированной SQLite: habit-reminders, habit-reminders-migration, workspace-writer, shared-notifications, RFC Web Push. Backup/history/protocol, old writers, encryption/whitelist, consent/revision races, lease replacement и invalidation во время network, frequency, reschedule/revival, expiry/pruning. Без внешних сообщений.
- Полные native JVM/lint прошли (0 errors/130 прежних lint warnings). После последней pure-model cap correction повторно прошли 12 projection/action/plan tests. Общие web/native vectors совпадают.
- Realme RMX5000/Android 16, изолированный debug scope: два действия уведомления; точные ID/day/scope, binary/XP idempotence, stale read-only, explicit quantity и одна запись. Отдельный snooze test прошёл: quiet refusal, настройки/target persistence, retry request, AlarmManager recovery, account/stale guards и daily budget. Синтетические настройки восстановлены, тестовые привычки приостановлены; production-данные не затронуты.
- Chromium: consent/disable, три тона, частота/snooze, network retry. Settings и input в обеих схемах × 360/390/768/1440 без overflow. При закрытом UI real worker обработал CDP-injected push; фактические вызовы showNotification подсчитаны, duplicate один. Injected click прошёл через real listener/intent в app; binary/replay и quantity/offline reload прошли. Это не physical OS click и не provider-to-OS доказательство.
- Ещё семь browser checks: direct 503/missing worker intent, повтор без reload, ACK после обработки; четыре recovery captures на 390/1440 обеих схем. Finish reviewer единственный retry finding оценил **resolved**; ship относится к нему. Documenter проверил токены/компоненты; PRODUCT/DESIGN/sidecar побайтно сохранены. Существующий STANDART/Universal UI сохранён.

Evidence в игнорируемом output: e2-full-{lint,tests}.log, e2-php-final-tests.log, e2-native-full-checks.log, e2-native-final-models.log, e2-realme-actions-current.log, e2-realme-snooze.log, playwright/e2-browser-{connect,actions-clean}.log, playwright/e2-receive-retry.log. Before/after/settings/input: playwright/e2-*.png.

Native current captures — portrait RemoteViews/Compose harness, не full production flow. Settings captures до последнего уточнения названия daily-goal switch; background section не менялась. Диагностический fetch wrapper испортил старую изолированную browser session; проверки повторены в чистой genesis-e2. Production не затронут.

Не проверены Safari/Firefox/iOS, physical browser OS banner/click, screen reader, native tablet/landscape/font scaling, production subscription пользовательского аккаунта, два физических устройства и визуальная матрица всех переводов. Полный tsc имеет прежние посторонние ошибки и не объявляется прошедшим. PRODUCT .ru/theme-family sidecar drift отмечен без ремонта.

## Публикация и откат

Только commit/push/merge master → существующий deploy.yml → SHA/health → официальный APK/AAB hash/signature → Realme install -r. Единственный Hostinger root: /home/u531952483/domains/genesiscalendar.com.

Production Web Push до E2 не настроен. После CI запускается scripts/configure-hostinger-web-push.ps1 через SSH: server-only P-256, сохранение валидного ключа, закрытая config backup, atomic 0600 replacement и readiness. Приватный ключ не покидает сервер; скрипт не меняет БД/не отправляет сообщений. SMTP 2.8.9 сохраняется. Затем health и естественный cron подтверждают runtime.

CI перед миграцией сохраняет config и согласованную SQLite backup. Изолированный migration test проверил старые envelope/history/protocol и отсутствие auto-subscriptions. Code rollback — revert выпуска в master и CI; аддитивные таблицы остаются инертными. Database restore не выполняется автоматически, требует отдельного плана/согласования. Production-БД вручную не меняется.

## Результат публикации

Source a48635eb550defcc4bc94e734715d2549fcaef3a. Production deploy-meta совпадает с master, API health успешен. Официальный APK c46e6aefb5173756c8d0876747ce7832530d92e16c2cef8138b92236003788cc проверен по SHA256, сертификату и package/version; AAB также проверен по SHA256. APK установлен install -r на Realme, версия 2.8.12/92 и запуск подтверждены; аккаунт, данные, вечерняя схема, сакральный режим и «Сегодня» сохранены. Внешняя provider-to-OS доставка и физический браузерный notification click не заявляются.

SSH использован для закрытого VAPID runtime installer. Ключ создан только на сервере, config backup сохранена, private key не выводился; SMTP не менялся. Первая CLI readiness-проверка завершилась без вывода после настройки ключа из-за ненужного запуска HTTP-session bootstrap. Stateless проверка повторно сохранила уже действующий ключ и подтвердила available=true; исправление installer перенесено в текущую Git-ветку. Health подтверждает email/push available=true; GET личного статуса без сессии даёт401, worker JS опубликован с правильным MIME. Естественный cron 2026-10-17T04:30:01Z отработал после настройки. Ручных изменений production-БД и тестовых внешних отправок не было. Evidence: output/e2-production-verification.json, e2-production-push-confirm.log, e2-official-install.log, realme-2.8.12/.
