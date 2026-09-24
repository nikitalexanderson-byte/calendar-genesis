# GENESIS Android — internal alpha

## Текущий этап: alpha05 — нативный перенос задач и содержимое дня, 24.09.2026

- Нативный debug APK `2.0.0-alpha05` / versionCode 10, пакет `ru.genesis.calendar.debug`: `android/app/build/outputs/apk/debug/app-debug.apk`. Размер **157874625 bytes**, SHA-256 **be2e8703565ab9d8ebbc15f432817bf448ae1ca0b83704c6fca8a816b1f5e2d3**. Подпись APK v2 и выравнивание проверены; установлено на согласованный realme RMX5000 поверх alpha04 без очистки данных. TWA/PWA `ru.genesis.calendar` не трогали.
- В «Проектах» в теме Experimental можно удержать **любую часть строки задачи**: исходная строка тускнеет, появляется плавающая карточка и виброотклик, цель подсвечивается, отпускание переносит задачу между проектами или Хаос-боксом. Для длинного списка проектов есть доступная альтернатива — окно выбора с поиском. Фриз месяцев убран с экрана проектов, но сохранён в APK; отдельные иллюстрации месяцев остаются в сакральном календаре. Изменения оформления Standart не вносились.
- В календарных ячейках Experimental есть графические лунные фазы, задача/солнечная отметка; выбранный день показывает задачи и дополнительные сведения, пяты раскрываются. Экспортированы точные моменты равноденствий и солнцестояний 1900–2100; 30-шаговый лунный значок приблизительно интерполирует фазу и может слегка расходиться с web astronomy. «Сегодня» получило оригинальную иллюстрацию дня, ритм суток и смысловой блок. В «Привычках» находятся сон/настроение и исходные изображения рангов, достижений и наград. Стойхейон показывает 24 карточки с буквами, греческим орнаментом и авторскими профилями; серверный расклад не перенесён.
- `assembleDebug`, `assembleDebugAndroidTest`, `testDebugUnitTest` (**61 PASS**), `lintDebug` — PASS. `export-calendar.mjs --check` PASS. `verify-assets.mjs --require-apk`: **527/527** упакованных оригиналов побайтово совпали с web-источником; 31 другой public media ещё требует оценки, полный визуальный паритет не заявлен. На realme общий обычный UI-прогон **15 PASS**, включая обе стороны drag-and-drop, с сохранением исходных настроек; после установки alpha05 оба жестовых сценария повторно **2 PASS**. Screen-off тест напоминания требует отдельной последовательности и в эти 15 не входит. Скриншот жеста: `android/app/build/projects-drag-preview-after.png`.
- Не готовы для обещания «останется только Google»: web↔Android синхронизация и импорт, повторяющиеся задачи в UI, расширенные поля задач, наградные транзакции/испытания, полноценный расклад Стойхейона, часть аналитики и настроек, полная локализация, админка и другие строки `PARITY_MATRIX.md`. Google OAuth отложен по просьбе владельца; публичная публикация не выполнялась. Проверка крупных шрифтов/TalkBack/поворота/планшета и ширин 360/390/768/1440 для обеих тем не проводилась. SSH не использовался.

## Предыдущая веха: календарь месяца и года, 24.09.2026

