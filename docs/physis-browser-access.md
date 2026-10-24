# Фюзис: браузерный доступ и граница Android

24 октября 2026. После вопроса об изоляции старого WebView пользователь прямо поручил проверить границу и сделать раздел доступным на сайте в браузерах, сохранив его недоступность внутри мобильного приложения. Пилот остаётся ограничен тремя verified primary Google identities: `nikitalexanderson@gmail.com`, `jurijjlogvinov@gmail.com`, `picishina@gmail.com`.

## Проверенный опубликованный Android

Публичный `https://genesiscalendar.com/android-update.json` указывает 2.9.7 / versionCode 102, minimumSupportedVersionCode 76. Скачанный без установки `https://genesiscalendar.com/downloads/GENESIS-Android-Native-2.9.7.apk` имеет совпадающий SHA-256:

`b3112f772ab6041260962b8fbe8a9072eed17742abbbb894d63d32b31b1173a6`

`aapt dump badging` и `aapt dump xmltree ... AndroidManifest.xml` подтверждают package `ru.genesis.calendar`, launcher `ru.genesis.calendar.MainActivity`; исторический `BrowserLauncherActivity` не зарегистрирован. В APK есть `WebViewLoginActivity` SDK Яндекса для входа, что не является экраном сайта GENESIS. Утверждение «в APK вообще нет WebView» не используется.

В исходниках MainActivity запускает Compose `GenesisApp`. AuthSessionClient хранит отдельные native cookies, входит через `/auth/google/native`, запрещает redirects и ограничивает пути API allowlist без `/physis/*` и browser OAuth routes. Entry/auth/build-файлы совпадают с подписанным выпуском `fc04f3a`; независимый reviewer подтвердил это сравнение. Android source, manifest и ресурсы этим изменением не меняются; новый APK не собирается и не устанавливается.

## Серверная граница

`server/public/api/index.php` устанавливает доверенный `channel=native` при native Google login, а `channel=web` — при browser Google callback. Подключение native services не меняет channel. `genesisPhysisRequireOwner()` допускает только web channel, verified primary Google identity, точный email из allowlist и соответствующий owner. User-Agent, ширина экрана, заголовок или поле запроса не дают доступ native-сессии.

Прежний незарегистрированный BrowserLauncherActivity открывал CustomTabs или внешний ACTION_VIEW: это браузер со своей сессией. Текущие ссылки «веб-версия» также открывают внешний браузер без переноса native cookies. По последнему поручению пользователя такой доступ к сайту разрешён, в том числе с телефона.

## Активация и отключение

Git-controlled `GENESIS_PHYSIS_WEB_ENABLED=true` включает браузерный пилот, если private config не содержит override. Явный boolean `physis_enabled=false` отключает чтение и запись без удаления ciphertext. Любой non-boolean override, включая null, строку `'true'` и число 1, закрывает доступ. Existing deploy.yml сохраняет private config; после выпуска требуется подтвердить эффективный флаг, поскольку анонимный 403 не отличает выключенный модуль от корректно закрытого доступа.

Старые web-сессии без доверенных identity claims закрыты. Для доступа после обновления нужно выйти и снова войти через Google одним из трёх аккаунтов. Настройки Фюзиса доступны в личном кабинете → «Аккаунт GENESIS».

## Проверки и ограничения

- `server/tests/physis-security.php`: 167 проверок с реальными SQLite/HTTP и независимыми CAS-процессами. При отсутствии override все три разрешённые verified web-сессии получают доступ; native, сторонний аккаунт, unverified, linked, неизвестная legacy-сессия и anonymous отвергаются на всех шести маршрутах. Явное отключение отзывает чтение/запись и сохраняет данные; неправильный тип override закрывает доступ.
- Независимый review исходного варианта активации не обнаружил блокирующих замечаний и получил 165 passed. Затем guard уточнён для null override, добавлены null/число проверки: 167 passed. Лог: ignored `output/physis-browser-access-security.log`.
- Предыдущая приёмка UI в светлой/тёмной схемах на 360, 390, 768 и 1440 px относится к неизменённому frontend. В этом изменении правятся только серверный default, security tests и документация.
- Настоящий Google OAuth всех трёх тестеров и запуск на физическом устройстве не проверены. Проверена граница текущего опубликованного APK 2.9.7; все исторические APK не исследовались. Исторические launcher-ссылки во внешний браузер считаются браузерным доступом.
- `pnpm install --frozen-lockfile` — passed; `pnpm lint` — 0 ошибок, 2 прежних предупреждения об img в Mindmap; `pnpm test` — 666 passed; `GENESIS_MINDMAPS=true pnpm build:beget` — passed, максимальный JS chunk 349968 байт при лимите 350000. Логи: ignored `output/physis-browser-access-{lint,tests,build}.log`. Результат CI/production фиксируется отдельно после выпуска. Production-пользователи, их ключи и записи для этой проверки не создаются и не меняются.

Деплой использует прежний `deploy.yml`, target Hostinger, `GENESIS_DEPLOY_ANDROID=false`. Code rollback — git revert с обычным deploy; автоматического database rollback нет.
