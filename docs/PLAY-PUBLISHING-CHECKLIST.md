# Подготовка GENESIS к Google Play

## Уже реализовано

- HTTPS production URL `https://genesiscalendar.ru/`;
- адаптивная PWA и TWA-модуль `ru.genesis.calendar`;
- закрытый доступ к пользовательскому календарю;
- Google OAuth и ограниченный Google Calendar scope;
- публичные URL `/privacy`, `/terms`, `/support`, `/delete-account`;
- самостоятельное удаление аккаунта в приложении;
- политика с описанием локального, Google и зашифрованного серверного хранения;
- `versionCode 3`, `versionName 1.2.0`.

## Перед загрузкой AAB

1. Перевести OAuth consent screen из Testing в Production и пройти проверку чувствительного Calendar scope.
2. Указать на OAuth Branding:
   - Homepage: `https://genesiscalendar.ru/`;
   - Privacy policy: `https://genesiscalendar.ru/privacy`;
   - Terms: `https://genesiscalendar.ru/terms`.
3. Создать upload key вне репозитория и включить Play App Signing.
4. Подставить SHA-256 сертификата в `android/assetlinks.json.template` и опубликовать файл на `/.well-known/assetlinks.json`.
5. Собрать подписанный Android App Bundle.
6. Пройти Internal testing и проверить Google OAuth, офлайн-режим, создание, выполнение, повторение и удаление задач.

## Черновик Data safety

- Personal info / Email address: collected for account management; encrypted in transit; deletion available.
- User IDs: collected for account management.
- App activity / Other user-generated content: task contents are not collected into the GENESIS database; they are processed transiently for Google Calendar synchronization.
- App activity / Interactions: aggregate counts are collected for analytics and administration; no task text.
- Data sharing: no sale and no advertising use.
- Security: HTTPS in transit, encrypted OAuth tokens, client-encrypted project structure, Google OAuth without password collection.

Финальные ответы в Play Console нужно сверить с актуальной формой Google Play на момент публикации.