- Нативный **debug APK `2.0.0-alpha04` / versionCode 9**, `ru.genesis.calendar.debug`: `android/app/build/outputs/apk/debug/app-debug.apk`, копия `outputs/android/GENESIS-2.0.0-alpha04-debug.apk`. Размер **158041284 bytes**, SHA-256 **c05bc664f8299efc8f1d6337d46e4667521f2fa9e389ada8da1348f70c57cfc3**. `apksigner verify` PASS (v2), `zipalign -c -P 16 4` PASS. Это не TWA/PWA и не release.
- Вместо нативного длинного списка появился экран месяца с сакральной сеткой пятидневных пят, выбранным днём и переходом к его задачам; в григорианском/лунном отображении — семиколоночная сетка. Сакральный месяц показывает свою исходную иллюстрацию, название и полное описание без многоточия; обзор года содержит все 13 исходных иллюстраций, включая Апейрон. Эти изменения не меняют независимые настройки календаря ввода/повторов задач. Отдельные солнечные показатели, полная web-композиция года и drag-and-drop остаются в матрице как неперенесённые.
- `assembleDebug`, `assembleDebugAndroidTest`, `testDebugUnitTest` (**59 PASS / 0 failures**), `lintDebug` — PASS. `verify-assets.mjs --require-apk`: **527/527** выбранных оригинальных изображений совпадают побайтово public → generated → APK; визуальный паритет NOT_RUN.
- Финальный alpha04 установлен через `adb install -r` поверх alpha03 без очистки; `dumpsys package` подтвердил versionCode9. После обычной разблокировки владельцем `CalendarFlowTest` **1 PASS** на realme RMX5000: сакральный месяц, оба варианта темы, год с Апейроном, переход в Апейрон и затем в задачи выбранного дня. Четыре снимка из установленного APK находятся в `outputs/android/calendar-alpha04/`; исправление обрезанного описания Апейрона визуально перепроверено после пересборки. Первый запуск теста был прерван закрытием приложения пользователем, повторный и финальный запуски завершились `OK (1 test)`. Полные 13 месяцев по отдельности, григорианский/лунный экран, крупный текст, TalkBack, поворот, планшет и матрица 360/390/768/1440 для обеих тем — **NOT_RUN**. Обхода блокировки не было.
- Figma-экран 14 уточнён текстом обязательных маркеров; нативный Теокиклос предыдущей alpha03 проверен отдельно. Точный Figma design-context недоступен из-за лимита вызовов коннектора; исходный Figma-круг остаётся схематичным. Production, SSH, push/merge не выполнялись.

## Предыдущая веха: Теокиклос, 24.09.2026

- Нативный **debug APK `2.0.0-alpha03` / versionCode 8**: `android/app/build/outputs/apk/debug/app-debug.apk`, копия `outputs/android/GENESIS-2.0.0-alpha03-debug.apk`. Package `ru.genesis.calendar.debug`, не TWA/PWA `ru.genesis.calendar`. Размер **157970671 bytes**, SHA-256 **eae1a04627b48113360d0e6e3413a9f954313d31e14c78a57adbd294c0832c18**. `apksigner verify` PASS (v2), `zipalign -c -P 16 4` PASS.
- Новый Compose-экран «Теокиклос» встроен в существующее верхнее меню. Из исходников сайта механически экспортированы 14 секторов, 56 сакральных слов и 28 практик; все 14 исходных символов видны на мандале, в том числе **зенит, надир, вход, выход**, а детали показывают оригинальную иллюстрацию божеств. Практику можно начать, поставить на паузу, возобновить и отметить сегодня через уже существующее зашифрованное локальное хранилище привычек; отметка заблокирована, если сегодня не день практики. Это локальный поднабор, **не** web↔Android синхронизация.
- `assembleDebug`, `assembleDebugAndroidTest`, `testDebugUnitTest` (**57 PASS / 0 failures**), `lintDebug` — PASS. `export-theokyklos.mjs --check` PASS; `verify-assets.mjs --require-apk` PASS: **527/527** выбранных оригинальных файлов побайтово соответствуют public → generated → APK. Полный визуальный/функциональный паритет NOT_RUN; 31 public media вне текущего манифеста ещё требуют оценки.
- На согласованном realme RMX5000 (Android 16/API36) APK установлен через `adb install -r` без очистки. Инструментальный `TheokyklosFlowTest` **1 PASS**: существуют все 14 узлов с 48dp зонами касания, детали четырёх обязательных маркеров открываются; скриншоты Standart/Experimental и Зенита получены с телефона в `outputs/android/theokyklos-alpha03/`. После финальной пересборки/теста `am start -W` — **Status ok, COLD, 1227 ms**. Обе темы проверены только для этого экрана на данном телефоне, не для всей матрицы ширин/состояний.
- Figma-файл `GENESIS Android — Universal UI` просмотрен в открытом браузере; подпись экрана 14 уточнена до «14 сил · зенит · надир · вход · выход». Круг в исходном макете пока условный (без 14 оригинальных сигилов), поэтому нативная композиция сознательно развивает его, а не выдаётся за точную пиксельную копию. Figma MCP вернул лимит вызовов; полноценная синхронизация нового экранного макета и проверка design-context недоступны. Production, SSH, push/merge не выполнялись.

## Предыдущая веха: проекты и категории, 24.09.2026

