# Play Console — фактическая проверка и сохранённые изменения

Дата: **30 октября 2026**. Приложение: Genesis Tasker, пакет `ru.genesis.calendar`. Этот отчёт объединяет историческую неуспешную попытку доступа через внешний Chrome и последующее чтение/изменение Console основным агентом через IAB. Имя файла сохранено для существующих ссылок; после описанного ниже Save проверка уже не является только read-only.

Источник актуальных Console-фактов — наблюдения основного агента в IAB. Агент, подготовивший этот отчёт, повторно Console не открывал и формы не менял. Адреса аккаунтов, тестовые учётные данные и private Console IDs не включены.

## Подтверждённое состояние Console

| Проверка | Фактический результат чтения через IAB |
| --- | --- |
| Closed testing — Alpha | **3.1.2 / 119**, `Available to testers on Google Play`, **Full rollout**, **178/178** регионов. |
| Production | **Inactive**; **11 opted-in** тестировщиков; `Apply for production` отключена. Отображено требование не менее **12** opted-in тестировщиков непрерывно **14 дней**. Начало Production остаётся BLOCKED этим условием. |
| App content | При чтении раздела показано **11 Actioned**; `Need attention` пуст. |
| Ads | **Yes, my app contains ads**. Эта форма основным агентом не изменялась. |
| Health | Выбраны **Sleep management** и **Stress management, relaxation, mental acuity**. Эта форма основным агентом не изменялась. |
| Data safety: вход | **OAuth**. |
| Data safety: шифрование при передаче | **Yes**. |
| Data safety: URL удаления аккаунта | [https://genesiscalendar.com/delete-account](https://genesiscalendar.com/delete-account). |
| Data safety: URL удаления данных | [https://genesiscalendar.com/delete-account](https://genesiscalendar.com/delete-account). |
| Privacy policy | [https://genesiscalendar.com/privacy](https://genesiscalendar.com/privacy). |

Статусы Actioned и отсутствие Need attention фиксируют состояние Console. Сверка отдельных ответов с исходниками и её ограничения находятся в [data-safety-code-review.md](data-safety-code-review.md). Записанный в форме URL не подтверждает успешное выполнение удаления в production.

## Data safety: исходная декларация

Исходный набор передан основным агентом после чтения Console и сохранён в code review. Перечисленные ниже категории при корректировке Files and docs не изменялись:

- **Collected:** Name, Email address, User IDs; Approximate location; Other in-app messages; Photos; Voice or sound recordings; Health info; Contacts; Calendar events; App interactions; Other user-generated content; Device or other IDs.
- **Shared:** Approximate location; Voice or sound recordings; Calendar events; Other user-generated content.
- **Не выбраны в исходной форме:** Files and docs, Videos, Fitness info, Financial info, Crash logs/Diagnostics.

Последняя строка описывает состояние **до Save**. Files and docs впоследствии добавлены, как указано ниже. Videos, Fitness info, Financial info и Crash logs/Diagnostics в этой операции не менялись. Этот отчёт не пересматривает применимость всех остальных категорий.

## Сохранённая корректировка Files and docs

**30 октября, около 13:20 MSK**, основной агент изменил только категорию **Files and docs**:

| Поле | Сохранённый ответ |
| --- | --- |
| Collected | **Yes** |
| Shared | **No** |
| Ephemeral processing | **No / non-ephemeral** |
| Сбор обязателен или пользователь может выбирать | **Optional** |
| Purpose | **App functionality** |

Перед сохранением Preview показал добавление только собираемых **Files and docs**. После нажатия **Save** Console показала:

> Change saved. Send for review in Publishing overview.

Доказательство сохранено в игнорируемом QA-файле [play-data-safety-saved.jpg](../../../outputs/v313/play-data-safety-saved.jpg); изображение и его содержимое не включены в tracked report. Основание корректировки — подтверждённая в [code review](data-safety-code-review.md) передача серверу PDF/Office/текстовых вложений общих задач.

**Изменение сохранено, но на Google review не отправлено.** Действие `Send for review` в Publishing overview не выполнено. Это не подтверждение одобрения декларации Google и не публикация новой версии приложения. Другие формы Console основной агент в этой операции не менял.

## Read-only проверка App access и Play app signing

**30 октября, 11:38 UTC**, основной агент через IAB прочитал текущую форму **App access** и страницу **Manage Play app signing**. Формы в этой операции не менялись. Кнопка перехода наблюдалась в цепочке `Protected with Play → Show details → Play Store protection → Manage Play app signing`.

App access содержит **Yes / restricted**, заполненные dedicated Google username/password, английские инструкции `Sign in with Google` с выбором отдельного аккаунта и отмеченный **full access**. Реальный вход с этими данными **NOT RUN**. Содержимое credentials в отчёт не включено.

| Сертификат в Console | SHA-256 | SHA-1 |
| --- | --- | --- |
| Play app signing key | `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8` | `9a28ae70b1933d86ff3a4ef931e924f81a4426bc` |
| Upload key | `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8` | `9a28ae70b1933d86ff3a4ef931e924f81a4426bc` |

Оба поля Console совпали друг с другом и с actual signer подписанных APK/AAB candidate7. Проверка копированием fingerprints подтверждает эти настройки; Play-доставленный APK, его происхождение и cold Google login всё ещё **NOT RUN**. [Сводка без credentials/private URL](../../../outputs/v313/signed-candidate7-validation/console-signing-reviewer-summary.json) содержит hash исходного локального evidence. Скриншот и исходный JSON находятся в игнорируемых QA-файлах; private Console URL не перенесён в этот отчёт. Остальные reviewer/signing gates: [play-reviewer-signing-gates.md](play-reviewer-signing-gates.md).

## Что ещё не выполнено или не прочитано

| Проверка / действие | Статус этого среза |
| --- | --- |
| Upload APK/AAB 3.1.3 / 120 | **NOT RUN** — новые артефакты не загружались. |
| Замена скриншотов карточки | **NOT RUN** — новые скриншоты не загружались; запрос пользователя остаётся открытым. |
| Текущий набор default/localized store assets | **NOT RUN** — этим чтением не подтверждён. |
| Send for review / Publishing overview | **NOT RUN** — сохранённая корректировка ещё не отправлена Google. |
| Google review / acceptance новой версии и декларации | **NOT RUN**. |
| Reviewer / App access | **READ-ONLY CONFIGURATION CONFIRMED** — заполненные credentials, Google sign-in instructions и full access прочитаны; actual login **NOT RUN**. |
| Content rating / возрастной рейтинг | **NOT RUN** — текущая форма не прочитана. |
| Текущие настройки стран вне подтверждённого Alpha rollout | **NOT RUN** — отдельные настройки не прочитаны. |
| Production release | **BLOCKED** — Production inactive, 11 opted-in и отключённая Apply; требование 12 тестировщиков / 14 дней не закрыто. |

Alpha 119 остаётся подтверждённой доступной версией этого среза. Из него нельзя выводить доступность 120 тестировщикам или публикацию Production.

## История: ограничение доступа через внешний Chrome

Ранее 30 октября попытка только для чтения не смогла получить актуальный UI. Browser Use не обнаружил доступных поверхностей (`apps=[]`, `browsers=[]`). Computer Use обнаружил два окна Chrome, но при получении состояния выбранного окна остановился:

> Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy.

В той попытке ввод и управление интерфейсом прекратились; формы, Save, Publish, Upload и настройки не менялись, данные входа не запрашивались. Её исходный BLOCKED относился к конкретному доступу через внешний Chrome. Последующие факты из IAB и сохранение Files and docs описаны выше; исторический Chrome-блок не распространяется на них.

При подготовке этого отчёта production-БД, SSH, ADB и Gradle не использовались. Само редактирование отчёта не отправляет сохранённые Console-изменения на review и не публикует приложение.
