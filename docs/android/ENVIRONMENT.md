# GENESIS Android: локальная среда

Проверка 23–24.09.2026, Europe/Moscow. Нативная **Windows 11 x64**, PowerShell 7.6.5; не WSL и не удалённая машина. Среда реально собирает нативный APK, но это не означает готовность полного приложения. Текущий alpha02 build/hash и новый блокер устройства — STATUS.md; ниже сохранены результаты alpha01.

## Пути и изоляция

| Компонент | Путь |
| --- | --- |
| Android SDK | `C:\Users\mrdeu\AppData\Local\Android\Sdk` |
| Android Studio / JBR | `C:\Program Files\Android\Android Studio\jbr` |
| Модуль в существующем репозитории | `android/` |
| Изолированный worktree | `.worktrees/android-native-bootstrap` |
| APK | `android/app/build/outputs/apk/debug/app-debug.apk` |

Ветка `codex/android-native-bootstrap` создана от обновлённого `origin/master` (`ebfb460`). Пользовательские незакоммиченные изменения основного checkout не менялись. Второй Android-проект не создавался. `local.properties` с локальным SDK игнорируется Git. Системные JAVA_HOME/PATH не изменены.

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

## Команды и фактические результаты

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

## Устройство

Согласованный realme RMX5000, Android 16 / API 36, adb state `device`. Серийный номер не сохраняется. Старое `ru.genesis.calendar` не удалялось; Alpha установлена отдельно как `ru.genesis.calendar.debug`, обновление через `adb install -r`. Последний cold start: Status ok, 1562 ms; process-specific AndroidRuntime error output пуст.

После явного поручения владельца уведомления Alpha включены через штатный системный экран. `pm grant` был отвергнут realme; это ограничение не отключалось. Экран Alarms & reminders показывает On, appops сообщает allow. DND, lockscreen, Play Protect, Windows security, USB security и другие приложения не изменены.

`ReminderFlowTest#prepareScreenOffReminder`: PASS, синтетическая запись сохранена/прочитана независимым Room connection, title отсутствует в ciphertext; alarm назначен на +90 секунд. Затем Home, sleep-display и `am kill` (не force-stop). Результаты доставки/действий фиксируются отдельно в STATUS/DEVICE_TESTS.

## Артефакт

- Debug, `2.0.0-alpha01` / 6, `ru.genesis.calendar.debug`.
- 157641687 bytes.
- SHA-256: `f9dc04317775bb260f767d051012dc18b768d7060b0655660dead970bee45e60`.
- Working-tree build от `ebfb460`; точная фиксация исходников — STATUS.
- 527 originals проверены по SHA-256 public → generated → распакованные APK entry bytes.
- `apksigner verify`: PASS, APK v2, debug key. `zipalign -c -P 16 4`: PASS, но отдельная проверка ELF segments ещё не выполнена.
- Постоянная release-подпись и N→N+1 release ещё не проверены.

Блокеры полной готовности: реальный Google login/OAuth registration и публикация API, HTTP/session тесты и security review, cloud sync, FCM, полный перенос функциональности/дизайна, hardware matrix (звук последнего теста подтверждён владельцем; screen-off/Doze/upgrade sound ещё не подтверждены), signing/backup и разрешение на публичный релиз. SSH и production deploy не использовались. Device-команды/результаты — DEVICE_TESTS.md.
