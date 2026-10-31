# Genesis Tasker 3.1.3 — reviewer и signing gates

Срез сохранённых доказательств: **30 октября 2026, 11:38 UTC**. Этот проход читает уже имеющиеся отчёты и QA-файлы; Console, CUA, ADB, Gradle и SSH не использовались. UNKNOWN означает отсутствие нужного доказательства в проверенном наборе, а не утверждение о неправильной настройке.

Исторический candidate7: source `2f32e3cb3764ed4e22b4b19c92f2fb6a6a936ba1`, [trial7 41044846018](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41044846018) — **SUCCESS**. Конкретные APK/AAB candidate7 прошли независимые статические проверки в 11:37 UTC. Их SHA-256 и пределы проверки сохранены в [signed-candidate-validation.md](signed-candidate-validation.md); история candidate5/6 сохранена. Основной агент подтвердил необходимость candidate8 с дополнительными исправлениями интерфейса и CAS. Эти изменения в source 2f32e3cb не входят.

## Подписи: что подтверждено

Actual direct APK и upload AAB candidate5/6/7 проверены независимыми `apksigner`, `jarsigner` и verifying `JarFile`. Их сертификат:

- SHA-256: `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`.
- SHA-1: `9a28ae70b1933d86ff3a4ef931e924f81a4426bc`.

Это установленный signer этих файлов. Имя CI-файла `play-signing-certificate.txt` относится к сертификату подписанного AAB и само по себе не доказывает сертификат APK, который Play доставляет пользователю.

| Gate | Подтверждено сохранёнными данными | Статус / остающееся доказательство |
| --- | --- | --- |
| Фактическая подпись candidate7 APK/AAB | APK `5dcd6a9e404ab0f14d8e2e1ce0ccdea43eaec8b9e56121333eeeeaa139f14311`, AAB `1f7aa06dc87a8784b04174740bcc5c6d0b97ec0c5db7f6e545e32a8057169b11`; оба подписаны указанным сертификатом | **STATIC PASS**. Манифесты 3.1.3/120, flags, 16 KB native/ZIP, 75/75 required DEX classes каждого variant подтверждены; install/runtime и Play acceptance этим проходом NOT RUN. |
| Зарегистрированный upload certificate в Console | Основной агент read-only открыл Manage Play app signing и скопировал SHA-1/SHA-256 upload key; оба совпали с actual signer APK/AAB candidate7 | **CONSOLE FINGERPRINT CONFIRMED**. Это ещё не загрузка или приём AAB120. |
| Play App Signing certificate | В том же read-only чтении основной агент скопировал SHA-1/SHA-256 Play signing key. Оба совпали с указанными выше fingerprints и upload key | **CONSOLE FINGERPRINT CONFIRMED**. Реальный сертификат этой настройки совпадает с upload signer; Play-доставленный APK ещё не проверен. |
| Сертификат APK, доставленного Google Play | В проверенном наборе нет подтверждённого Play-generated APK с цепочкой происхождения | **UNKNOWN**. Нельзя переносить сюда сертификат direct APK или AAB. |
| Google OAuth на Play-доставленном APK | Нет проверенного cold-login на таком APK и сверки OAuth Android client с package/app-signing fingerprint | **UNKNOWN**. Cached login после direct upgrade не закрывает этот gate. |
| Подписанное direct обновление 119 → 120 | `realme-live-version-before119.txt`: 3.1.2 / 119; `realme-live-upgrade119-to120-candidate6.log`: `Performing Streamed Install`, `Success` | **INSTALL SUCCESS RECORDED для candidate6**. Эти два файла отдельно не удостоверяют сохранность всех данных, новый Google login или установку из Play. Финальная приёмка обновления принадлежит основному агенту. |
| Загрузка финального versionCode 120 | Последний Console-срез: максимальный 119; APK/AAB 120 ещё не загружались | **NOT RUN**. Перед загрузкой нужен актуальный контроль использованного versionCode и фактический ответ Console. |

Новые Console-факты переданы основным агентом; этот агент не открывал Console. Разрешённый набор без credentials/private URL сохранён в [console-signing-reviewer-summary.json](../../../outputs/v313/signed-candidate7-validation/console-signing-reviewer-summary.json), исходное evidence имеет срез `2026-10-30T11:38:12.164Z`. Формы в этом чтении не менялись.

Исходные данные подписи: [candidate7 apk-apksigner.log](../../../outputs/v313/signed-candidate7-validation/apk-apksigner.log), [aab-keytool.log](../../../outputs/v313/signed-candidate7-validation/aab-keytool.log), [validation-summary.json](../../../outputs/v313/signed-candidate7-validation/validation-summary.json). Исторические результаты candidate6 сохранены в [signed-candidate-validation.md](signed-candidate-validation.md). Установка: [upgrade log](../../../outputs/v313/realme-live-upgrade119-to120-candidate6.log) и [версия до установки](../../../outputs/v313/realme-live-version-before119.txt). Для этого отчёта извлечены только строки версии/статуса установки; профиль, пользовательский контент и приватные идентификаторы не включены.

## Доступ ревьюера и отправка на проверку

| Gate | Последний подтверждённый факт | Статус / предел |
| --- | --- | --- |
| Reviewer / App access | Основной агент прочитал форму: Yes/restricted; dedicated Google username/password заполнены; English instructions указывают Sign in with Google и отдельный аккаунт; full access checked | **CONFIGURATION CONFIRMED, ACTUAL LOGIN NOT RUN**. Чтение заполненных полей не удостоверяет работоспособность ревьюерского входа. Credentials в отчёт не включены. |
| Content rating / target audience | Нет актуального чтения соответствующих форм | **UNKNOWN / NOT RUN**. Ответы из исторического TWA-черновика не переносятся. |
| Alpha | 3.1.2 / 119, Available to testers, Full rollout, 178/178 регионов | **CONFIRMED для 119**. Это не результат загрузки или доступности 120. |
| Data safety Files and docs | Основной агент сохранил Collected Yes / Shared No / non-ephemeral / optional / App functionality; Console показала `Change saved. Send for review in Publishing overview.` | **SAVED, REVIEW NOT SENT**. Остальные формы в этой операции не менялись. |
| Publishing overview / Google review | В последнем срезе Send for review не выполнен; финальный AAB и новые скриншоты не загружены | **NOT RUN**. Save, upload, review submission, Google approval и rollout учитываются раздельно. |
| Production access | Inactive, 11 opted-in, Apply disabled; требуется ≥12 непрерывно 14 дней и решение Google | **BLOCKED по последнему Console-срезу**. Готовность Alpha-кандидата не открывает Production автоматически. |

В отчёт не включены аккаунты, пароли, private Console IDs или содержимое скриншотов. Эти unknown не закрываются локальными unit/UI PASS, статической подписью AAB либо исходным `PLAY_DISTRIBUTION=true`. После новых фактических проверок основной агент может приложить соответствующие результаты; этот отчёт не меняет формы и не отправляет релиз.

Сохранённые официальные основания и их дата: [play-policy-review.md](play-policy-review.md). Ограничения и фактические ответы Console: [play-console-readonly-final.md](play-console-readonly-final.md). Матрица и release-checklist этим проходом не изменялись.
