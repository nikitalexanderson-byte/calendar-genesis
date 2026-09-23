# Sleep, mood and abstinence tracker port — internal alpha

This is a bounded native port of existing source rules. It adds no diagnostic or treatment advice, reward scheme, sample records, account migration, or cloud synchronization. The user-facing local flow covers **sleep and mood**; abstinence currently has domain models/formulas only. No SSH, production operation, Gradle edit or independent build was performed for this group.

## Source and implementation

Pure domain code lives in `android/app/src/main/java/ru/genesis/calendar/domain/trackers` and reuses existing `TrackerEntity`, `TrackerSchedule`, and the native calendar core.

| Source | Kotlin | Implemented |
|---|---|---|
| `sleep-tracker.ts`, relevant `tracker-math.ts` | `SleepTracker.kt` | Sleep plan/rule/entry models; overnight duration; source timezone calculation; deviation from targets; enabled custom-rule score; nullable quality clamp 1–10 |
| `mood-tracker.ts`, `tracker-math.ts:moodValueColor` | `MoodTracker.kt`, generated `MoodCatalog.kt` | Original 12 values −5…+6, Russian/English names, symbols/colors; legacy mapping; clamping; max 20 tags; identity deduplication |
| `addiction-tracker.ts`, relevant `tracker-math.ts` | `AddictionTrackerRules.kt` | Tracker/entry models; relapse overrides clean flag; original points/penalty calculation; craving clamp; scoped streak with missing-day/relapse break and 20,000-day bound |
| `HabitTracker.tsx:replaceSleepEntry/replaceMood` | `TrackersRepository.kt` | Preserve existing identity and increment version; replace by plan/date for sleep and by date for the visible mood observation |

No handwritten replacement astronomical/date algorithm is introduced. Raw invalid JSON coercion and full legacy workspace migration are not implemented: domain values use validated `LocalDate`/`LocalTime`, finite quality inputs, and explicit types. Full source schema 16 import is a separate gate.

## Sleep semantics and limitations inherited from the source

The entry's date is the civil date of falling asleep. A wake time less than or equal to the bedtime uses the next civil day, so equal times imply a full day (subject to timezone transition), not zero. Both times are minute-precision.

`calculateSleepDuration` in web iterates the timezone offset **four times** around a desired UTC timestamp. Native `SleepTracker` reproduces this procedure instead of silently substituting `LocalDateTime.atZone`'s gap/overlap policy. Reference cases include spring/autumn changes in New York and Berlin, ambiguous/nonexistent New York times, and Lord Howe's 30-minute transitions. Invalid timezone in the low-level compatibility helper falls back to UTC as source does; the native plan form requires a real `ZoneId`.

This source procedure does not ask the user which offset of an overlap was observed. Native UI warns when an entered local time is ambiguous/nonexistent and labels the result source-compatible; it does not represent it as independently measured sleep duration. Date calculations depend on host timezone databases, so reference cases do not prove parity across all historical zones or future timezone legislation.

Deviation intentionally keeps source semantics: absolute difference of wall-clock minutes from each target, averaged and rounded. It is **not** the shortest circular distance across midnight. This may yield a large deviation near midnight; changing that is a product-rule change, not a port correction.

Missing time endpoints yield zero in the original low-level helper. To satisfy native missing-data semantics, a partially entered native observation stores `durationMinutes`/`deviationMinutes` as **null** until both endpoints exist. The compatibility helper itself retains the original return value and is tested against web. Quality is null until explicitly selected. This local nullable representation must be adapted explicitly before any future web import/export; it is not silently asserted to be wire-identical.

## Native persistence and UI

- `TrackersRepository(app).workspace` is a flow of `LocalTrackersWorkspace`. The document stores sleep plans, sleep observations and mood observations with explicit `localSchema: 1`; unknown/corrupt schemas fail rather than becoming a blank replacement.
- `savePlan`, `saveSleep`, and `saveMood` use `Room.withTransaction` on one `DocumentRecord(scope, "trackers", encrypted, revision)`. AES-GCM `LocalCipher` uses AAD `$scope/trackers`. Personal texts are inside the encrypted payload, not plaintext Room columns.
- Optimistic entity versions reject stale edits. Existing sleep plan/date and mood/date identities are retained, preventing duplication through normal edits. Changed sleep-plan targets/rules recompute derived values of its observations without changing their entered times/notes/IDs.
- `TrackersScreen(app)` provides explicit plan creation/edit/pause, sleep entry create/edit including partial entries, optional quality, original mood choice, note and history. It uses the existing author date/time controls and saved independent input-calendar/12-hour settings. Original mood symbols and labels come from source data.
- New forms do not create observations automatically. Mood has no preselected neutral value; no record exists before choosing and saving. Real neutral `0` is a valid explicit observation. Notes alone do not silently create a neutral mood in this native form.
- Mood never modifies points. Sleep's optional rule score remains a sleep metric; this group never adds it to XP or Laurels. No connection to the habit reward ledger is created.
- UI explicitly labels local-only data. Native UI composition is functional alpha; it is not an assertion of complete web visual parity, accessibility testing or production account compatibility.

## Web reference generation and verification

```powershell
node android/tools/export-tracker-vectors.mjs
node android/tools/export-tracker-vectors.mjs --check
```

Both commands executed successfully on native Windows on 2026-09-23. Only actual source TS modules are executed against synthetic inputs. Tracker metadata providers are deterministic test adapters; scoring, normalization, duration and mood functions are the real source functions.

Generated reference cases: **15** sleep durations, **8** normalized sleep entries, **9** mood numeric/label/color cases, **18** legacy mood IDs and **32** abstinence scoring cases. `--check` reproduces the generated Kotlin catalog/vectors byte-for-byte without writing files.

`TrackerDomainTest` consumes these references and checks missing-value semantics, DST ambiguity detection, ID/day scopes and streak break behavior. `TrackersDocumentTest` checks nullable/complete observation roundtrips, explicit neutral vs no mood, notes/tags/plan/timezone preservation, fractional negative source rules, absence of reward fields, and schema rejection.

Final integration on 2026-09-23: all **11 tracker domain/document tests PASS** within the 50-test Kotlin suite. On realme Android16/API36, the native mood selection/save UI test PASS (including repeat execution with an existing entry). Sleep creation/edit/device persistence remains NOT_RUN. These results do not prove full tracker parity or cloud interoperability.

Source SHA-256:

| Source | SHA-256 |
|---|---|
| sleep-tracker.ts | `a954d1d46fa9e500507b742c61e8bd30bcd6ed1e051a4893c4109f44e10ba6cb` |
| mood-tracker.ts | `6b2111aebe93d121847852aad5cf3ec3329e87390207289628aa556c1c276ccd` |
| addiction-tracker.ts | `69c67b9e4b92918df5329ba9409fb8a2f7dacbcf82a613fa263a74779397625b` |
| tracker-math.ts | `3a9e589e3a389b8861d692ef6ad052f307f1b9826f4f4d733416f115efd9bfe0` |

## Remaining work

Full abstinence UI/persistence/reminders, graphs and analytics, sleep schedule/rule editor, mood tags editor, deletion workflows, account encryption/wire adapters/sync/conflict handling, full raw migrations, visual parity/accessibility, and device restart tests remain unimplemented/unverified. Existing rule/tag/schedule fields are preserved by the local form but not all are editable there. No API or settings screen is claimed to provide these functions.

Next action: main task compiles/runs `:app:testDebugUnitTest`, connects `TrackersScreen(app)`, then verifies user-created sleep/mood observations survive ordinary app restart on the selected device.
