# Physis, calendar counters and nutrition — 26 October 2026

## Changes

- Mobile calendar counters float inside their own corners without increasing cell height. Sacred counters have a circular 28px visual inside a 44px target and expand on interaction; lunar counters keep their square shape. Gregorian cells have equal height, weekday and moon on one row, shared/personal counts below. Existing popovers are reused.
- Physis training uses actual full months: six quintas of five days for regular sacred months, three decades for 29/30-day lunar months, and seven Gregorian weekday columns respecting the account's Sunday/Monday preference. Apeiron keeps its actual length. Fixed 84px cells and independent workout buttons open existing day details. All calendar toolbars occupy one row. Statistics follow the display calendar.
- Actual and planned meals open in a dialog; saving updates the diary through the existing encrypted store. The redundant date arrow in My Nutrition is removed. Empty nutrient totals display unknown values.
- All requested superfood groups were already represented by 48 stable reference entries, so no duplicate rows were added. Nine entries without numeric data now use explicitly named product labels. The remaining USDA-linked reference rows retain their FDC seed values. Label values are normalized to 100g; undeclared nutrients remain unknown. Saved personal foods and historic meal snapshots are not overwritten.
- Settings dialog title and close button scroll with the content.

## Nutrient provenance

Exact source URLs, named products, serving weights and declared values are in `app/physis/food-label-nutrients.json`. Sources include NOW Foods (brewer's yeast, organic psyllium), iCAN cod liver via Rohlik, St Helen's goat yogurt via Waitrose, Migros sheep yogurt, Zapolyarny Food Factory matsoni, Shchelkunchik dried apricots, Meridian peanut butter via Tesco and Just Natural sweet apricot kernels. Label values are examples for these named products, not universal measurements for every brand. The existing cyanide warning for apricot kernels is retained.

## Verification and evidence

- Frozen install, lint, full test suite and `build:beget` completed. Lint retains the two pre-existing Mindmap image warnings.
- Calendar counters: 36 browser states, both themes, widths 320/360/390/760/768/1440 and all three modes. Results: `output/calendar-counters-browser-results.json`; before/after screenshots: `output/playwright/calendar-counters-*`.
- Physis training/statistics: 24 states, both themes at 360/390/768/1440, all three modes. Equal cell heights, native month boundaries, one-row toolbar and workout dialog checked. Settings title scroll verified in eight states. Results: `output/physis-followups-browser-results.json`.
- Actual account week-start UI checked for Monday and Sunday in October 2026 (three/four leading blanks respectively), restored Sunday. Log: `output/physis-weekstart-browser.log`.
- Nutrition: eight theme/width states; actual 100g apple meal saved in isolated local fixture and immediately shown after dialog closes. Date arrow absent in sacred/lunar modes. Brewer's yeast label nutrient conversion rendered. Log: `output/physis-nutrition-browser.log`.
- Final polish: tablet workout/date separation and empty meal dialog checked after the final build. Screenshots: `output/playwright/physis-final-*`.

## Limits

Real iOS/Android devices, Safari/Firefox, enlarged system fonts and non-Russian browser flows were not checked. Shared counter geometry used DOM fixtures; shared backend behavior is unchanged. No Android build, SSH, manual production database writes or migration is included. Code rollback is a Git revert through the existing deployment workflow.
