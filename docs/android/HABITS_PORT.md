# Habit domain port — internal alpha

Source baseline: `ebfb4601cd7d2e96dfcebc3a47d1145be03ca48c`; files are new working tree changes. This group implements pure, immutable domain operations. It does not claim that the Android habit screens, account persistence, schema-16 workspace import, or reward synchronization are complete. No server/production operation or SSH was used.

## Implemented source mapping

All Kotlin files are under `android/app/src/main/java/ru/genesis/calendar/domain/habits`. They use the existing calendar domain API and Java time; no new runtime dependency is required.

| Web source | Native counterpart | Coverage |
|---|---|---|
| `tracker-core.ts` | `HabitCore.kt` | Tracker identity/version/sync metadata; typed schedule; default recurrence; schedule-owned calendar mode; marking changed |
| `tracker-math.ts:scoreHabitFormula` | `scoreHabitFormula` | None, binary, quality-ten, quality-bipolar; JS rounding including negative halves |
| `habits.ts:Habit/HabitCompletion` | `Habit`, `HabitCompletion`, `HabitReminder` | Identity, descriptions, appearance, key/ritual/template/practice references, preferred time, reminders, schedule, scoring, completion history |
| `habits.ts:updateHabitCompletion` | `HabitEngine.updateCompletion` | Today-only guard and creation-date guard; stable identity for existing occurrence; replace/deduplicate by habit/date; increment version/pending; calculate score; monotonic XP cap 20 |
| `habits.ts:isHabitScheduledForDate/habitScore/dailyGoalCounts/dailyGoalForDate` | `HabitEngine` | Active/schedule filtering; distinct completed IDs; preserve past goal mode, timezone, protection, unchanged timestamp |
| `habit-progress.ts` | `HeroProgress.kt`, generated `HeroRankCatalog.kt` | 28 original ranks and 8 checkpoint definitions; hidden-path gate; current/next visible rank; max-20 completion award; monotonic lifetime XP; rank/progress reconciliation |
| `daily-goal.ts` | `DailyGoals.kt` | Goal target, records/status precedence, mode changes, latest-record normalization, global streak and weighted rhythm score |
| `rewards.ts` | `Rewards.kt` | Ledger identity/normalization, earliest duplicate wins, balance, reset markers, mastery markers, daily/perfect awards and idempotent replay |

## Integration contract

`HabitEngine(GenesisCalendar(zoneId))` exposes `defaultSchedule`, `normalizeSchedule`, `isScheduled`, `score`, `updateCompletion`, `dailyCounts`, and `dailyGoalForDate`. Returned data must be persisted by the account-scoped repository. `updateCompletion` is pure: passing the returned history back on the next operation preserves the same completion identity and its previously awarded XP.

`Habit.entity` contains the web tracker metadata. Native models nest it for reuse; API serialization must flatten its fields to match the existing web schema. No new wire format, workspace, or user account has been created. The native `userId = self` reward field follows the current payload format and is not a substitute for repository/account isolation.

Timestamps and IDs can be injected for deterministic tests. Runtime IDs use a prefixed UUID, preserving opaque uniqueness rather than duplicating the web implementation's `Date.now`/`Math.random` construction. ISO timestamp parsing is intentionally typed/strict; importing malformed or historical non-ISO raw payloads requires the separate migration layer.

Current score and previously awarded XP are different fields. Unchecking a completion changes score to zero but keeps the highest award, capped at 20. `HeroProgress.reconcile` takes the maximum of stored lifetime XP and the sum of per-entry awards; it does not repeatedly add today's score. Rewards are a normalized immutable ledger, not an incremented mutable balance. Reset entries remain even at zero balance.

The source's current rule permits recording **only today**, not arbitrary historical backfill. Paused habits do not count toward the current scheduled set. Neutral/rest/protected/timezone-shift records do not themselves reset the global streak; only an explicit missed record does. No missing-history days are invented by the streak function.

Persist completion, derived progress, goal history and reward ledger atomically when integrating them. Test replay/idempotency across persistence and server retries before enabling real-account mutation. These pure functions alone are not a crash-safe transaction or full reward reconciliation workflow.

## Real web reference vectors

```powershell
node android/tools/export-habit-vectors.mjs
node android/tools/export-habit-vectors.mjs --check
```

Executed successfully on Windows 2026-09-23. The generator evaluates the actual TypeScript modules, not a duplicate JS reimplementation. For `updateHabitCompletion` it extracts the actual declarations from the large orchestration module and injects only deterministic identity/timestamp providers plus the original score/guard/XP functions. Test input is synthetic and contains no personal data.

Generated references: 64 scoring cases, 25 XP award cases, 86 rank-boundary cases, 60 daily-goal cases, 20 sequential completion mutations, one mixed-status history/streak/rhythm case, and five consecutive ledger replay/reset/mastery states. `--check` verifies generated files byte-for-byte without modifying them.

