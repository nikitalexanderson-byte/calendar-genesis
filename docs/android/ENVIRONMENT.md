# GENESIS Android: локальная среда

Проверка 23–24.09.2026, Europe/Moscow. Нативная **Windows 11 x64**, PowerShell 7.6.5; не WSL и не удалённая машина. Среда реально собирает нативный APK, а alpha02 запущена на физическом телефоне. Это не означает готовность полного приложения. Итоговый hash и границы — STATUS.md; ниже сохранены результаты исходной alpha01.

## Пути и изоляция

| Компонент | Путь |
| --- | --- |
| Android SDK | `C:\Users\mrdeu\AppData\Local\Android\Sdk` |
| Android Studio / JBR | `C:\Program Files\Android\Android Studio\jbr` |
| Модуль в существующем репозитории | `android/` |
| Изолированный worktree | `.worktrees/android-native-bootstrap` |
| APK | `android/app/build/outputs/apk/debug/app-debug.apk` |

Ветка `codex/android-native-bootstrap` первоначально создана от `origin/master` (`ebfb460`), затем перебазирована на 30257ff. Пользовательские незакоммиченные изменения основного checkout не менялись. Второй Android-проект не создавался. `local.properties` с локальным SDK игнорируется Git. Системные JAVA_HOME/PATH не изменены.

## Совместимые версии

| Компонент | Фактическая конфигурация |
| --- | --- |
| Studio | Quail 4, 2026.1.4, stable |
| Gradle JVM | JBR / OpenJDK 25.0.3 |
| Java в PATH | Java 8u421: для этой сборки не используется |
| Gradle Wrapper / AGP | 9.6.0 / 9.4.0, stable |
| Kotlin / Compose compiler | 2.2.10 / 2.2.10 |
| Java bytecode | 17 |
| Compile / target / min SDK | 37.2 / 37 / 26 |
| Build-Tools | 37.0.0 |
| Platform-Tools / adb | 37.0.1 / 1.0.41 |
| Command-line Tools | 22.0, каталог latest |
| Compose BOM | 2026.06.00 |
| Room / lifecycle / WorkManager | 2.8.5 / 2.11.0 / 2.11.2 |
| KSP | 2.3.12 |
| Credential Manager / Google ID | 1.6.0 / 1.1.1 |

Google ID 1.2.1 потребовал Kotlin metadata 2.4; выбран совместимый stable 1.1.1, проверка metadata не отключалась. Никакие Beta/Canary зависимости не подключены.

`sdkmanager --list --channel=0` подтвердил установленную stable `platforms;android-37.2` revision 1. Ранее установленная 36.1 и другие компоненты не удалялись агентом. Пустой каталог не считался установленной платформой.

Точный список пакетов, недостающих для текущего APK и физического устройства: **[]**. Эмулятор 36.5.10 установлен, AVD/system image для работы не потребовался. Новые платформы и образы агентом не устанавливались; лицензии автоматически не принимались.

## Контроль alpha02 на подключённом устройстве, 24.09.2026

Одно устройство `adb devices`: realme RMX5000, Android 16/API 36, `device`. Серийный номер в документ не внесён. Debug-пакет `ru.genesis.calendar.debug` обновлён с versionCode 6 до 7 через `adb install -r`, без удаления или очистки данных; прежний пакет `ru.genesis.calendar` остался. Синтетические задачи Alpha01 видны после обновления. `adb shell am start -W -n ru.genesis.calendar.debug/ru.genesis.calendar.MainActivity`: `Status: ok`, `LaunchState: COLD`, 1128 ms.

