# GENESIS Android: release runbook (gates closed)

Текущий результат — **internal alpha**, не публичный release. Этот файл не разрешает публикацию и не утверждает, что нижеперечисленные проверки выполнены. Источники результата: STATUS, PARITY_MATRIX, ENVIRONMENT, DEVICE_TESTS.

## 1. Идентичности и данные

- Release applicationId уже закреплён: `ru.genesis.calendar`. Не менять его ради обхода несовпадения сертификата.
- Internal debug: `ru.genesis.calendar.debug`; отдельные private storage, Keystore UID и validation scope. Это не этап обновления публичного release.
- До подписи установить, использовал ли кто-либо прежний APK `ru.genesis.calendar`, каким сертификатом он подписан и сохранён ли соответствующий ключ. Не выполнять uninstall/clear.
- Постоянный release keystore, alias и защищённый backup требуют решения владельца. Не создавать новую постоянную identity «временно», не держать ключ в Git/OneDrive/webroot. Пароли вводятся локально, не в чате/командной строке/логах.
- Текущий build.gradle **не назначает debug signing для release**. Неподписанный release APK не раздаётся как готовый.

## 2. Предварительные gates

1. Все обязательные строки полной PARITY_MATRIX закрыты реализацией и тестом; изображения/авторские контролы визуально сопоставлены с исходником. Проверка SHA не заменяет визуальную проверку.
2. Настроены OAuth package+release SHA-1, production native endpoint, проверенный тестовый аккаунт. Вход отдельно от Google Calendar/Tasks consent. FCM конфигурация не содержит service-account key в APK.
3. Workspace crypto compatibility, recovery, account isolation, outbox/CAS/conflicts, web↔Android и logout пройдены на изолированных данных. Нельзя считать локальную alpha новым аккаунтом сайта.
4. Физический тест reminders: экран off, offline, обычная гибель процесса, open/complete/snooze/cancel, reboot/unlock, APK update. Слышимость и вибрацию подтверждает человек; отсутствующее подтверждение не PASS.
5. Обработаны denied notifications/exact alarm, отключённый канал и звук, DND, Force stop и OEM restrictions без отключения защиты устройства.
6. Подпись, non-debuggable, minSdk/ABI/16-KiB совместимость, обновление N→N+1 в **одном release-канале** без потери session/ключей/базы/каналов.

## 3. Локальная проверка

Использовать Gradle Wrapper и установленный stable SDK, без автоматического принятия лицензий. JAVA_HOME только на текущий процесс — Studio JBR.

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleDebugAndroidTest :app:lintDebug --no-daemon --console=plain '-Pandroid.builder.sdkDownload=false'
```

Из корня worktree:

```powershell
node android/tools/export-calendar.mjs --check
node android/tools/export-habit-vectors.mjs --check
node android/tools/export-tracker-vectors.mjs --check
node android/app/src/test/java/ru/genesis/calendar/security/webcrypto-vectors.mjs
node android/tools/verify-assets.mjs --require-apk
php -l server/src/native-auth.php
php -l server/public/api/index.php
php -l server/tests/native-auth.php
php server/tests/native-auth.php
```

`android/tools/device-test.ps1 -Stage <stage>` проверяет также JUnit output: `am instrument` может вернуть exit 0 при FAIL. Стадии не запускать произвольным общим suite: `prepare` назначает +90s; затем отдельно `open` или `complete`, `persist`, `snooze`, `ui`, `preferences`, `diagnostics`. Открытие требует разблокированного устройства. После реального tap auto-cancel уведомление исчезает, поэтому проверка action должна использовать отдельную подготовку. Fixture и тесты находятся только в androidTest и защищены debug/package guard.

Для release после безопасной настройки signing: `:app:assembleRelease :app:lintRelease`, затем `apksigner verify --verbose --print-certs <apk>` и `zipalign -c -P 16 4 <apk>`. ZIP alignment не заменяет проверку PT_LOAD ELF alignment всех .so. Инструменты Windows запускать с ASCII temporary copy, если путь с кириллицей не поддерживается. Сверить applicationId/version/minSdk через aapt, SHA-256 и отсутствие private credentials.

## 4. Публикация (только после отдельного разрешения)

Перед любой публикацией выполнить существующие `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build:beget`, PHP regression и Android gates. Отдельный Android CI ещё не активирован; существующий `.github/workflows/deploy.yml` не заменять.

Сначала immutable signed APK и проверка HTTPS/MIME/hash/size, затем атомарно release manifest, затем разрешённый CTA. Поля manifest: applicationId, versionName, versionCode, minSdk, size, sha256, downloadUrl, changelog. Пока gates закрыты, не выкладывать debug и не направлять CTA на отсутствующий файл.

Предлагаемые download/App-Link маршруты требуют проверки текущего router/server до включения. Не перехватывать OAuth, API, `/android`, `/downloads`; не precache APK всем PWA-пользователям. App Links подтверждаются только ожидаемым **release** SHA-256. Старый assetlinks с test certificate не является доказательством native link readiness.

GitHub — источник отслеживаемого кода. После разрешения: review/commit рабочей ветки → push/merge master → существующий Actions deploy → публичные `/deploy-meta.json` SHA и `/api/health`. Только разрешённый GENESIS root на Beget; SSH не нужен для обычного deploy.

Rollback кода: git revert и штатный deploy. Database rollback без явного согласования не выполнять. Установленные APK не понижать автоматически; сохранить предыдущий стабильный download pointer, при исправлении выпускать больший versionCode с прежней подписью.
