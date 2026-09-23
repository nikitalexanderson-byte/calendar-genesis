# Native calendar port — internal alpha

Source baseline: `ebfb4601cd7d2e96dfcebc3a47d1145be03ca48c`; implementation is currently an uncommitted Android working tree change. No web algorithm, backend, database, or source artwork changed. SSH was not used.

## Implemented contracts

Pure Kotlin code is in `android/app/src/main/java/ru/genesis/calendar/domain`. It uses Java time (Android API 26+) and does not require Android Context, network, a browser, or JavaScript at runtime.

- `GenesisCalendar(zoneId)` converts `LocalDate` to sacred/lunar dates and back from sacred coordinates. Gregorian/sacred/lunar month and year ranges are independent of display settings.
- `SacredCatalog.months`: all 13 original month definitions, 366 original Russian day names/descriptions, pentad names/numbers, original month colors/symbols. `lunarMonths`: all 13 original lunar definitions. Generated directly by executing the actual web parser, not manually retyped.
- `RecurrenceEngine.normalize/resolve/matches/buildDates`: classic daily/weekday/monthly/yearly; sacred pentad/day selections, month filters, pentad filters and exclusion of Apeiron; lunar day/month selections with real new moons; bounded 1-year default/5-year maximum range exactly as web. Interval fields in sacred/lunar modes follow the source behavior (not newly invented semantics).
- `datesForTask`: respects excluded dates and prevents double expansion of already materialized series and Google Task copies, including the source fallback behavior.
- `CalendarPreferences(displayCalendar, taskCalendar, use24HourTime)` keeps the three settings independent. It does not persist settings or mutate existing tasks.
- `resolveReminderTime`: explicit DST overlap policy, rejects gaps for user correction. This is an explicit native scheduling contract; it is not a claim that web already implements the same rejection behavior.

## Astronomical source and supported horizon

The sacred year in the current web source starts **March 20**, regardless of the exact astronomical equinox instant. Twelve 30-day months are followed by 5 or 6 Apeiron days. Kotlin preserves that rule; it does not substitute a different equinox calendar.

The lunar calendar uses the existing `astronomy-engine` **2.1.19** `SearchMoonPhase` and `Seasons` calculations. The generator exports **2,537 exact UTC new-moon instants** plus the index of the first new moon after each spring equinox. Kotlin converts these instants using the selected `ZoneId`, just as web takes local calendar fields of the calculated instant. Mean synodic month is used only by the existing web algorithm to locate a search window, never as a substitute for actual new moons.

Supported user dates: **1900-01-01 through 2100-12-31**. Padding covers neighboring months/years. Outside the horizon, lunar operations throw an explicit exception with an update-required message; there is no silent approximate fallback. UI must validate its input range and show this limitation. Extending the horizon requires regenerating and retesting the tables.

Date-only values remain `LocalDate`. They are never stored as UTC-midnight instants. A lunar day begins on the local civil date of the exact new moon, matching web, not necessarily at that instant. Date iteration uses civil days, not 86,400-second increments.

## Provenance and reproducibility

From repository root with dependencies installed:

```powershell
node android/tools/export-calendar.mjs
node android/tools/export-calendar.mjs --check
```

The second command is read-only validation of generated Kotlin against current web sources. The generator transpiles and executes `app/calendar-data.ts` and `app/task-recurrence.ts`; only raw-file import/localization adapters are supplied. It never loads user account data or secret files. At runtime Android reads generated native constants, not JS.

Source SHA-256 at generation:

| Source | SHA-256 |
|---|---|
| app/calendar-data.ts | `2a216b40af42a815f648776e9bf66ec3b4a9a07e63f97fcd618ac1e884192b7d` |
| app/task-recurrence.ts | `3895e8f48ae5de6f137e9d9ef483cb3dcce313e3a1f51b45285becf79f09c25f` |
| references/days.txt | `5509d712affb4d1b9a54a0c6a988260e26718a2f20e526900ef74d5110c27226` |

## Verification

Executed 2026-09-23 on native Windows:

- `node android/tools/export-calendar.mjs`: PASS; 13 months, 366 days, 2,537 moments, **177 web date vectors** across Europe/Moscow, America/New_York, Pacific/Auckland and UTC, **9 web recurrence vectors**.
- `node android/tools/export-calendar.mjs --check`: PASS; byte-for-byte generated content matches.
- `git diff --check -- android/app/src/main/java/ru/genesis/calendar/domain android/app/src/test/java/ru/genesis/calendar/domain android/tools/export-calendar.mjs`: PASS (tracked diff scope only; generated files are new).

`GenesisCalendarTest` validates these real web vectors, sacred round trips, all month/day definitions, 29/30-day boundaries for every lunar month of 2026 in four zones, leap years/century boundary/Apeiron, recurrence range/interval/month filters, leap-day yearly and 31st monthly behavior, occurrence exclusions, independent preferences, DST gap/overlap and explicit ephemeris exhaustion. Gradle/unit execution belongs to the main integration run; this document does not claim tests passed before that run. Requires JUnit 4.13.2.

## Remaining parity work

- Precise observed lunar phase angle, illumination/epithets and solar-event UI data are not yet native APIs. The offline table implements exact date/month boundaries, not the complete astronomical engine; do not display invented phase percentages.
- English day translations and all localized formatting strings remain to be wired to native localization. Original Russian source is included intact.
- Raw legacy task-to-recurrence configuration migration is not exposed here; integration supplies normalized `RecurrenceConfig`. Backend IDs, task completion/exception persistence, account syncing, and notification scheduling are separate integration responsibilities.
- Author-specific Compose controls, visual parity, server-backed settings, and complete app acceptance cannot be inferred from these domain tests. CAL01/CAL03 need the integrated unit results; CAL02 also needs runtime reminder/timezone tests.

Next domain action: run the integrated `:app:testDebugUnitTest --tests '*GenesisCalendarTest'`, record its actual result, then connect these APIs to the original native date selectors and task recurrence forms.
