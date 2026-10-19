# G3: durable drafts — аудит следующего этапа

Основание — свежий master `199ad11` после PR #204. Публикация #204 подтверждена: workflow39196115450 attempt1 success, production SHA/health/assets и Android metadata2.9.0/95 сохранены. Следующий этап начинается с существующего редактора workflow; G1 planning переносится отдельно после проверки этой основы.

Сейчас draft и pending request находятся только в React/ref. Reload теряет оба; после потерянного ответа закрытие окна теряет requestId, хотя сервер уже мог сохранить настройки. GET workflow не использует encrypted shared offline cache. У существующего cache всего 12 entries и mutable глобальный индикатор последнего offline read: добавлять туда ещё один экран без собственного результата свежести недостаточно для честного восстановления.

Переиспользовать session guard и AES-GCM персонального ключа через узкий адаптер. Содержимое workflow draft, pending command и сохранённый контекст нельзя писать открытым текстом. Разделять пользователя, проект и writer каждого окна. Дубликат вкладки получает новый writer ID; восстановление чужого локального writer не должно перетирать ещё работающую вкладку.

Сначала реализовать и проверить локальный journal: последовательные записи, session checks до/после crypto, точный pending requestId до отправки, CAS удаления восстановленной записи, сохранность прежних байтов при quota/corrupt data. Затем подключить один UI: список/восстановление/удаление черновика, отметка сохранения на устройстве, cached context только для offline чтения, явное обновление/rebase и явный retry прежнего requestId. Восстановление не отправляет запрос автоматически.

При 401/403/404 очищать разрешённый к отображению контекст; encrypted unsent draft не становится доказательством текущих прав. Offline блокирует writes; возврат сети требует свежих ACL/config/status catalog до нового сохранения. Retry уже отправленной команды сохраняет прежний receipt identity и тоже проверяет текущие права на сервере. Добавить namespace в очистку личных данных при выходе, чтобы поздняя encryption не восстанавливала данные после sign-out.

Проверки: reload/cold offline, две вкладки, переключение/выход аккаунта, revoke, quota/corrupt envelope, конкурентная версия, потерянный committed response и повтор без новой версии, отсутствие plaintext. Далее 14 языков, обе темы ×4 ширины, install/lint/test/build и штатная публикация. Никакой новый writer protocol или SQL migration не обоснованы. Этот аудит и core checkpoint сами по себе не закрывают G3 и не означают готовую UI-функцию.

## Первый core checkpoint

Добавлен не подключённый к UI `SharedWorkDraftJournal`: зашифрованный actor/project/purpose/writer scope, metadata authentication, последовательные снимки входа, compare-and-swap удаления и сохранность прежних байтов при quota/corruption. Ограничения первого journal — 20 записей на scope и 2000000 UTF-8 bytes на payload; превышение явно отклоняется без удаления старых записей. Namespace добавлен в очистку приватного хранилища при выходе.

Семь behavioral tests используют настоящую AES-GCM криптографию: reload с прежним pending requestId без plaintext; изоляция и подмена user/project/purpose; две вкладки и CAS удаления; асинхронный порядок и snapshot до мутации input; sign-out во время crypto; quota/corrupt recovery; ограничения; закрытие редактора во время crypto. Вместе с двумя существующими sign-out tests проходит 9/9. Targeted lint успешен; общий tsc сохраняет 9 прежних диагностик, новых в journal/sign-out нет. Доказательства: `output/workflow-draft-journal{,-lint,-types}.log`.

Следующая работа — строгий формат содержимого workflow draft, подключение приватного адаптера и одного UI с явным восстановлением/повтором, cached context и свежими ACL. Текущие tests проверяют journal, а не готовый browser cold-offline сценарий. Этот checkpoint не публикуется на master отдельно от законченной UI-приёмки.

Следующий web checkpoint реализовал и проверил этот UI: [приёмка durable workflow drafts](genesis-workflow-durable-drafts-2026-10-19.md). Cold offline, реальные receipt/retry, два окна, quota/corrupt recovery, актуальные ACL,14 языков и обе схемы ×4 ширины подтверждены; историческое описание core выше сохраняется как этап до интеграции.
