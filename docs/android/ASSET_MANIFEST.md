# Android original asset manifest

Generated: 2026-09-24T20:39:48.995Z. Byte parity: **PASS**. Visual parity: **NOT_RUN**.

527 public originals, 140951613 original bytes. Generated copies match: 527/527. APK decompressed entries match: 527/527.

APK: `outputs/android/streak-resilience-alpha09/GENESIS-2.0.0-alpha09-debug.apk` (158024353 bytes), SHA-256 `1d4d8481120fb97b79e2f16c9c4a5e5aaf5417427a05698211d346aa2ff425f3`.

## Reproduce

`node android/tools/verify-assets.mjs --require-apk` regenerates this report and ASSET_MANIFEST.json; append `--apk relative/path.apk` to select an artifact. `--check` performs checks without rewriting either report. A nonzero exit means missing/mismatched data or invalid ZIP. Run after the integrated build finishes.

The verifier reads the actual literal public include block in Gradle. It uses SHA-256 on original, generated copy and decompressed APK entry bytes. ZIP reader uses only Node built-ins, validates central/local headers and bounds, caps the archive at 512 MiB and each decoded original at 64 MiB, supports stored/deflated entries, rejects encrypted/ZIP64/multidisk archives, and never extracts files or converts images.

## Packaged families and UI slots

| Family | Files | Original bytes | Generated | APK | UI status | Native slot/remaining work |
|---|---:|---:|---:|---:|---|---|
| originals/achievement-art | 36 | 1129494 | 36/36 | 36/36 | PARTIAL_IN_CODE | All 18 original webp medallions render in the Experimental gallery with locally persisted unlocks; complete web award rules and account synchronization are pending |
| originals/calendar-art | 1 | 194638 | 1/1 | 1/1 | NOT_PORTED | Original annual description slot not ported |
| originals/day-art-v1 | 366 | 105298016 | 366/366 | 366/366 | IN_CODE_NOT_VISUALLY_VERIFIED | DayHeader computes original month/day path; crop/layout in both themes still unverified |
| originals/genesis-hero.png | 1 | 2566435 | 1/1 | 1/1 | NOT_PORTED | Hero composition and theme variants not ported |
| originals/habit-ranks | 1 | 290184 | 1/1 | 1/1 | PARTIAL_IN_CODE | Original rank panorama remains in the native habit progress card; Experimental also has the individual rank tree, checkpoint actions and detail artwork |
| originals/habit-reward-art | 2 | 648335 | 2/2 | 2/2 | PARTIAL_IN_CODE | Both original images render in Experimental Habits; local Spark purchase/automatic use and three-day Comeback awards work, but cloud synchronization is pending |
| originals/hero-path | 40 | 2595498 | 40/40 | 40/40 | PARTIAL_IN_CODE | Original 256px rank and amphora artwork renders in the Experimental tree; 512px rank detail and local checkpoint claims are implemented, but web/account parity is pending |
| originals/icons | 4 | 4444680 | 4/4 | 4/4 | PARTIAL_IN_CODE | Header renders icon-192.png only; other web icon variants are not UI-parity verified |
| originals/month-art-v4 | 13 | 5578824 | 13/13 | 13/13 | IN_CODE_NOT_VISUALLY_VERIFIED | All 13 original month images have native sacred month and lazy year slots; current month and Apeiron observed on one phone, full 13-month visual matrix pending |
| originals/month-frieze-v2.png | 1 | 3124671 | 1/1 | 1/1 | PRESERVED_NOT_RENDERED | Preserved in APK but intentionally not rendered in Projects; sacred calendar uses individual original month-art-v4 images |
| originals/stoicheion-cards | 27 | 4635888 | 27/27 | 27/27 | PARTIAL_IN_CODE | All 24 original card faces and letter details have native slots; local daily and nine-card gesture readings work with a three-minute reroll timer, but account synchronization is pending |
| originals/theokyklos-art | 14 | 6144776 | 14/14 | 14/14 | IN_CODE_NOT_VISUALLY_VERIFIED | Native sector dialog renders original artwork; four critical detail states checked on one phone, full visual matrix pending |
| originals/theokyklos-symbols | 14 | 1579934 | 14/14 | 14/14 | IN_CODE_NOT_VISUALLY_VERIFIED | Native mandala renders all 14 original sigils including zenith, nadir, entry and exit; one-phone theme screenshots captured |
| originals/weekday-art | 7 | 2720240 | 7/7 | 7/7 | IN_CODE_NOT_VISUALLY_VERIFIED | DayHeader references all seven original weekday files |

Per-file source → asset → ZIP mapping, lengths, all three hashes, compression and slot annotations are in [ASSET_MANIFEST.json](ASSET_MANIFEST.json).

## Omitted public media

31 public media files are not selected by current Gradle includes. They are listed explicitly in the JSON `omitted` section; omission alone does not prove they are still used by current web UI (older month-art versions can be legacy). Assess relevance before release; this report does not silently add, remove or replace them.

## SVG, fonts and visual limitations

- Byte parity is not proof of UI placement, visual parity, image decoding, licensing, or APK signature validity.
- Only public originals selected by actual Gradle includes are hashed. No server/private data or non-public artwork source is read.
- Native OriginalImage currently uses BitmapFactory: copied SVG frames are not a working SVG renderer.
- No bundled public TTF/OTF/WOFF font is asserted ready; native font licensing/conversion and typography remain pending.
- Slot mapping is manually reviewed source evidence; mobile/tablet/font-scale and Standart/Experimental visual matrix is NOT_RUN.

The native source reviewed includes `ui/GenesisApp.kt`, `ui/HeroRankTree.kt`, `ui/HabitArtGallery.kt` and `ui/StoicheionDrawUi.kt`. Relevant web source families: `GenesisCalendar.tsx`, `theokyklos-assets.ts`, `StoicheionView.tsx`, `achievements.ts`, `HabitTracker.tsx`, `hero-path-assets.ts` and `globals.css`. A packaged image does not count as a ported screen; full visual and behavioral parity remains unverified.

No Gradle edit, build, source image rewrite, bulk source copy, secret read, SSH or server operation is performed by this verifier.

## Failures

None in the measured byte-comparison scope.
