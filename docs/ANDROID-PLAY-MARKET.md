# GENESIS для Android и Google Play

Мобильная версия построена как Trusted Web Activity поверх PWA. Это важно для Google: авторизация открывается в системном браузере, а не во встроенном WebView, и тот же аккаунт видит одну базу задач на компьютере и телефоне.

## Готовый модуль

Android-проект находится в `android/`:

- application ID: `ru.genesis.calendar`;
- target SDK: Android 16 / API 36 — требование Google Play для новых приложений с 31 августа 2026 года;
- Android Browser Helper: `2.7.3`;
- формат публикации: подписанный `.aab`;
- формат прямой установки и тестирования: `.apk`.

Сборка после фиксации HTTPS-адреса:

```powershell
cd android
.\gradlew.bat :app:assembleRelease -PgenesisUrl=https://genesiscalendar.ru/
.\gradlew.bat :app:bundleRelease -PgenesisUrl=https://genesiscalendar.ru/
```

## Что требуется перед публичным релизом

1. Постоянный HTTPS-домен `genesiscalendar.ru` на Beget.
2. OAuth-клиент типа Web application с callback `https://genesiscalendar.ru/api/auth/google/callback` и включённым Google Calendar API.
3. Политика конфиденциальности, адрес поддержки и заполненный OAuth consent screen.
4. Upload key вне репозитория и включённый Play App Signing.
5. SHA-256 сертификата в `android/assetlinks.json.template`, опубликованный как `https://genesiscalendar.ru/.well-known/assetlinks.json`.
6. Проверка APK на устройстве, затем `.aab` во внутреннем тестировании Play Console.

Для текущего прямого тестового APK его публичный отпечаток уже хранится в `public/.well-known/assetlinks.json`, поэтому после production-деплоя интерфейс открывается как полноэкранное TWA-приложение. Перед Play-релизом этот отпечаток нужно заменить на SHA-256 отдельного защищённого upload/release-сертификата в одном деплое с новой сборкой.
