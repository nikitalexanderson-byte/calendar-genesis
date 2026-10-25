# Advice actions and matching notebook buttons — 26 October 2026

Daily advice actions now share one row: favorite, dislike, another advice and, after saving, the diary shortcut. Favorite is an icon-only heart with the existing hover/keyboard tooltip: «Добавить в избранное» or «Убрать из избранного». The filled heart indicates a saved favorite. Diary note favorites use the same heart. On narrow cards the next-advice caption yields to its icon and tooltip, preserving the 44px targets and one-row buttons. The advice count can continue below the button row when space is limited. Archived advice uses the same compact action layout.

Mindmaps and Diary launch buttons use two equal grid tracks with the same 44px height and 10px radius on desktop and mobile. Their colors and animated icons are retained.

Validation: frozen install, lint (the two pre-existing Mindmap image warnings), 730 tests and build:beget with Mindmaps enabled passed. No data/storage, migration, backend or Android changes.

Browser verification used an isolated local account and actual advice/diary APIs. Both themes at 320/360/390/768/1440, with favorite off/on: 20 advice states, no row wrapping or page overflow, no favorite text, buttons at least 44px. The ten notebook layouts have equal button width and height. Hover and actual Tab-focus tooltips, dislike/undo and the exhausted next-advice state passed; no page errors. Results: `output/advice-row-browser.log`.

Before screenshots copied from the user's supplied examples: `output/playwright/advice-row-before.png`, `notebook-buttons-before.png`. After screenshots: `advice-row-after-*`, `notebook-buttons-after-*`, `advice-heart-tooltip-after.png`, `advice-row-exhausted-after-390.png`, `advice-actions-after.png` in `output/playwright/`.

Unverified: physical iOS/Android devices, Safari/Firefox, enlarged system fonts, screen readers and non-Russian browser flows. No SSH or manual production database changes. Existing deploy.yml publishes web/API; Android remains disabled. Code rollback is a Git revert through that workflow.
