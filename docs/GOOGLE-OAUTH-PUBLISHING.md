# Публикация GENESIS с входом через Google

Эта инструкция рассчитана на человека, который впервые открывает Google Cloud Console. Она описывает текущую production-версию GENESIS на `https://genesiscalendar.ru`.

## Что уже подготовлено в приложении

- Обычный вход просит только имя, адрес электронной почты и идентификатор Google-аккаунта.
- Доступ к Google Calendar и Google Tasks запрашивается отдельной кнопкой уже после входа.
- Для Calendar используется узкий scope: GENESIS видит и изменяет только отдельный календарь, созданный самим GENESIS.
- Для Tasks доступ нужен для показа, создания, изменения, завершения и удаления задач по действиям пользователя.
- Google-токены хранятся только на сервере в зашифрованном виде. В браузер они не передаются.
- OAuth использует HTTPS, одноразовый `state`, PKCE и привязку разрешений к тому же Google-аккаунту.
- При удалении аккаунта GENESIS сначала отзывает Google-токен, затем удаляет данные профиля на сервере.
- В личном кабинете Calendar и Tasks можно отключить отдельно: токен будет отозван, а профиль останется.

## Значения, которые нужно подготовить

Скопируйте этот блок в отдельную заметку — значения понадобятся в Google Cloud Console:

| Поле | Значение |
| --- | --- |
| Название приложения | `GENESIS` |
| Главная страница | `https://genesiscalendar.ru/` |
| Политика конфиденциальности | `https://genesiscalendar.ru/privacy` |
| Условия использования | `https://genesiscalendar.ru/terms` |
| Поддержка | `https://genesiscalendar.ru/support` |
| Удаление аккаунта | `https://genesiscalendar.ru/delete-account` |
| Разрешённый домен | `genesiscalendar.ru` |
| Authorized JavaScript origin | `https://genesiscalendar.ru` |
| Authorized redirect URI | `https://genesiscalendar.ru/api/auth/google/callback` |
| Логотип | `public/icons/icon-512.png` из этого проекта |

Redirect URI нужно ввести в точности: без `www`, без дополнительного `/` в конце и только по HTTPS.

## Шаг 1. Выберите правильный Google Cloud project