- Ветка `codex/android-native-bootstrap` обновлена до `origin/master` 30257ff; исходники alpha02 и тесты развиваются локально в этом worktree. Нет push/merge/deploy. Debug APK `2.0.0-alpha02` / versionCode 7, `ru.genesis.calendar.debug`: `android/app/build/outputs/apk/debug/app-debug.apk` и копия `outputs/android/GENESIS-2.0.0-alpha02-debug.apk`.
- Итоговый артефакт: **157842753 bytes**, SHA-256 **d45ae7002a0b25be87ef4a14ee969234bd682fff1b221134f166cfd1696eaa1e**. `apksigner verify` PASS, v2; `zipalign -c -P 16 4` PASS. Все 527 оригинальных изображений имеют побайтовое соответствие public → generated → APK; полный визуальный паритет NOT_RUN.
- Проекты/категории/связи списков теперь имеют web-совместимые имена полей в зашифрованном локальном документе. Задачи сохраняют `projectId/categoryId`; старые записи читаются как Хаос-бокс. Экран «Проекты» и редактор задач связывают проект с задачами. Experimental получает палитру и оригинальный фриз из web; схема Standart не менялась. Точный аудит, границы и источник — `PROJECTS_STAGE.md`.
- `assembleDebug`, `testDebugUnitTest` (**54 PASS / 0 failures**), `assembleDebugAndroidTest`, `lintDebug` — PASS. `pnpm install --frozen-lockfile`, lint, test и build:beget — PASS на свежем master. Standalone PHP проверка прежней alpha остаётся отдельной от live auth.
- Владелец подключил согласованный realme RMX5000; `adb devices` показал одно устройство `device`. Alpha02 установлена поверх Alpha01 через `adb install -r` без очистки, старое `ru.genesis.calendar` сохранено. `am start -W` после тестов: **Status ok, COLD, 1128 ms**. `ProjectsFlowTest` **2 PASS**, `NativeUiTest` **3 PASS**, `PreferencesTest` **1 PASS** на физическом телефоне. Синтетические записи предыдущей Alpha видны после обновления; это не полная проверка миграции пользовательских данных.
- Итоговые скриншоты реального телефона: `outputs/android/device-projects/projects-{standart,experimental}-overview.png` и `projects-{standart,experimental}.png`. Исправлены контраст ссылок Experimental и порядок блоков: проекты расположены выше Хаос-бокса. Browser workspace обеих тем остаётся непроверенным без входа.
- Browser reference captured at 360/390/768/1440 px для Standart и локально принудительно включённого Experimental CSS; без Google login видна только публичная страница входа. Это не проверка web Projects workspace или нативного экрана. Файлы `outputs/android/web-reference/`.
- Сервер требует авторизованную сессию и CSRF для `/workspace`, парольный вход отключён (410). Поэтому структура подготовлена для будущего синхронизатора, но **не синхронизирована**. Полный task wire adapter, ключ workspace, CAS/merge, импорт и разграничение аккаунтов остаются следующими этапами. Production и SSH не затрагивались.

## Предыдущая веха: alpha01 (исторические результаты)

Обновлено 23.09.2026, Europe/Moscow. Полный release **не готов**. Production не менялся; SSH не использовался.

## Рабочая точка и APK

- Тогда ветка `codex/android-native-bootstrap` имела базу `origin/master` = `ebfb460`. Позднее она перебазирована на 30257ff. Worktree `.worktrees/android-native-bootstrap`, существующий модуль `android/`; пользовательские изменения основного checkout сохранены.
- На согласованный realme RMX5000 / Android16 API36 установлена `ru.genesis.calendar.debug`, `2.0.0-alpha01` (6). Старое `ru.genesis.calendar` не удалено. Данные Alpha изолированы от аккаунта.
- Тогдашний APK сохранён как `outputs/android/GENESIS-2.0.0-alpha01-debug.apk` вне Git; текущий build output уже содержит alpha04.
- **157641687 bytes**, SHA-256 **f9dc04317775bb260f767d051012dc18b768d7060b0655660dead970bee45e60**.
- Первоначальный commit был `741924e`; после локального rebase это `e7f3f46` (документация `8090fe4`). APK alpha01 был собран до commit из того же main-source дерева. Push/merge/deploy не выполнялись.
- `apksigner verify`: PASS, APK v2, debug RSA2048. `zipalign -c -P 16 4`: PASS; ELF PT_LOAD alignment отдельно NOT_RUN.

## Реализованный локальный поднабор

