# Совместимый G/C/B выпуск 2.9.1/96

Основание: origin/master438f941 и проверенные native C1 templates, C2 automation editor/inspection, C3 definitions/values/query/recovery, B5 saved views и cross-project bulk. G1–G4/C4–C6 и B1/B2/B4/B7 уже имеют server/web/native реализации и отдельные локальные проверки. Новый выпуск объединяет их пользовательские пути; прежний публичный APK2.9.0/95 не содержит последние исходники.

Изменения выпуска ограничены versionName2.9.1/versionCode96, соответствующими именами/проверками существующего deploy.yml и расширением штатной ART-проверки до55 уникальных UI/auth holders. Схема CI/CD, production origin, signing и minimumSupported76/2.7.0 сохраняются. После подписания штатный workflow проверяет native и Play startup на API35 до публикации. При Android-enabled rsync точечно защищаются три опубликованных immutable2.9.0 download path; это устраняет риск404 у старой ссылки после --delete. Другие каталоги и runtime данные не затрагиваются.

Пять последних deploy runs438f941…2ab2943 успешны. GENESIS_DEPLOY_TARGET=hostinger, GENESIS_DEPLOY_ANDROID=false до подготовки выпуска; Android будет включён перед merge проверенного кандидата. Перед публикацией обязательны frozen install/lint/test/build:beget, native unit/lint/unsigned R8 и проверка holder mapping. Подпись проверяется только CI; локальный unsigned APK не публикуется. Операторский SSH и ручной production SQL не нужны.

После merge требуется дождаться deploy, сверить master SHA/deploy-meta/health/worker, update descriptor96/2.9.1/min76, checksum APK, прежние download URL и реальный signed startup/upgrade на обоих доступных эмуляторах. Google sign-in и синхронизация двух действительных аккаунтов требуют отдельного живого подтверждения; synthetic HTTPS не объявляется такой проверкой. Старый домен остаётся рабочим, объявление о переезде не включается.

Выпуск не отменяет следующие этапы E4/E5→F1–F3→A4 и финальную приёмку всех32 ID/14 K/U/L. Счётчик принятых ID обновляется по доказательствам полного сценария, а не только по номеру APK.