Unit suites: `HabitCoreTest` and `RewardsAndGoalsTest`. They consume those references and check rejected past/future writes, preserved unrelated entries, inactive/schedule isolation, duplicate goal counting, monotonic XP on replay/removal, original rank catalogs, hidden-rank reveal, status precedence, future reward suppression, earliest ledger duplicate and latest history/mode-change selection.

Gradle was not run by this independent task to avoid competing builds; the integrating task owns actual compilation/unit execution and must record its results. A successful export is not a passed Kotlin unit suite.

Source SHA-256:

| File | SHA-256 |
|---|---|
| habits.ts | `1e9204f50f8b1bc41c6df13763ca4158ab37bfc2fecc7b44b7626a6263f87a03` |
| tracker-core.ts | `3656bc3f859214f561186db9985bfbac259bc382bd21a5a79d44ed4f2956be3d` |
| tracker-math.ts | `3a9e589e3a389b8861d692ef6ad052f307f1b9826f4f4d733416f115efd9bfe0` |
| habit-progress.ts | `e1d541032fd9a165794b46ebbf206aa1e4592ee7d182094202a25b57ea8ecc97` |
| daily-goal.ts | `e676b99459ba9c437534e758a7a3e5d8b9808512a1bc79656764ecbff214f82e` |
| rewards.ts | `f16fb44bd57caea9fcb6f27055430d5eb06dd62aede073aefedf7913879974d4` |

## Explicitly not ported in this group

- Entire `HabitWorkspace` schema 16 normalization/legacy migrations and wire adapters; sleep, mood, abstinence and analytics modules.
- Missed/deleted habit orchestration, mastery-retention eligibility, default template installation/deletion rules, habit creation from practice/template, key-habit selection and editing/pause workflows.
- Quests, achievements, streak-freeze purchases, comeback policy, checkpoint claiming, protected-day consumption, notifications, feedback, report ranges and charts.
- Full `ensureDailyGoalProgress` / `refreshDailyGoalProgress` transaction choreography across those modules. The ledger's `reset` operation exists; no automatic reset is triggered without the missing eligibility logic.
- Account encryption, API transport, repository persistence, outbox/conflict resolution, UI, accessibility and visual parity. No synthetic workspace is shipped as a real user account.
- Raw arbitrary JSON coercion and locale-specific collation of externally supplied unusual ledger IDs. Typed models support canonical ISO dates, integers and the existing generated ASCII key scheme. Verify or adapt raw import before claiming universal schema parity.

## Subsequent local screen integration

The next independent group added `data/HabitsRepository.kt` and `ui/HabitsScreen.kt`. The initial domain-only limitations above still apply to the full synced product; the following local subset is now implemented:

- `HabitsRepository(app)` reads/writes one `DocumentRecord(scope, "habits", encrypted, revision)`. `Room.withTransaction` includes habit changes, history, daily-goal records, XP and the reward ledger in one atomic commit. `LocalCipher` AES-GCM uses AAD `$scope/habits`; no habit content is stored as plaintext Room columns.
- Explicit `localSchema: 1` document, never silently treated as the existing full cloud tracker schema 16. Unknown/corrupt documents fail rather than becoming an empty overwrite. Web tracker identity metadata is flattened in the serializer. Local state is still isolated by `app.workspaceScope` and is not uploaded or called synchronized.
- Original library of all 10 starter templates is generated from `app/habit-templates.ts`. Templates are added only after a user action and editor save. No automatic test habits or completions are inserted.
- Native list, create/edit, pause/resume, selected-calendar schedule, date range, recurrence days, scoring mode, quality completion, history, XP/rank/basic Laurel totals. Existing unsupported schedule fields are preserved by the editor. The screen prominently identifies local-only data and unfinished advanced features.
- The local reconciliation subset closes old open days, handles the source timezone-boundary status, derives current goals, replays existing daily/perfect award rules, applies idempotent source missed-habit resets and reconciles monotonic XP. It does **not** fabricate quest, comeback, streak-milestone, achievement or automatic-protection rewards. Delete is intentionally not exposed while deletion/mastery eligibility orchestration remains incomplete.
- `HabitDocumentTest` covers full JSON roundtrip including nullable Google binding references, schedule identity, completion/ledger history, idempotent daily rewards, missed-day reset without XP loss, pause metadata, and rejecting unknown/corrupt schema. Requires the integrating task's existing `org.json` test dependency.

Additional limitations: habit reminder scheduling, full recurrence-builder UI (interval/month/pentad filters), goal-mode/rest-day settings, emoji/color/ritual editors, release visual parity, account sync and full reward orchestration remain unfinished. Room atomicity and JSON unit tests do not alone prove device restart behavior; the main task must verify on the installed application.

Next action: compile and run the integrated `:app:testDebugUnitTest`, then test user-created habit persistence/completion/reopen on the selected physical device and record the real result before claiming this local flow works.
