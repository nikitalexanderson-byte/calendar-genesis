# Realme: device evidence, 23.09.2026

Device: agreed realme RMX5000, Android16/API36, one authorized adb device. Serial/account data excluded. Package `ru.genesis.calendar.debug` only; test runner `.debug.test/androidx.test.runner.AndroidJUnitRunner`. APK/version/hash and source snapshot: STATUS.md. No release claim.

## Reproduction

From repo root, with SDK at `%LOCALAPPDATA%\Android\Sdk`:

```powershell
& .\android\tools\device-test.ps1 -Stage prepare
# After preparation: Home, screen off, ordinary am kill (not force-stop).
# Wait at least 90 seconds; no runtime/security settings are changed.
& .\android\tools\device-test.ps1 -Stage complete
& .\android\tools\device-test.ps1 -Stage persist
& .\android\tools\device-test.ps1 -Stage snooze
& .\android\tools\device-test.ps1 -Stage diagnostics
& .\android\tools\device-test.ps1 -Stage ui
& .\android\tools\device-test.ps1 -Stage preferences
# Owner must unlock normally before opening test:
& .\android\tools\device-test.ps1 -Stage open
```

Install/update commands used: `adb install -r <debug-apk>`, `adb install -r -t <androidTest-apk>`; existing app data retained. Main APK was staged in an ASCII temporary path for Windows tools. Test script requires exactly one device and actual JUnit `OK`, not merely adb exit0. Reports: `android/app/build/reports/device/<stage>.txt` (generated/ignored). All test records are synthetic, isolated from cloud account data.

## Observed results

| Scenario | Result / scope |
| --- | --- |
| First prepare around 19:17 Moscow | PASS: save/read through independent Room connection, ciphertext excludes plaintext title, +90s alarm. Notification delivered; measured delay1439ms. |
| Second screen-off prepare 19:32:42, complete around19:34 | PASS: delivered row + real active notification; actual Complete PendingIntent, repeated action leaves revision unchanged; done persisted, reminder cancelled, notification removed. |
| Fresh-process persistence | PASS, repeated after final APK update: done/cancelled retained, restore/stale delivery does not re-notify. This is not reboot/Doze proof. |
| Snooze/stale/cancel | PASS: future snooze, repeated stale request rejected, old revision cannot deliver, completion cancels. Direct scheduler delivery of a synthetic due record; not delayed alarm measurement. |
| Native forms, final APK | 3 PASS: task, habit, mood. Repeated runs retain existing synthetic rows. Tests refined to scroll to task and distinguish clickable mood choice from existing history label. |
| 36 settings combinations | 1 test PASS: 2 themes ×3 display calendars ×3 input calendars ×2 time formats, DataStore reread, TaskRecords unchanged, original settings restored. Not 36 screenshot/UI parity tests. |
| Actual system notification → stored task | PASS on unlocked phone: independent `internal-open-validation-v1` is delivered directly, UiAutomator opens notification shade and clicks visible notification, exact title and edit form asserted, synthetic task completed afterward. Not a second screen-off delivery test. |
| Notification settings | PASS for read-only diagnostics: permission/exact alarm allowed, channel importance4, soundConfigured=true, vibration=true, interruption filter ALL, ringer NORMAL, stream16/16. |
| Audible hardware signal | **PASS for the latest test event, owner-confirmed**: after the final notification-opening test the owner reported «звук был». Earlier he did not hear the first screen-off alarm; audibility specifically during screen-off/Doze remains NOT_RUN. No volume/DND/security change made. |
| Native Theokyklos alpha03 | **PASS (one test) on the same realme**: all 14 tappable symbols exist; zenith, nadir, entrance and exit open their native detail sheet; original Zeus/Hera illustration observed in the zenith screenshot. Standart and Experimental mandala screenshots captured and visually inspected. No data clear, old TWA/PWA package untouched. Practice begin/save/reopen/complete/pause on device, all 28 detail sheets, 360/390/768/1440 browser matrix, TalkBack/large-text/rotation remain NOT_RUN. |
| Native calendar alpha04 | **PASS (1 test) on the same realme, after owner unlock**: final debug APK installed with `adb install -r`, versionCode9 confirmed, no data clear. `CalendarFlowTest` verified the sacred month hero/original art, Standart and Experimental, lazy year list through original Apeiron art, opening Apeiron, selecting its first day and opening that day's native tasks. Four device screenshots were captured in `outputs/android/calendar-alpha04/` and inspected; initial Apeiron hero screenshot exposed a five-line ellipsis, removed in source and verified on the rebuilt/reinstalled APK with a second `OK (1 test)`. The first attempt after unlock coincided with the app being closed and failed before Compose hierarchy; it was not counted as PASS. Gregorian/lunar screen visuals, all 13 month details, large text/TalkBack/rotation/tablet and 360/390/768/1440 both-theme matrix remain NOT_RUN. Old TWA/PWA package untouched. |
| Native alpha06 Теокиклос и серии | **PASS 16/16 обычных UI tests на том же realme**, versionCode11 поверх alpha05 без очистки. Проверены 14 точек мандалы, открытие шести деталей, общая строка Центр/Очаг, полные названия, обе темы; локальное создание одной повторяющейся задачи, следующий день и исключение отдельной даты. Скриншоты до/после: `outputs/android/theokyklos-alpha06/`. Два предшествовавших общих прогона поймали нестабильное ожидание изображения и клавиатуры; тесты исправлены, оба отдельно и финальные 16/16 прошли. Это не screen-off/Doze, серверный расклад или live sync. |
| Native alpha07 Стойхейон | **PASS 17/17 обычных UI tests на том же realme**, versionCode12 поверх alpha06 без очистки. Карта дня, расклад, текст прямой/перевёрнутой практики, переход к Центру Теокиклоса и скрытие гадания без потери алфавита. Нативные скриншоты: `outputs/android/stoicheion-alpha07/`. Подлинный серверный лимит попыток, live sync и screen-off/Doze NOT_RUN. |
| Native alpha08 древо и жесты | **PASS 19/19 обычных UI tests на том же realme**, versionCode13 поверх alpha07 без очистки. Древо рангов, галерея достижений/лестница наград, пальцевое завершение гадания отдельно для 1 и 9 карт. Скриншоты: `outputs/android/hero-tree-stoicheion-alpha08/`. Восьмисторонняя выдача амфор и серверный sync NOT_RUN. |

Earlier opening test failed while keyguard was locked; retry against the consumed old notification also failed. Those are not PASS. Final independent actual-shade test above passed after owner unlock. No lockscreen bypass attempted.

Earlier text-field crash from stale resource/Dex ID was reproduced and fixed by rerunning build tasks; device task form subsequently passed. Screenshot from final APK: `android/app/build/reports/device/native-ui-validation.png`, inspected visually: native header/original day art/description/task, source beige/teal/gold palette. Full composition/font/36-state parity remains NOT_RUN.

## Not established

Physical vibration; sound specifically during screen-off/Doze or as a controlled before/after-update comparison; reboot/unlock, Doze, timezone, offline→online, revoked permissions, quiet hours, force-stop recovery, multiple OEM, release update, real OAuth/cloud data, all visual/accessibility states. Force stop is distinct from ordinary process death and is not bypassed. App settings on realme may impose additional background restrictions; none were disabled.

Notification permission was enabled in the standard app-specific system settings after owner authorization; realme's refusal of shell `pm grant` was not bypassed. Exact alarm access was already enabled. No old package uninstall, data clear, screen-lock/security change or production/SSH access.
