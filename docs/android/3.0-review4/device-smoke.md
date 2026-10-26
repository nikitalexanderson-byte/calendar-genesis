# Beta.4/106 — подписанный APK и физический телефон

26 октября 2026, Europe/Moscow. Source `e79330368cb4cda5615aeb4031f72ce5e0b2afc6`. Один realme RMX5000/API36; идентификатор устройства, личные экраны, БД и токены не публикуются.

## Артефакт

[Workflow40387733574](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/40387733574) — SUCCESS: JVM, lintRelease, assembleRelease и проверки signature/package/zipalign. Gradle20m52s. Artifact `genesis-android-3.0-trial-8`, ID12683926384, expires2026-11-09T19:54:47Z. [Метаданные](release-artifact.json).

APK `GENESIS-Android-Native-3.0.0-beta.4.apk`,170083389 bytes, SHA-256 `b143b39b7ba1e119232b01e497bde7db766286cc28f453ba6a4185fa7efedf97`. Сертификат SHA-256 `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8` совпадает с существующим release.

Загрузка GitHub зависла после169443328 bytes. Последние647620 bytes получены HTTP206; SHA-256 полного ZIP `b1cbc6871804416dfeaf03feaa9d5fca247a0038b2e3179128f76e072dd417e9` совпал с digest GitHub, CRC и точный список пяти файлов проверены. Повторной сборки или изменения APK не было.

Локальный `Verify-GENESIS-Trial.ps1` подтвердил SHA sidecar, apksigner/certificate, package/version/source, non-debuggable и zipalign. Manifest не содержит RECORD_AUDIO и запроса speech RecognitionService. Все13 лунных изображений и SVG круглого календаря совпали побайтно с оригинальными ассетами сайта. Папка `C:/Users/mrdeu/Downloads/GENESIS-Android-3.0.0-beta.4` содержит APK, metadata, SHA, скрипт, хеши оригиналов и примечания; она не зависит от срока хранения Actions.

## Телефон

Перед установкой повторно проверен установленный beta.3/105: base.apk SHA `d6f75e32982e009e6e5c6b1934f68468d3da1121a133bc64416019fa00b0ea32` совпал с ранее проверенным release. `adb install -r` — SUCCESS. PackageManager подтвердил106; SHA фактического установленного base.apk совпал с APK beta.4 выше.

Удаление приложения, очистка данных, выход/новый вход, изменение личных записей и настроек не выполнялись. Install-r сохраняет app data; полнота всей БД и содержимое каждой записи не исследовались.

GENESIS не запускался принудительно. После установки ActivityManager `topResumedActivity` подтвердил другое приложение; UI-навигация и снимки реального телефона не выполнялись. Поэтому запуск, меню, календарь, советы и поиск на физическом устройстве в этом проходе **не объявляются PASS**. Физический результат ограничен совместимой установкой и проверкой пакета/версии/хеша.

## Подписанный release на эмуляторе

Отдельный release package обновлён105→106 через install-r на API35; его base.apk совпал с тем же проверенным APK. MainActivity: WARM, status ok, TotalTime1982ms — единичное наблюдение, не benchmark. UI XML зафиксировал GENESIS, экран входа и Google-действие. Вход не выполнялся; процесс жив, FATAL EXCEPTION/Fatal signal текущего процесса в crash buffer не обнаружены.

В конце поверх приложения появился системный запрос уведомлений **Android Accessibility Suite** после восстановления исходного TalkBack. Запрос оставлен без выбора; он не является новым запросом GENESIS. Доступность Google-действия для нажатия под этим системным окном не проверялась. [Исходные accessibility/font настройки](emulator-settings-restored.json) восстановлены и повторно сверены после smoke; полный TalkBack этим не подтверждается.

Debug/native тесты и матрица синтетические и учитываются отдельно в [приёмке](acceptance.md). Новый OAuth, token refresh, живая синхронизация двух устройств, live-провайдеры/роли, SAF, фоновые ограничения и downgrade в этой итерации не проверены.

Сайт, backend, production-БД, стабильный APK/update pointer не менялись; merge/deploy не выполнялись, `GENESIS_DEPLOY_ANDROID=false` сохраняется. SSH не использовался.
