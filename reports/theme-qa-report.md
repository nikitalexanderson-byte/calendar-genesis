# Experimental theme 1.1 — local QA

Baseline commit: `6b0d2bbbaa38be508661fce2e77cc5e865df416b` (`origin/master`).

## Preservation gates

- `public/` media inventory: 558 files before, 558 files after.
- SHA-256 changes: 0; removed paths: 0; added paths in the protected inventory: 0.
- Source placement signatures: 73 application source files checked; 0 changed signatures for media path literals, `img`/`image`/`svg`, `src`/`srcSet`, CSS media URLs, dynamic image extensions, and navigation symbol declarations.
- Standart remains the fallback for missing/unknown account values and when the kill switch is disabled.
- The theme controller changes only `data-genesis-theme` on the document root; it does not remount the application.
- Protected widgets are explicitly marked for the sacred, lunar and Gregorian date controls, 24h/AM-PM clock, priority control, authored calendars, sigils, figures, avatars and sign-in artwork.

Machine-readable evidence:

- `reports/assets-baseline.json`
- `reports/preservation-manifest.json`
- `reports/preservation-verification.json`

## Visual evidence

The before/after Standart screenshots were captured at the same viewports. Differences are limited to live clock/animation rasterization: desktop mean absolute RGB difference 0.639 and mobile 0.493. Experimental screenshots use the real integrated CSS on the real application tree; a local QA-only forced root marker was removed immediately after capture.

- `reports/screenshots/standart-before-desktop.png`
- `reports/screenshots/standart-after-desktop.png`
- `reports/screenshots/experimental-after-desktop.png`
- `reports/screenshots/standart-before-mobile.png`
- `reports/screenshots/standart-after-mobile.png`
- `reports/screenshots/experimental-after-mobile.png`
- `reports/screenshots/protected-date-picker-before-mobile.png`
- `reports/screenshots/protected-date-picker-experimental-mobile.png`
- `reports/screenshots/protected-lunar-date-picker-experimental-mobile.png`
- `reports/screenshots/protected-gregorian-date-controls-experimental-mobile.png`
- `reports/screenshots/protected-time-picker-24h-before-mobile.png`
- `reports/screenshots/protected-time-picker-24h-experimental-mobile.png`
- `reports/screenshots/protected-time-picker-ampm-experimental-mobile.png`

## Automated checks

- `pnpm install --frozen-lockfile`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 62/62 passed, including clean URL coverage for every application section.
- `pnpm build:beget`: passed; 10 mandatory entry assets and 90 visual assets in offline precache. The generated 493.20 kB CSS artifact contains `html[data-genesis-theme=experimental]` and the `--gx-*` token layer.
- `pnpm test:preservation`: passed.
- PHP smoke suite was extended for the default, update, revision increment and stale-write conflict. It could not be executed locally because this Windows host has no PHP runtime; CI is already configured to execute it before any deployment mutation.

## Operational notes

- No production deployment, merge, push, server write, database write or SSH access was performed.
- Migration `012_account_theme.sql` is additive and defaults existing accounts to `standart` without a mass update. Code rollback can leave the two unused columns in place; database rollback remains a separately approved operation under the repository policy.
- Authenticated multi-device UI verification remains for the normal CI/staging path because the local environment has no verified Google test account. Controller tests cover serialized rapid toggles, rollback, conflicts, logout/account changes, the kill switch, and all 36 theme/calendar/time combinations.
- Internal URLs are normalized across the root layout, Beget entry, section navigation and authentication return paths: `/?qa=…#theokyklos` becomes `/#theokyklos` without losing the selected section.