- Compose: Сегодня, задачи, календарный список, привычки, трекеры сна/настроения, настройки. Авторские часы, три выбора даты, шкала приоритета; полного визуального паритета нет.
- Room + Android Keystore AES-GCM для содержимого задач/привычек/трекеров; backup отключён. Метаданные расписания без дополнительного field encryption.
- Задачи: создание/редактирование/завершение/удаление, одно локальное напоминание. AlarmManager, системные notification actions, защита stale revision/повторов.
- Три календарных движка, recurrence domain, поднабор привычек/XP/Лавров, исходные sleep/mood/addiction rules. Domain-only функции не объявлены готовым UI.
- 527 оригинальных изображений без перекодирования, SHA-256 public → generated → APK PASS.
- Workspace crypto codec и native Google auth client/server routes в локальной ветке. Реальный вход/cloud workspace/Google grants **не готовы**. Auth panel не переключает локальные черновики и не вызывает bootstrap.

## Проверки

Из `android/`, JAVA_HOME = Android Studio `jbr`:

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleDebugAndroidTest :app:lintDebug --no-daemon --console=plain '-Pandroid.builder.sdkDownload=false'
```

- BUILD SUCCESSFUL, 2m50s. **50 JUnit tests PASS**, 0 failures/errors: calendar9, habits8, rewards/goals6, habit document4, trackers11, crypto7, auth5.
- Lint: **0 errors / 37 warnings**, не скрыты. Отчёты `android/app/build/reports/`.
- Portable PHP8.3.35: syntax checks трёх затронутых PHP файлов PASS, **44 standalone auth checks PASS**. Это не HTTP/session integration и не независимый security review.
- Web: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test` (**64 PASS**), `pnpm build:beget` — PASS. Изменён только legacy test Android launcher/version/signing; сайт/темы/публичный APK не менялись. Есть предупреждение о размере JS chunks. Фактический pnpm11.25.0, packageManager проекта11.19.0.
- Source vector generators `--check`, WebCrypto reference и assets byte parity — PASS.
- Realme: формы задачи/привычки/настроения **3 PASS**; сохранение 36 сочетаний настроек без изменения TaskRecords **1 PASS**, исходные настройки восстановлены. Это persistence matrix, не 36 визуальных снимков.
- Screen-off + обычное убийство процесса: системный alarm доставлен; action «Выполнено», повтор action без изменения revision, отмена notification и чтение в новом процессе — PASS.
- Snooze/stale test PASS отдельно с прямым delivery, не вместо AlarmManager-теста.
- После последнего теста владелец подтвердил **«звук был»**. Слышимость уведомления на realme подтверждена; первый screen-off тест он не слышал, поэтому звук именно при погашенном экране/Doze отдельно не подтверждён. DND off, громкость16/16, канал sound/vibration настроен. Открытие уведомления и подробности — `DEVICE_TESTS.md`.

## Ограничения / блокеры

1. Native auth backend не опубликован; Android OAuth registration не подтверждена. Browser tool недоступен (`Unable to load browser request-header policy`); cookies/секреты не извлекались. Нужен доступ владельца к соответствующему Google Cloud project.
2. Нужны isolated HTTP/session tests и независимый review verifier, проверенный global/edge rate limit перед public deploy.
3. Cloud schema/merge/CAS/outbox transport, recovery, Google grants и FCM не интегрированы. Server escrow не является zero-knowledge E2EE.
4. Полные проекты/перетаскивание/зависимости/повторения UI, аналитика/испытания/награды, Стойхейон, полный Теокиклос, admin, локализация и другие строки PARITY_MATRIX не готовы. Standart/Experimental частичны. Исходные изображения месяцев имеют native month/year slots, но ещё не проверены на устройстве; ранги и награды упакованы, но не размещены во всех смысловых слотах.
5. Нет согласованной постоянной release signing identity/backup, release OAuth, N→N+1, verified App Links и разрешения на публичную публикацию. Debug download CTA не включать.
6. Слышимость последнего уведомления подтверждена владельцем; vibration, звук при screen-off, reboot/Doze/offline/timezone/отзыв permissions/несколько OEM/release update и полный visual/accessibility matrix — NOT_RUN.

## Одно следующее действие

После обычной разблокировки realme повторить `CalendarFlowTest`, сохранить и проверить скриншоты обеих тем, года и Апейрона. Затем продолжить ранги/награды, Стойхейон и drag-and-drop проектов с доступной альтернативой; закрывать остальные строки `PARITY_MATRIX.md` и интеграционные тесты. Настройка Google-входа остаётся последним этапом по просьбе владельца; подпись и public deploy — отдельные gates владельца.