1. Откройте [Google Cloud Console](https://console.cloud.google.com/).
2. В верхней панели выберите project, Client ID которого уже указан в закрытом production-файле `server/config.php`.
3. Не создавайте новый project, если не готовы одновременно заменить Client ID и Client Secret на сервере.
4. Откройте **IAM & Admin → IAM** и убедитесь, что у рабочего Google-аккаунта есть роль Owner или Editor.
5. Удалите из production-project старые тестовые OAuth clients, localhost redirect URI и адреса закрытых тестовых серверов. Для разработки лучше завести отдельный project.

Важно: Client Secret нельзя вставлять в GitHub, документацию, переписку, скриншоты или демонстрационное видео.

## Шаг 2. Подтвердите владение доменом

1. Войдите в [Google Search Console](https://search.google.com/search-console/) тем же Google-аккаунтом, который является Owner или Editor Cloud project.
2. Нажмите **Добавить ресурс**.
3. Выберите тип **Домен** и введите `genesiscalendar.ru`.
4. Google покажет TXT-запись. Добавьте её в DNS домена у регистратора или DNS-провайдера.
5. Дождитесь применения DNS и нажмите **Подтвердить**.
6. В Search Console у этого аккаунта должен отображаться статус подтверждённого владельца.

Подтверждать нужно именно домен `genesiscalendar.ru`, а не только отдельную страницу.

## Шаг 3. Включите нужные API

1. В Google Cloud Console откройте **APIs & Services → Library**.
2. Найдите **Google Calendar API** и нажмите **Enable**.
3. Найдите **Google Tasks API** и нажмите **Enable**.
4. Не включайте Gmail, Drive или другие API: GENESIS их не использует.

## Шаг 4. Заполните Branding

Откройте **Google Auth Platform → Branding** и заполните:

1. **App name:** `GENESIS`.
2. **User support email:** адрес, который вы регулярно проверяете.
3. **App logo:** загрузите `public/icons/icon-512.png`. Он квадратный и меньше 1 МБ. Не используйте логотип Google или букву G в логотипе GENESIS.
4. **Application home page:** `https://genesiscalendar.ru/`.
5. **Application privacy policy:** `https://genesiscalendar.ru/privacy`.
6. **Application terms of service:** `https://genesiscalendar.ru/terms`.
7. **Authorized domains:** `genesiscalendar.ru`.
8. **Developer contact information:** укажите минимум один постоянно проверяемый email; лучше два.
9. Сохраните изменения.

Название, логотип и адреса в Console должны полностью совпадать с сайтом и с тем, что будет показано на видео.

## Шаг 5. Настройте Audience

1. Откройте **Google Auth Platform → Audience**.
2. Выберите **External**, потому что GENESIS рассчитан не только на одну Google Workspace-организацию.
3. Пока оставьте статус **Testing**.
4. В **Test users** добавьте Google-аккаунты, на которых будете проводить проверку.
5. Сохраните.

В Testing приложение доступно только добавленным тестовым пользователям. Для sensitive scopes тестовый refresh token обычно истекает через 7 дней, поэтому это не режим постоянной публичной эксплуатации.

## Шаг 6. Проверьте OAuth client

Откройте **Google Auth Platform → Clients**, затем существующий production client типа **Web application**.

1. Назовите его, например, `GENESIS Production Web`.
2. В **Authorized JavaScript origins** оставьте только `https://genesiscalendar.ru`.
3. В **Authorized redirect URIs** оставьте точный адрес `https://genesiscalendar.ru/api/auth/google/callback`.
4. Удалите из production client все `localhost`, IP-адреса, HTTP-адреса и неиспользуемые домены.
5. Сохраните.

GENESIS использует серверный OAuth flow. JavaScript origin можно сохранить как явный production-origin, но критически важен точный redirect URI.

## Шаг 7. Добавьте только необходимые scopes

Откройте **Google Auth Platform → Data Access → Add or remove scopes** и добавьте:

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/calendar.app.created
https://www.googleapis.com/auth/tasks
```

Не добавляйте полный `calendar`, `calendar.events`, Gmail, Drive или другие scopes «на всякий случай».

Готовые обоснования на английском языке:

### `calendar.app.created`

> GENESIS creates a dedicated Google Calendar owned by the signed-in user and synchronizes only events inside that application-created calendar. Users can create, edit, reschedule, and delete those events in GENESIS. The app does not request access to the user's other calendars. Read-only access is insufficient because synchronization is bidirectional and changes are always initiated by the user.

### `tasks`

> GENESIS provides a task planner synchronized with Google Tasks. After a separate, explicit authorization action, the app lists the user's task lists and tasks and lets the user create, edit, move, complete, and delete them. Read-only access is insufficient because these user-initiated actions must be written back to Google Tasks. Google Tasks data is not used for advertising, profiling, sale, or training generalized AI models.

Если Google показывает категорию scope, ориентируйтесь на классификацию в Console. Не заменяйте эти scopes более широкими.

## Шаг 8. Полностью протестируйте приложение

Проверяйте в режиме инкогнито и записывайте результат каждого пункта:

- Главная страница, политика, условия, поддержка и удаление аккаунта открываются без входа.
- Кнопка входа имеет официальный вид Google.
- Первый вход просит только данные личности, а не Calendar и Tasks.
- После входа приложение явно объясняет, зачем нужен отдельный доступ к Calendar и Tasks.
- Отказ на любом consent screen возвращает пользователя в приложение с понятной ошибкой.
- После подключения создаётся отдельный календарь GENESIS; остальные календари пользователя не показываются и не изменяются.
- Создание, перенос, изменение и удаление события синхронизируются в обе стороны.
- Списки и задачи Google Tasks загружаются; создание, изменение, перенос, завершение и удаление работают.
- После выхода и повторного входа с тем же аккаунтом профиль открывается корректно.
- Попытка подключить Calendar/Tasks от другого Google-аккаунта отклоняется.
- Внешний отзыв доступа на странице Google Account не ломает профиль и предлагает подключить сервисы повторно.
- Кнопка отдельного отключения Calendar и Tasks отзывает доступ, но сохраняет профиль GENESIS.
- Удаление аккаунта в личном кабинете завершает сессию и отзывает выданный Google-доступ.
- На телефоне кнопки, уведомление о доступе и юридические страницы читаются полностью.
- Ни в интерфейсе, ни в логах, ни в инструментах разработчика браузера нет Client Secret, access token или refresh token.

Для финального теста используйте чистый тестовый Google-аккаунт без личных данных.

## Шаг 9. Запишите демонстрационное видео

Запишите одно непрерывное видео с production-сайтом. Перед записью переключите язык consent screen на **English**.

Покажите по порядку:

1. Адрес `https://genesiscalendar.ru` в строке браузера, название и назначение GENESIS.
2. Ссылки на Privacy Policy и Terms.
3. Нажатие **Sign in with Google** и полный первый consent screen.
4. Возврат в GENESIS после входа.
5. Уведомление, объясняющее отдельный доступ к Calendar и Tasks.
6. Нажатие кнопки подключения и весь consent screen целиком, включая каждый запрашиваемый scope.
7. Создание, изменение и удаление события в календаре GENESIS.
8. Просмотр списка Google Tasks, создание, изменение, завершение и удаление задачи.
9. Личный кабинет, объяснение безопасности и кнопку удаления аккаунта.
10. Публичную Privacy Policy, где описаны оба Google API и Limited Use.

Загрузите видео как **Unlisted** на YouTube или в доступное проверяющему облако. Проверьте ссылку в окне инкогнито. Не показывайте Client Secret, серверную конфигурацию, личные задачи или токены.

## Шаг 10. Проверьте Branding и отправьте Data Access verification

1. Вернитесь в **Google Auth Platform → Branding**.
2. Нажмите **Verify Branding**.
3. Исправьте все замечания автоматической проверки.
4. Когда появится **Ready to publish**, нажмите **Publish branding**. Не откладывайте: положительный результат brand verification действует ограниченное время.
5. Откройте **Verification Center** или раздел проверки **Data Access**.
6. Проверьте, что перечислены только scopes из шага 7.
7. Вставьте отдельное обоснование для каждого scope.
8. Добавьте ссылку на демонстрационное видео и, если поле доступно, ссылки на Privacy Policy, Support и эту функциональность на сайте.
9. Подтвердите соответствие Google API Services User Data Policy и отправьте заявку.

После отправки не меняйте название, логотип, домены, redirect URI или scopes до окончания рассмотрения — такие изменения могут запустить повторную проверку.

## Шаг 11. Отвечайте Google и публикуйте

1. Ежедневно проверяйте User support email и все Developer contact emails, включая папку «Спам».
2. Если Google задаёт вопрос, отвечайте по каждому пункту и прикладывайте новый timestamped-фрагмент видео, если это просят.
3. Не утверждайте, что приложение использует меньше данных, чем показано на consent screen.
4. После одобрения откройте **Audience** и переведите приложение из Testing в **In production**, если это не произошло в процессе публикации.
5. Проверьте вход новым Google-аккаунтом, которого не было в Test users.
6. Сохраните дату одобрения, список утверждённых scopes и копию отправленных обоснований.

## Что делать после одобрения

- Не добавлять новые scopes без отдельной оценки и, при необходимости, повторной проверки.
- Не менять логотип, имя, домены, homepage, privacy URL и redirect URI без понимания последствий для verification.
- Поддерживать Privacy Policy в точном соответствии с реальным использованием данных.
- Регулярно обновлять зависимости, следить за ошибками OAuth и отвечать на письма Google.
- При утечке Client Secret немедленно создать новый secret в Google Cloud Console, заменить его на сервере и отозвать старый.
- Если Google потребует security assessment, сначала перепроверьте классификацию scopes: при текущем наборе restricted scopes не ожидаются, но окончательное решение и классификацию показывает Google Console.

## Частые ошибки

| Ошибка | Как исправить |
| --- | --- |
| `redirect_uri_mismatch` | Скопировать redirect URI из этой инструкции без изменений и сохранить в production Web client. |
| `access_denied` | Пользователь отменил выдачу доступа; повторить только если он действительно хочет подключить синхронизацию. |
| `This app isn't verified` | Оставить приложение в Testing для тестовых аккаунтов либо завершить Branding и Data Access verification. |
| Логотип или название не видны | Завершить и опубликовать Brand verification. |
| Google просит более подробное видео | Записать весь flow заново на production, на английском consent screen, показать каждый scope и связанную функцию. |
| Refresh token перестал работать в Testing | Повторно подключить сервисы для теста и завершить публикацию; Testing не предназначен для постоянной эксплуатации sensitive scopes. |

Одобрение нельзя гарантировать технически: окончательное решение принимает Google. Этот чек-лист сводит заявку и приложение к требованиям, которые можно проверить заранее.

## Официальные документы Google

- [Verification requirements](https://support.google.com/cloud/answer/13464321?hl=en)
- [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049?hl=en)
- [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en)
- [Manage OAuth Clients](https://support.google.com/cloud/answer/15549257?hl=en)
- [OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Identity branding guidelines](https://developers.google.com/identity/branding-guidelines)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
