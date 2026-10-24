# Calendar context v2

GENESIS distinguishes an ISO civil date (`YYYY-MM-DD`) from an instant. Displaying a different calendar, language, or year start never rewrites a saved civil date, completion, reward receipt, or materialized occurrence.

## Astronomy and supported range

`app/calendar-context.ts` defines the wire context: algorithm version, IANA time zone, and Gregorian year start (`january` or `march`). New rules use version 2; saved rules without a version use version 1. Display context and recurrence context are independent. Date-only adapters use a local-field `Date` carrier, not UTC midnight.

The provider remains `astronomy-engine@2.1.19`: `Seasons().mar_equinox` and `SearchMoonPhase(0, …)`. These are calculated instants, not observations. Numerical search tolerances in the pinned engine are 0.01 seconds for solar longitude and 0.1 seconds for lunar phase; they are not claims of physical or observational accuracy. UTC millisecond results are retained. PHP's day projection floors to seconds; no event in the shared boundary vectors changes its civil day as a result. The engine approximates UTC and UT1 as equal.

Selectable dates are 1900-01-01 through 2100-12-31. Internal boundary data extends around that range: solar years 1898–2102, lunar-year boundaries 1898–2102, and surrounding new moons. This lets an entire reporting year containing a supported date end in 2101. Exhausting the ephemeris is an explicit error, never a guessed event. Date pickers bound navigation and retain an out-of-range stored value until the user explicitly changes it. Generated public data in `server/resources` and Android is reproducible using `node android/tools/export-calendar.mjs`; it contains no account or runtime data.

IANA zones supported by the runtime and UTC are accepted. Ambiguous abbreviations are rejected for new contexts. Legacy Google `GMT` is read as UTC. Zone rule versions come from the browser/Java/PHP runtime; runtime timezone updates may affect future political timezone changes. Shared cross-platform vectors cover UTC, Moscow, New York and Auckland.

## Day and period boundaries

An astronomical event opens the **whole local day containing that instant** in the context's time zone. A day cell is never divided between two years. A version 2 sacred year starts on the actual local equinox date, keeping the existing twelve 30-day months and the remaining Apeiron days. A lunar year starts at the first new moon strictly later than the equinox instant. A new moon earlier on the same local day is excluded. Lunar years contain 12 or 13 actual lunar months.

Internal periods are half-open `[start,end)`. Existing UI/API adapters explicitly subtract one civil day to expose an inclusive end. Gregorian March years cover March through the following February and have a two-year label. Existing product quarter groups are retained; Apeiron remains a separate residual period. The year mosaic enumerates the calculated interval, including the final date of a lunar year longer than 370 days.

## Saved rules and daylight saving time

Version 1 sacred recurrence retains the former fixed March 20 start. There is no automatic migration of historical rules to version 2. Existing canonical due dates, exclusions, occurrence IDs, completion history, XP and reward transactions remain intact. The old no-due-date migration separately retains JavaScript overflow behavior to avoid changing a historical Apeiron day 6. New date entry and inverse conversion reject invalid dates.

New recurring rules store their own context and `invalidDayPolicy: skip`. Missing month days and absent lunar month 13 are skipped; Apeiron is excluded from sacred repetition. Editors show next occurrences, the rule's time zone, and the legacy rule notice where applicable. Existing quest periods and reward IDs retain their saved civil boundaries instead of following display changes.

For version 2 wall-clock scheduling, a nonexistent local time moves forward by the DST gap; a repeated time chooses its earlier offset. One scheduled date/time has one occurrence. Java's `atZone`, the web resolver, and the PHP resolver share this policy. An elapsed 24-hour duration adds milliseconds; “tomorrow at this local time” advances a civil date and resolves the wall time again. The older explicit `resolveReminderTime` validation API still rejects gaps for callers requesting manual correction.

Google version 2 timed RDATE values are emitted as single UTC instants in the saved rule zone. Managed event metadata preserves the original wall date/time when Google returns a gap-adjusted instant. A real external edit to that instant is accepted. Date-only Google values remain civil dates; legacy timed RDATE syntax is unchanged.

## Verification and rollout

Meaningful tests cover full sacred round trips, equinox/local-day boundaries, new moon ordering, leap days and invalid dates, four year configurations, context-specific caches, real long lunar years, report boundary years, legacy rules, persisted task series, history/reward preservation, DST gaps and overlaps, and Google round trips. Android and PHP compare against 193 generated web vectors and Android also checks recurrence vectors.

No database migration or manual production data change is required for this stage. New fields are optional for old clients. Code rollback uses the existing Git revert/deploy workflow. Shared series, templates, goals, imports, notifications and sprint features now consume this context through the B/C/E/F/G releases. The [K/U/L acceptance](genesis-kul-acceptance-2026-10-24.md) adds cross-feature web/PHP/native boundary tests, the complete384-day lunar-year report, and actual localized report rendering. See `genesis-improvements-progress-2026-10-14.md` for release results and explicit verification limits; future features still require the same context contract.
