# Beta.3/105 — signed APK и физический телефон

26 октября 2026, Europe/Moscow. Source: `bd919b2b7ad407ab83843b6a65da79f7e4761255`. Проверяется один realme RMX5000/API36; идентификатор устройства и личные значения не публикуются.

## Поставка и установка

[Workflow40364263222](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/40364263222) — SUCCESS, job21m4s, Gradle20m17s. `testDebugUnitTest`, `lintRelease`, `assembleRelease`, CI signature/package/zipalign checks прошли. Artifact `genesis-android-3.0-trial-6`, ID12671935182, expires2026-11-09T17:19:47Z; локальная копия сохранена отдельно от retention.

APK `GENESIS-Android-Native-3.0.0-beta.3.apk`,164762137 bytes. SHA-256: `d6f75e32982e009e6e5c6b1934f68468d3da1121a133bc64416019fa00b0ea32`. Сертификат SHA-256: `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`.

Перед установкой повторно выполнен `Verify-GENESIS-Trial.ps1`: SHA, package/version, release certificate, non-debuggable, zipalign и source metadata PASS. Manifest фактического APK не содержит RECORD_AUDIO и запроса android.speech.RecognitionService. Файлы и проверочный скрипт находятся в `C:/Users/mrdeu/Downloads/GENESIS-Android-3.0.0-beta.3`.

Установленная до обновления beta.2/104 проверена по SHA `be2cfb724d3bcce5f011f22ae58326229066520a0ecd06072de90502f2b59075`; её release certificate ранее проверен и совпадает с beta.3. `adb install -r` — SUCCESS, без uninstall/clear. Package manager подтвердил beta.3/105. SHA фактического установленного `base.apk` совпал с APK выше.

## Физический smoke и пределы

- MainActivity: COLD, status ok, TotalTime995ms. Это единичное наблюдение, не performance benchmark.
- При первом UI-снимке телефон разблокирован и активен GENESIS. Доступен «Сегодня» без нового входа; в общей шапке календарь расположен перед синхронизацией, действие «Подробнее о дне» отображается. Календарь вручную не переключался, refresh не нажимался.
- После попытки продолжить навигацию обнаружено другое приложение на переднем плане. Дальнейшие UI-действия остановлены. Отсутствие старых пунктов в дереве другого приложения не считается результатом GENESIS. Меню, месяц/год и оформление на физическом телефоне в этом проходе не объявляются проверенными.
- Итоговая read-only проверка: installed version105, процесс GENESIS жив, в crash buffer текущего процесса нет FATAL EXCEPTION, пакет не запрашивает микрофон. Телефон не возвращался принудительно на «Сегодня» после смены foreground.

Записи и настройки телефона вручную не изменялись, выход и повторный вход не выполнялись. Install-r сохраняет app data; полнота всей БД не исследовалась. Существующий workspace доступен, но обновление Google-токена и cloud roundtrip не доказаны. Private DB и токены не читались. Диагностический XML другого foreground удалён; личные UI-данные и снимки телефона не входят в Git.

## Signed release на эмуляторе

Отдельный release package обновлён104→105 через install-r на API35. MainActivity WARM, status ok; отображается GENESIS auth landing с Google-действием. Процесс работает, текущих fatal crash нет; вход не выполнялся. Debug package и его fixtures не использовались как доказательство реального аккаунта. Исходные настройки accessibility/font/rotation эмулятора сохранены; временное отключение TalkBack при визуальном debug-проходе восстановлено.

Сайт, backend, production-БД, стабильный APK/update pointer не менялись; merge/deploy не выполнялись, `GENESIS_DEPLOY_ANDROID=false` сохраняется. SSH не использовался.
