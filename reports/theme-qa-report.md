# Experimental theme 1.1 — local QA

Baseline commit for the corrective pass: `f136d764ec1df9337b41e6853a8c5db785da5c5e` (`origin/master`).

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

The before/after Standart screenshots were captured at the same viewports. Differences are limited to live clock/animation rasterization: desktop mean absolute RGB difference 0.639 and mobile 0.493. The repository captures below record the first integration and remain useful for asset-placement comparison. Authenticated production inspection of the first application-wide revision exposed two defects that this pass corrects: `#all-tasks` crashed on an unscoped locale variable, and dark feature headers inherited light-surface typography. Fresh production captures are required after this corrective commit is deployed.

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
- `pnpm test`: 63/63 passed, including an explicit scope regression for the Tasks locale variable and application-wide Experimental component coverage.
- `pnpm build:beget`: passed; 10 mandatory entry assets and 90 visual assets in offline precache. The generated 529.18 kB CSS artifact contains `html[data-genesis-theme=experimental]`, the `--gx-*` token layer, view/dialog hooks, responsive workspace tabs and the mobile navigation dock.
- `pnpm test:preservation`: passed.
- PHP smoke suite was extended for the default, update, revision increment and stale-write conflict. It could not be executed locally because this Windows host has no PHP runtime; CI is already configured to execute it before any deployment mutation.

## Operational notes

- The coverage revision adds Experimental-only tabs for the ordinary Today and Tasks workspaces. Both tab panels remain mounted, so switching does not discard form state.
- The corrective pass adds four Experimental-only Habit workspaces: Today, Habits, Modules and Progress. Existing trackers, settings, art and histories remain mounted and unchanged; the tabs only control which ordinary section group is visible.
- The mobile Experimental navigation is now an explicit five-column, two-row dock with readable labels, strong selected state and safe-area spacing.
- Dark authored feature surfaces keep their original backgrounds and now use dedicated on-dark typography. Light Experimental headers use a complete `background` override rather than a conflicting `background-color`, preventing inherited gradients and text colors from merging.
- Ordinary component coverage now includes shell/navigation/topbar, Today cards, task rows and empty states, task/list creation, project surfaces, habit panels and rows, account settings, admin statistics/tables, ordinary dialogs, fields, buttons, notices and mobile layouts.
- Authored calendar grids, date pickers, both time pickers, priority controls, Stoicheion, Theokyklos, art panels, sigils and all media remain outside the generic component selectors.
- Migration `012_account_theme.sql` is additive and defaults existing accounts to `standart` without a mass update. Code rollback can leave the two unused columns in place; database rollback remains a separately approved operation under the repository policy.
- Authenticated multi-device UI verification remains for the normal CI/staging path because the local environment has no verified Google test account. Controller tests cover serialized rapid toggles, rollback, conflicts, logout/account changes, the kill switch, and all 36 theme/calendar/time combinations.
- Internal URLs are normalized across the root layout, Beget entry, section navigation and authentication return paths: `/?qa=…#theokyklos` becomes `/#theokyklos` without losing the selected section.
