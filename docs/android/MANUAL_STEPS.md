# Android: внешние зависимости и ручные действия

Аудит исходников: 23.09.2026, ветка `codex/android-native-bootstrap`. Это internal alpha. Доступ к консолям Google/Firebase и production-секретам не использовался. SSH не использовался. Отсутствие конфигурации в Git не доказывает её отсутствие в консоли: ниже указано то, что ещё нужно предоставить/проверить для интеграции.

## 1. Google OAuth: требуется владелец проекта Google Cloud

Существующий backend использует Web OAuth client `406005321419-ea3m6db70rl4uog3shtmn2v8fuavsuug.apps.googleusercontent.com`. Публичный ID 23.09.2026 безопасно извлечён из Location ответа `/api/auth/google/start` с запрещённым follow redirect; выведен только client_id. Cookie/state и закрытая конфигурация не читались/не выводились. Текущий callback сайта: `https://genesiscalendar.ru/api/auth/google/callback`. Он сохраняется.

1. В существующем Google Cloud project сайта открыть Google Auth Platform → Clients (или APIs & Services → Credentials). Проверить, что указанный выше Web client относится к нужному проекту. Не передавать client secret и не создавать второй Firebase Auth/базу пользователей.
2. Проверить существующие Android OAuth clients; создать недостающий для внутренней сборки: package `ru.genesis.calendar.debug`, SHA-1 `47:45:C0:D2:1F:E4:E3:E8:1B:AA:F6:87:C3:26:04:EA:FC:26:C3:98`. Публичный SHA-256 этого debug-сертификата: `57:97:2E:3E:28:79:B7:E8:64:10:DE:D1:B6:E5:43:8E:56:62:FE:92:B4:F8:B5:2D:C6:7B:13:95:90:6E:EF:CA`. Отпечатки проверены основным агентом в текущей сессии.
3. После выбора постоянной подписи создать/проверить **отдельный** Android client для `ru.genesis.calendar` с реальным release SHA-1. Release SHA-1/SHA-256 пока не определены. Не подставлять debug-сертификат как release.
4. Если OAuth project находится в Testing, добавить согласованный тестовый Google-аккаунт в Test users. Проверку проводить в специально согласованном тестовом пространстве GENESIS; личные записи не использовать как fixtures.
5. После реализации native token endpoint проверить debug login и отдельно signed-release login. Android client ID не подставляется в `setServerClientId`: там используется публичный **Web client ID**. Нативный выбор аккаунта сам по себе ещё не создаёт сессию GENESIS.

В локальном коде добавлены `/api/auth/google/native/challenge` и `/api/auth/google/native` с CSRF, одноразовым nonce, RS256/OpenSSL проверкой подписи по Google PEM certificates и проверкой claims. На production они **не опубликованы**, поэтому реальный native login пока BLOCKED. Контракт и проверки описаны в `AUTH_PROTOCOL.md`. Запуск прежнего OAuth в Custom Tab оставит session cookie в браузере и не авторизует native HTTP-клиент автоматически.

Документация: [Credential Manager / Google](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation), [проверка ID token на backend](https://developers.google.com/identity/sign-in/android/backend-auth).

## 2. FCM: требуется владелец Google/Firebase project

В исследованных `android/`, `server/`, `.github/` нет Firebase application configuration, FCM registration endpoint и отправителя HTTP v1. Наличие внешнего Firebase project не установлено.

1. В Firebase Console выбрать проект, связанный с существующим Google Cloud project GENESIS. Не включать Firebase Auth/Firestore вместо текущего backend.
2. Зарегистрировать/найти два Android apps: `ru.genesis.calendar.debug` и `ru.genesis.calendar`; сообщить публичные project ID, project number / sender ID и Firebase app IDs. Скачать соответствующие `google-services.json` локально; они содержат клиентскую конфигурацию, **не service-account private key**.
3. После добавления build-variant интеграции разместить конфигурации в `android/app/src/debug/google-services.json` и `android/app/src/release/google-services.json`. На дату аудита это ожидаемые пути, а не уже реализованная интеграция.
4. Разрешить Firebase Cloud Messaging API HTTP v1 для выбранного проекта. Серверные полномочия для отправки хранить только в закрытой конфигурации внутри `/home/h/haiirodw/genesis-calendar/server`, отдельно от Git/APK/webroot. Конкретную service-account роль и способ передачи согласовать перед выдачей; не пересылать private key в чат.
5. После реализации проверить token refresh, logout/unregister и переключение аккаунта; payload содержит только opaque IDs/версии. Локальный alarm не зависит от FCM.

Без конфигурации доступна разработка локальных напоминаний. FCM delivery и отозванные grants до реального теста остаются BLOCKED/NOT_RUN. [Официальная настройка Firebase Android](https://firebase.google.com/docs/android/setup), [build-variant matching google-services](https://firebase.google.com/docs/android/google-services-plugin-and-file).

## 3. Постоянная release signing identity: требуется решение владельца

При аудите прежний `android/app/build.gradle.kts` назначал `signingConfigs.getByName("debug")` для release. Это не годится для публичного канала; основной агент удаляет это назначение. Существующий `applicationId = ru.genesis.calendar` сохраняется для release; новая internal alpha отделена суффиксом `.debug`.

1. Установить, распространялся ли ранее APK `ru.genesis.calendar` пользователям. Если да, прежде всего установить ожидаемый сертификат и наличие его закрытого ключа: нельзя обещать бесшовное обновление другой подписью и нельзя исправлять mismatch удалением приложения.
2. Если production identity ещё нет, владелец создаёт постоянный signing key в защищённом локальном каталоге **вне Git/OneDrive/webroot**, например через Android Studio → Build → Generate Signed Bundle / APK → APK → Create new. Пароли вводятся интерактивно. Не создавать постоянный ключ автоматически без согласования.
3. Сохранить зашифрованную резервную копию keystore и пароль отдельно. Передать разработке только путь для локальной настройки, alias и публичные отпечатки; пароль не публиковать. Публичные отпечатки можно прочитать `keytool -list -v -keystore <protected-path> -alias <release-alias>` с интерактивным запросом пароля.
4. После настройки подписи проверить `apksigner verify --verbose --print-certs <release-apk>` и обновление N→N+1 с тем же ID/сертификатом без удаления данных. Debug `.debug` → release не является таким обновлением.
5. Обновление `public/.well-known/assetlinks.json`, download manifest и публичная публикация допустимы только после release gates и разрешения владельца. Старый файл связан с прежним TWA/debug-сертификатом, не доказывает готовность native App Links.

## 4. E2EE/данные и тестовое пространство

Формат AES-GCM найден и перенесён в `security/WorkspaceCipher.kt`; синтетические web↔Kotlin vectors не требуют реального аккаунта. Вход, получение ключа существующего workspace, local Keystore и реальный sync — отдельные критерии. Сервер сейчас хранит зашифрованный ключ и может выдавать его защищённой сессии (`keyMode=account`); это **не zero-knowledge E2EE**.

До живого web↔Android испытания владелец выбирает отдельный тестовый Google-аккаунт/пространство и авторизует изменения только там. Код восстановления, workspace key, cookie и ID token не присылать в чат, не включать в отчёт. Для legacy client-managed workspace потребуется существующий recovery code в защищённом UI; новый ключ поверх старого не генерируется. Подробности — `AUTH_PROTOCOL.md`.
