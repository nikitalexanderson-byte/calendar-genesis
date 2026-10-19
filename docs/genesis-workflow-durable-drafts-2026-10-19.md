# G3: черновики настроек после reload и cold offline

Основание — master `199ad11`, опубликованный PR #204 с доступом к настройкам из архива/корзины. [Аудит до реализации и core checkpoint](genesis-workflow-drafts-audit-2026-10-19.md). Этот срез завершает отдельный веб-остаток G3 по durable draft; G1 planning переносится следующим этапом. Весь G3 остаётся частичным до native, дальнейших зависимостей и общей приёмки.

## Поведение

Изменения workflow сохраняются зашифрованными на этом устройстве. После закрытия редактора, reload и холодного offline открытия пользователь явно выбирает сохранённую копию. Предложенные лимиты, обязательные поля, переходы, нулевое значение лимита и исходная версия сохраняются. Восстановление не отправляет workflow PUT и не переносит черновик на новую версию автоматически.

Offline копия имеет отметку и время последнего серверного контекста. Отправка заблокирована до подключения и свежего чтения ACL/config/status catalog. Старое manageProjects в сохранённом документе не выдаёт право отправки. Изменение календаря или языка не создаёт workflow-событий; язык не сбрасывает выбранные значения.

Перед PUT сохраняется точный pending command/requestId. Потерянный успешный ответ можно восстановить после reload: явный повтор использует прежний requestId и серверный receipt, без дополнительной версии. После подтверждения удаляются только собственная запись и неизменившаяся исходная копия. Если её изменило другое окно, compare-and-swap сохраняет новую копию.

Каждый editor mount получает отдельный writer. Две вкладки сохраняют независимые предложения. На отмене текущего редактирования исходная восстановленная копия остаётся доступна; удаление отдельного черновика является явным действием. Лимит journal — 20 записей на user/project/purpose и 2000000 UTF-8 bytes на payload; реальная browser quota может быть меньше. Превышение показывает ошибку, сохраняя прежние байты и текущий текст в открытом редакторе. Сохранение нельзя выдавать за успешное, пока crypto/storage не подтвердили запись.

Повреждённая/неподдерживаемая копия не перезаписывается. Пользователь может скачать её исходные байты и удалить эту запись отдельно. Автоматической очистки или исправления документа с потерей данных нет.

## Приватность и совместимость

Используется существующий private workspace key, AES-GCM и session guard. User/project/purpose/writer и metadata проверяются при чтении; поздняя crypto после sign-out не возвращает запись. Namespace входит в существующую очистку приватных данных при выходе. Это локальные копии, а не новый синхронизируемый тип проекта или часть server backup.

Cache содержит только нужные этому редактору project identity/permissions, status catalog, названия/архивность определений полей, config и counts. Задачи, значения полей, участники и варианты полей в него не добавляются. Формат проверяется без молчаливого rebase/нормализации незавершённой правки. Поддерживаются revision0, WIP0, пустой промежуточный набор ролей и пустой PHP counts array. Отправленная команда проверяется строже незавершённого черновика.

Родительские окна имеют key с userId/projectId. API, SQL schema, receipts и writer protocol не меняются; production остаётся protocol6. Android 2.9.0/95 не переиздаётся. Runtime secrets и production DB вручную не менялись, ручной SSH не применялся.

## Проверки

- Frozen install, полный lint (0 ошибок, 2 прежних img warnings), 339/339 tests с полным i18n audit и build:beget успешны. После корректировки определённого отказа и account keys повторены target lint, 339 tests и сборка. Precache: 90 mandatory entries, 203 visual assets; largest JS 349901 bytes. Общий tsc сохраняет 9 прежних диагностик; новых в изменённых файлах нет.
- 13 целевых model/sign-out tests: настоящая AES-GCM, отсутствие plaintext, wrong scope/user/purpose, две вкладки/CAS, порядок async writes, сохранение snapshot до мутации input, pending identity, sign-out/dispose во время crypto, quota/corruption/лимиты, строгий формат, stale/unfinished draft без rebase, 30 статусов и 200 определений полей. Эти тесты не подменяют browser flows.
- Chromium → HTTP → PHP → SQLite: закрытие/повторное открытие и reload сохраняют WIP0/7 и обязательное описание; восстановление делает 0 автоматических workflow PUT. Cold offline проверен настоящим собранным service worker в отдельном профиле: локальный harness регистрирует его явно, поскольку приложение намеренно отключает автоматическую регистрацию на localhost. Нулевой лимит сохраняется, отправка offline отключена, после подключения нужен свежий read, автоматической отправки нет.
- Реальный committed response потерян до клиента; после reload/явного retry сделаны 2 PUT с одним requestId и добавлена ровно 1 версия. Pending copies после подтверждения удалены.
- Две реальные вкладки сохранили предложения5 и6 без перезаписи. Browser quota оставила прежний raw storage и текущий текст9. Повреждённые байты сохранены и скачаны точно, отдельное удаление выполнено кнопкой. После downgrade admin→guest восстановление прежнего draft не включило отправку; текущие серверные permissions остались read-only. Роль synthetic участника восстановлена в finally.
- Отдельный live WIP rejection не добавил версию и не заблокировал исправление; повтор с допустимым лимитом добавил ровно1 версию.
- 30 locale/visual cases: 14 языков с настоящей quota ошибкой, сохранение значений0/11 и всех новых runtime labels; catalog и restored editor в обеих схемах ×360/390/768/1440. Overflow0, touch targets≥44px. Before baseline — финальные снимки предыдущего PR #204 с той же исходной реализацией; 16 after PNG и отдельный JA quota capture сохранены. Бесконечной косметической полировки не выполнялось.

Доказательства: `output/workflow-durable-{install,lint,tests,build,final-target-lint,final-tests,final-build,final-types,model-final}.log`; `output/playwright/workflow-durable-{initial,offline,replay,boundaries,rejection,visual}-result.log`, durable PNG и `workflow-draft-recovery-original.json` (synthetic corrupt bytes). Серверные модели workflow/receipt/WIP проверены в предыдущем PR #204; серверный код в этом срезе не изменён.

## Открытые состояния

Не проверены Safari/Firefox, физическое Android-устройство, screen reader,200% zoom,20 полных device records в браузере и forced browser/process crash. Logout/поздняя crypto покрыты model/session guard и прежними sign-out regression, отдельный новый browser logout в этом срезе не заявляется. Native UI, G1 cold-offline lifecycle, последующие C/B/G-интеграции и общие K/U/L остаются открытыми. Счётчик открытых функциональных ID остаётся21.

Rollback — git revert через существующий deploy workflow. Нового database rollback не требуется; локальные записи сохраняют собственную версию и не входят в server migrations.