Команды текущего прогона (из worktree, Gradle — из `android/`):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\mrdeu\AppData\Local\Android\Sdk'
.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest :app:testDebugUnitTest :app:lintDebug --offline --quiet
adb install -r genesis-alpha02.apk
adb install -r -t genesis-alpha02-tests.apk
adb shell am instrument -w -e class ru.genesis.calendar.ProjectsFlowTest ru.genesis.calendar.debug.test/androidx.test.runner.AndroidJUnitRunner
adb shell am instrument -w -e class ru.genesis.calendar.NativeUiTest,ru.genesis.calendar.PreferencesTest ru.genesis.calendar.debug.test/androidx.test.runner.AndroidJUnitRunner
node android/tools/verify-assets.mjs --check --require-apk
apksigner verify --verbose android/app/build/outputs/apk/debug/app-debug.apk
zipalign -c -P 16 4 android/app/build/outputs/apk/debug/app-debug.apk
```

Фактически для `adb install` APK были скопированы в ASCII-путь временного каталога Windows; команда выше показывает смысл операции, а не абсолютное имя staging-каталога. Build/unit/lint PASS, **54 unit tests**; `ProjectsFlowTest` **2/2**, `NativeUiTest` **3/3**, `PreferencesTest` **1/1** PASS на realme. Итоговый APK 157842753 bytes, SHA-256 `d45ae7002a0b25be87ef4a14ee969234bd682fff1b221134f166cfd1696eaa1e`; подпись APK v2 и zipalign PASS, 527/527 assets byte parity PASS. Четыре снимка экрана устройства лежат вне Git в `outputs/android/device-projects/` (общий вид и карточки, Standart/Experimental). Лицензии/пакеты SDK не менялись, настройки безопасности устройства и Windows не менялись.

Оставшиеся блокеры: реальная синхронизация web↔Android и Google-вход не готовы из-за отсутствия опубликованных native auth endpoints/подтверждённого OAuth-клиента и завершённого transport/merge; браузер без авторизованной сессии показывает только вход, поэтому web Projects в обеих темах не проверен. Остальные строки и тесты — `PARITY_MATRIX.md`; полный релиз не принят. SSH и production deploy не использовались.

## Исходный этап alpha01: команды и фактические результаты

```powershell
git status --short --branch
git diff
git fetch origin master --prune
git worktree add -b codex/android-native-bootstrap <worktree> origin/master
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
& "$env:JAVA_HOME\bin\java.exe" -version
& 'C:\Users\mrdeu\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat' --list --channel=0
# Из android:
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleDebugAndroidTest :app:lintDebug --no-daemon --console=plain '-Pandroid.builder.sdkDownload=false'
```

Интегрированная сборка: **BUILD SUCCESSFUL**, 2m50s. 50 JUnit tests, 0 failures/errors. Lint: 0 errors, 37 warnings; предупреждения по зависимостям, version catalog, legacy launcher/backup metadata и API стилю не скрывались. HTML/XML находятся в `android/app/build/reports/`.

Диагностированные и исправленные проблемы:

- AGP 9.4 не допускает Provider в старом SourceSet API — generated originals подключены через Variant API.
- PowerShell разбивал некавыченный `-Pandroid.builder.sdkDownload=false` — аргумент заключён в кавычки.
- Java test worker не находил классы по кириллическому пути: прямой classpath работал, тот же `@argfile` нет. Только Gradle JVM настроен на `file.encoding=COMPAT`; Java source encoding явно UTF-8. Системная кодировка Windows не менялась.
- Предупреждение `android.overridePathCheck=true` остаётся: путь репозитория содержит кириллицу. Native symbols двух AndroidX .so не stripped; совместимость page size ещё требует отдельной проверки.
- После изменения dependencies обнаружен stale resource/Dex ID в Material3 text field. Однократная сборка `:app:assembleDebug :app:assembleDebugAndroidTest --rerun-tasks` исправила ResourceNotFound; данные/проект не удалялись, тест формы прошёл.

Дополнительно: `pnpm install --frozen-lockfile`, lint, 64 web tests, build:beget — PASS. Portable PHP 8.3.35 NTS x64 использован во временном каталоге, без глобального PATH. ZIP с официального downloads.php.net проверен по SHA-256 `25a8e2ac9ff30f1d768d1447c09a600617fa6e6082729f6e95f008b59c91fe45`. Syntax checks трёх PHP файлов и 44 standalone auth checks PASS; HTTP integration ещё NOT_RUN. OpenSSL config задан только процессу. Команды и область проверок — AUTH_PROTOCOL.md.

## Устройство на этапе alpha01

Согласованный realme RMX5000, Android 16 / API 36, adb state `device`. Серийный номер не сохраняется. Старое `ru.genesis.calendar` не удалялось; Alpha установлена отдельно как `ru.genesis.calendar.debug`, обновление через `adb install -r`. Последний cold start: Status ok, 1562 ms; process-specific AndroidRuntime error output пуст.

После явного поручения владельца уведомления Alpha включены через штатный системный экран. `pm grant` был отвергнут realme; это ограничение не отключалось. Экран Alarms & reminders показывает On, appops сообщает allow. DND, lockscreen, Play Protect, Windows security, USB security и другие приложения не изменены.

`ReminderFlowTest#prepareScreenOffReminder`: PASS, синтетическая запись сохранена/прочитана независимым Room connection, title отсутствует в ciphertext; alarm назначен на +90 секунд. Затем Home, sleep-display и `am kill` (не force-stop). Результаты доставки/действий фиксируются отдельно в STATUS/DEVICE_TESTS.

## Артефакт alpha01 (исторический)

- Debug, `2.0.0-alpha01` / 6, `ru.genesis.calendar.debug`.
- 157641687 bytes.
- SHA-256: `f9dc04317775bb260f767d051012dc18b768d7060b0655660dead970bee45e60`.
- Working-tree build от `ebfb460`; точная фиксация исходников — STATUS.
- 527 originals проверены по SHA-256 public → generated → распакованные APK entry bytes.
- `apksigner verify`: PASS, APK v2, debug key. `zipalign -c -P 16 4`: PASS, но отдельная проверка ELF segments ещё не выполнена.
- Постоянная release-подпись и N→N+1 release ещё не проверены.

Блокеры полной готовности: реальный Google login/OAuth registration и публикация API, HTTP/session тесты и security review, cloud sync, FCM, полный перенос функциональности/дизайна, hardware matrix (звук последнего теста подтверждён владельцем; screen-off/Doze/upgrade sound ещё не подтверждены), signing/backup и разрешение на публичный релиз. SSH и production deploy не использовались. Device-команды/результаты — DEVICE_TESTS.md.
