# Фюзис — контракт первой web-версии (24 октября 2026)

## Обследование и решения

- Web: `beget/main.tsx`, `app/GenesisCalendar.tsx`; React 19/Vite, существующий GENESIS Universal UI. Настройки: `app/AccountPanel.tsx`. Новый интерфейс загружается отдельно после серверной проверки доступа.
- Android: самостоятельный Kotlin/Compose-клиент в `android/app/src/main/java/ru/genesis/calendar`. Его исходники, ресурсы и сборка не меняются. Native Google-вход — отдельный `/auth/google/native`. Проверен опубликованный APK 2.9.7/102: launcher — `MainActivity`, старый `BrowserLauncherActivity` не зарегистрирован. Нативная cookie-сессия и маршруты отделены от браузерных; Фюзис разрешён только подтверждённым web-сессиям. Внешняя браузерная ссылка из приложения открывает именно сайт. Доказательства: [physis-browser-access.md](physis-browser-access.md).
- API: `server/public/api/index.php`; PHP/PDO SQLite; миграции `server/migrations`, существующий session cookie + CSRF. Новый namespace `/api/physis/v1`, без подключения к Google Calendar, общим делам и Android bootstrap.
- Дни: `app/calendar-context.ts` — ISO civil date, `addCivilDays`, IANA timezone, `resolveCalendarWallTime`. Отображение: `app/calendar-data.ts` и `CalendarDatePicker.tsx`; sacred/lunar/profane остаются адаптерами тех же записей. Исторический локальный день факта фиксируется отдельно от timestamp и не меняется при смене timezone.
- Существующий `app/cloud-sync.ts` шифрует workspace AES-GCM, но поддерживает account/legacy/client режимы и постоянный device key. Серверное `genesisEncrypt` — sodium secretbox с серверным ключом. Поэтому эти режимы нельзя без оговорок называть E2EE и нельзя использовать для строгих требований Фюзиса.
- Фюзис открывается общим аккаунтом GENESIS без отдельного пароля. Vault v2 оборачивает случайный ключ записей общим workspace key через personalDocumentAccess. Старый populated v1 переносится с прежним ключом после однократного ввода старого пароля/кода; пустой v1 переводится автоматически через атомарный rotate. См. [актуальный контракт](physis-api.md).
- Сервер видит owner, случайные ID, revision/cursor, key/schema versions, ciphertext lengths, времена изменения/удаления и wrapped key; kind, даты тренировок, ссылки на продукты/лекарства и содержимое находятся внутри ciphertext. Ключи/plaintext не записываются в browser storage. `public/sw.js` уже исключает `/api/` из кэширования.
- Все операции проверяют server flag, общую primary Google-сессию и точный email аккаунта: nikitalexanderson@gmail.com, jurijjlogvinov@gmail.com, picishina@gmail.com. Старые валидные сессии сайта допускаются без повторного OAuth; explicit native и linked sessions запрещены. Данные каждого владельца изолированы.

## Контракт между компонентами

`app/physis/types.ts`: `PhysisRecord<T>` хранит `id`, `kind`, `schemaVersion:1`, `createdAt`, `updatedAt`, `source`, `data`. `PhysisStore` выдаёт расшифрованные records и `save(record)`, `saveMany(records)`, `remove(id)`, `reload()`. Все записи атомарного batch проходят optimistic concurrency. UI не обращается напрямую к хранилищу, не кладет данные в localStorage и не добавляет analytics.

Домены: training (`exercise`, `program`, `assignment`, `session`), nutrition (`food`, `recipe`, `meal`, `nutrition-profile`, `diet-template`), care (`drug`, `regimen`, `intake`, `measurement`), `settings`. Сложная программа/назначение хранится единым зашифрованным агрегатом; сессии — независимые агрегаты. Взаимные ссылки проверяются доверенным клиентом. Snapshot внутри факта защищает историю от изменения справочника.

## HTTP v1

Все ответы private/no-store; mutation требует X-CSRF-Token и JSON. Не использовать серверные endpoints существующих публичных sharing/export для Фюзиса.

- `GET /access` → `{available:true, ownerId, csrf}`; недоступный/неподтвержденный/чужой channel → одинаковый 403.
- `GET /vault` → `{vault:null|Vault, revision}`.
- `PUT /vault` → `{expectedRevision,requestId,vault}`; atomic CAS. Новый vault: `{version:2,keyVersion,account:{iv,ciphertext}}`. Формат v1 поддерживается для переноса. Смена ключа данных выполняется атомарным `/rotate` с проверкой revision/cursor и всех активных записей.
- `GET /records?after=cursor&limit=100` → `{records:[{id,revision,sequence,updatedAt,deletedAt,envelope}],cursor,hasMore,minCursor}`. Без `after` — полная пагинированная сверка с `page` (sequence cursor); изменение во время чтения обнаруживается через snapshot revision. Слишком старый delta cursor → 409 `PHYSIS_RESYNC_REQUIRED`, без слияния устаревшего снимка.
- `POST /records` → `{requestId,changes:[{id,operation:'create'|'update'|'delete',expectedRevision,envelope?}]}` → `{records,cursor}`. `create` не является upsert; update отсутствующего/удаленного ID отвергается. Дубликат requestId с тем же body возвращает прежний ответ; иной body → conflict. Все изменения batch в одной транзакции.
- Envelope `{version:1,schemaVersion:1,keyVersion:1,iv,ciphertext}`. ID — UUID. Домен/kind внутри шифротекста.
- Tombstones/receipts: 90 дней; minCursor двигается при очистке, полная сверка обязательна. Старый update никогда не создает запись. Создание удаленного ID предотвращается компактным реестром ID (только случайный ID/owner, без содержимого) либо иной проверяемой схемой generation.

Будущий отдельный клиент получает только Physis API; выдача OAuth scoped tokens, Google Health, Health Connect, HealthKit, Garmin и Health Services пока только контракт, не подключение. Внешние запросы за пользовательскими данными не выполняются.

## UI

Режим Operate, существующие зелёные/золотые токены STANDART, serif заголовки и обычные поля. Сначала обзор и открытая тренировка; ровно три главные группы и шесть вложенных пунктов из задания. Метрики — обзор и настройки. Значимые действия имеют подпись; 44 px touch targets, один поток на mobile. Ключевой сценарий: начать → подходы → сохранить → завершить → календарь. Автосохранение хранит несинхронизированное только в памяти, с честным предупреждением при уходе. Конфликт не перезаписывается молча.

## Выпуск/откат

Аддитивная миграция не меняет старые таблицы данных. Existing deploy.yml делает runtime backup config/SQLite. После проверки APK и серверной границы пользователь поручил включить браузерный пилот; Git-controlled `GENESIS_PHYSIS_WEB_ENABLED=true` задаёт default, явный `physis_enabled=false` в server config отключает его. Отключение не удаляет ciphertext. Code rollback через git revert; schema/данные остаются для последующего forward-fix. Production-БД вручную не восстанавливается.
