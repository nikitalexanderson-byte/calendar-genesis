# Выпуск GENESIS в Google Play

Документ актуализирован для нативного Android-приложения GENESIS 2.3.10 на 30 сентября 2026 года.

## Техническая база

- package name: `ru.genesis.calendar`;
- `minSdk 26`, `targetSdk 37`;
- сайт и API: `https://genesiscalendar.ru`;
- прямой канал обновлений: подписанный APK на сайте;
- Google Play: подписанный Android App Bundle (`.aab`);
- production signing key уже используется CI и не должен попадать в Git, OneDrive, webroot или документацию.

Локальная проверка сборки без production-секретов:

```powershell
cd android
.\gradlew.bat :app:bundleRelease -PgenesisUrl=https://genesiscalendar.ru/
```

Без четырёх переменных `GENESIS_ANDROID_SIGNING_*` bundle будет собран без production-подписи. Публичную сборку следует выпускать только в защищённом CI с существующим ключом.

## Рекомендуемый владелец аккаунта

Для бесплатного GENESIS разумнее зарегистрировать собственный российский personal account с настоящими российскими данными. Google по состоянию на 30 сентября 2026 года отмечает Россию как страну, где разрешена регистрация разработчиков, и прямо разрешает российским разработчикам выпускать новые бесплатные приложения и обновления. Выплаты на российский банковский счёт и платежи Google Play Billing при этом приостановлены.

Аккаунт знакомого в США подходит только если Юра действительно становится юридическим владельцем и издателем приложения: использует свои реальные данные, принимает договор Google, отвечает за налоги, поддержку и соблюдение политик. Не следует указывать его адрес или страну как формальную замену российским данным. Если приложение должно принадлежать вам, создайте свой аккаунт, а Юру добавьте пользователем Play Console или тестировщиком.

Официальные источники:

- [страны регистрации разработчиков и продавцов](https://support.google.com/googleplay/android-developer/answer/9306917?hl=en-GB);
- [ограничение монетизации для российского банковского счёта](https://support.google.com/googleplay/android-developer/answer/15685001?hl=en);
- [документы для проверки разработчика из России](https://support.google.com/googleplay/android-developer/answer/15633622?co=GENIE.CountryCode%3DRU&hl=ru);
- [данные, необходимые для аккаунта](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en).

## Регистрация Play Console

1. Создать отдельный Google Account владельца и включить двухэтапную аутентификацию.
2. Зарегистрировать personal account в Play Console и оплатить разовый сбор USD 25. Оплата и доступность конкретной карты проверяются самим регистрационным окном.
3. Указать настоящее имя, российский адрес, рабочие email и телефон. Подготовить российский документ с фотографией и подтверждение адреса; данные должны полностью совпадать с payments profile.
4. Пройти device verification на реальном, не модифицированном Android-устройстве через мобильное приложение Play Console. Эмулятор эту проверку не заменяет.
5. Оставить приложение бесплатным, пока для владельца используется российский счёт выплат.

Для organization account дополнительно нужен D-U-N-S, документы организации, сайт организации и данные уполномоченного представителя. Для индивидуального продукта personal account проще и имеет те же функции публикации.

## Подпись и совместимость каналов

1. Сохранить защищённую резервную копию существующего production JKS и его паролей. Проверенный CI-сертификат имеет SHA-256 `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`.
2. Включить Play App Signing. Предпочтительный вариант — передать Google существующий app-signing key через официальный PEPK-процесс, а для будущих загрузок создать отдельный upload key.
3. Если выбрать новый app-signing key от Google, приложение из Play не сможет обновить установленный APK с сайта и наоборот. Тогда также изменятся OAuth SHA-1 и SHA-256 для App Links.
4. Добавить SHA-1 сертификата Play App Signing в Android OAuth client для `ru.genesis.calendar` в Google Cloud.
5. Добавить SHA-256 сертификата Play App Signing в `https://genesiscalendar.ru/.well-known/assetlinks.json`, сохранив отпечаток прямого APK, если оба канала должны открывать проверенные ссылки.
6. Собрать signed `.aab` в CI, проверить `versionCode`, package name и сертификат, затем загрузить bundle во внутренний трек.

Никогда не переносить ключ, base64 keystore или пароли через чат, issue, артефакт сайта или Git.

## Карточка и раздел App content

Подготовить:

- название, короткое и полное описание на русском и английском;
- иконку 512×512, feature graphic 1024×500, скриншоты телефона, 7- и 10-дюймового планшета;
- email поддержки и страницу политики конфиденциальности на HTTPS;
- Data safety по фактическим данным приложения и используемым Google SDK;
- URL удаления аккаунта и описание удаления данных;
- content rating, target audience, Ads declaration и App access для ревьюера;
- декларацию `USE_EXACT_ALARM`: GENESIS является календарём и показывает уведомления о событиях, задачах и привычках в выбранное пользователем время.

Требование target API для новых приложений и обновлений с 31 августа 2026 года — Android 16 / API 36; `targetSdk 37` GENESIS его выполняет. Политика точных будильников допускает календарные приложения с уведомлениями событий, но использование разрешения проверяется Google.

- [требования target API](https://developer.android.com/google/play/requirements/target-sdk);
- [политика разрешений и `USE_EXACT_ALARM`](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en);
- [точные будильники в Android 13](https://developer.android.com/about/versions/13/features#use-exact-alarm-permission).

## Тестирование и публикация

1. Internal testing: загрузить первый `.aab`, проверить установку, вход Google, синхронизацию, уведомления после закрытия процесса, обновление и удаление аккаунта.
2. Closed testing: для нового personal account, созданного после 13 ноября 2023 года, нужны минимум 12 подключённых тестировщиков непрерывно 14 дней.
3. Добавить Samsung S23 тестировщика в закрытый трек и проверить реальную One UI: Notifications, Alarms & reminders, Battery → Unrestricted и Never sleeping apps. Android Emulator не содержит Samsung One UI и не может доказать поведение её службы энергосбережения.
4. После 14 дней заполнить заявку Production access, описав найденные проблемы, тесты и исправления.
5. Выпустить сначала staged rollout 10–20%, следить за Android vitals, ANR, crash rate, отзывами и доставкой напоминаний; затем повышать долю.

Официальное правило закрытого теста: [12 тестировщиков в течение 14 дней](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB). Правила проверки аккаунта: [developer identity verification](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en).

## Чек-лист каждого обновления

1. Поднять `versionCode`, обновить `versionName` и release notes.
2. Выполнить unit, lint, web build, emulator matrix и тест обновления N→N+1 без очистки данных.
3. Собрать APK для сайта и AAB для Play одним commit и одним production signing identity.
4. Сначала загрузить AAB во внутренний трек и проверить pre-launch report.
5. Выпустить сайт штатным GitHub Actions, проверить `/deploy-meta.json`, `/api/health` и SHA-256 APK.
6. Запустить staged rollout Google Play и записать Play release ID в отчёт выпуска.

Откат сайта выполняется через `git revert` и штатный deploy. Google Play не понижает `versionCode`: для отката нужно собрать исправленную версию с новым, большим `versionCode`.
