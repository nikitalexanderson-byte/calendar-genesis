# GENESIS Android — internal alpha

Обновлено 23.09.2026, Europe/Moscow. Полный release **не готов**. Production не менялся; SSH не использовался.

## Рабочая точка и APK

- Ветка `codex/android-native-bootstrap`, база `origin/master` = `ebfb460`. Worktree `.worktrees/android-native-bootstrap`, существующий модуль `android/`; пользовательские изменения основного checkout сохранены.
- На согласованный realme RMX5000 / Android16 API36 установлена `ru.genesis.calendar.debug`, `2.0.0-alpha01` (6). Старое `ru.genesis.calendar` не удалено. Данные Alpha изолированы от аккаунта.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`; копия `outputs/android/GENESIS-2.0.0-alpha01-debug.apk` вне Git.
- **157641687 bytes**, SHA-256 **f9dc04317775bb260f767d051012dc18b768d7060b0655660dead970bee45e60**.
- Working-tree build этой ветки; исходники фиксируются локальным commit после проверок. Это не clean-checkout reproducible build.
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
4. Полные проекты/зависимости/повторения UI, аналитика/испытания/награды, Стойхейон, Теокиклос, admin, локализация и другие строки PARITY_MATRIX не готовы. Standart/Experimental частичны.
5. Нет согласованной постоянной release signing identity/backup, release OAuth, N→N+1, verified App Links и разрешения на публичную публикацию. Debug download CTA не включать.
6. Слышимость последнего уведомления подтверждена владельцем; vibration, звук при screen-off, reboot/Doze/offline/timezone/отзыв permissions/несколько OEM/release update и полный visual/accessibility matrix — NOT_RUN.

## Одно следующее действие

Добавить изолированный HTTP/session integration harness для локальных native auth routes: CSRF, cookie rotation, replay и сохранность прежней сессии при отказе. Production для этого не нужен. Затем продолжать PARITY_MATRIX; OAuth, подпись и public deploy остаются отдельными gates владельца.
