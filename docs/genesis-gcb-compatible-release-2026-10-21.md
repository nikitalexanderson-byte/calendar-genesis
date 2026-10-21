# Совместимый G/C/B выпуск 2.9.1/96

Выпуск опубликован 22 октября: PR240 и PR241, master/production `d4922d6eef7d4edc63c8474bba770d85210be306`. Штатный workflow39669361575, attempt2 завершился успешно. Исправление памяти native CI в PR241 сохраняет существующий путь сборки и публикации. `deploy-meta.json` совпал с master, `/api/health.ok=true`, descriptor показывает2.9.1/96 при minimumSupported76/2.7.0.

Подписанный APK имеет SHA256 `78e4dfe4833ead1dd17cd18f6080210c640c7077371c249f5ebe6ef94b1d7a4a`; подпись `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8` проверена. Upgrade95→96 через install-r и холодный запуск MainActivity прошли на API28/API35 до экрана выбора языка. Три immutable download URL2.9.0 вернули200. Receipt и startup evidence: `output/gcb-release-runtime/`. Production-пакет Samsung не изменялся, на телефоне используется отдельный QA package.

Живой Google-вход и синхронизация двух настоящих аккаунтов остаются непроверенными. Операторский SSH и ручные изменения production-БД не использовались. Ниже сохранён план и историческое основание выпуска.

Основание: origin/master438f941 и проверенные native C1 templates, C2 automation editor/inspection, C3 definitions/values/query/recovery, B5 saved views и cross-project bulk. G1–G4/C4–C6 и B1/B2/B4/B7 уже имеют server/web/native реализации и отдельные локальные проверки. Новый выпуск объединяет их пользовательские пути; прежний публичный APK2.9.0/95 не содержит последние исходники.

Изменения выпуска ограничены versionName2.9.1/versionCode96, соответствующими именами/проверками существующего deploy.yml и расширением штатной ART-проверки до55 уникальных UI/auth holders. Схема CI/CD, production origin, signing и minimumSupported76/2.7.0 сохраняются. После подписания штатный workflow проверяет native и Play startup на API35 до публикации. При Android-enabled rsync точечно защищаются три опубликованных immutable2.9.0 download path; это устраняет риск404 у старой ссылки после --delete. Другие каталоги и runtime данные не затрагиваются.

Пять последних deploy runs438f941…2ab2943 успешны. GENESIS_DEPLOY_TARGET=hostinger, GENESIS_DEPLOY_ANDROID=false до подготовки выпуска; Android будет включён перед merge проверенного кандидата. Перед публикацией обязательны frozen install/lint/test/build:beget, native unit/lint/unsigned R8 и проверка holder mapping. Подпись проверяется только CI; локальный unsigned APK не публикуется. Операторский SSH и ручной production SQL не нужны.

После merge перечисленные deploy/descriptor/checksum/download/startup проверки выполнены в указанном выше объёме. Google sign-in и синхронизация двух действительных аккаунтов требуют отдельного живого подтверждения; synthetic HTTPS не объявляется такой проверкой. Механизмы совместимости прежнего домена сохраняются.

Выпуск не отменяет следующие этапы E4/E5→F1–F3→A4 и финальную приёмку всех32 ID/14 K/U/L. Счётчик принятых ID обновляется по доказательствам полного сценария, а не только по номеру APK.
