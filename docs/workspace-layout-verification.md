# Workspace layout verification

This release fixes dragging the complete inbox with edge autoscroll, adds per-account compact/detailed modes, restores full-width personal inbox controls, and introduces persisted board title/recency limits. It also expands the Gantt range with available width and aligns typography, entry icons and surface levels across personal/shared workspaces.

Validation uses an isolated seeded browser and isolated SQLite, never a manual production database change. Screenshots and command reports are saved under `output/playwright/space-categories-fixes/` (local ignored artifacts).

- Before: `before-inbox-stuck.png`, `before-inbox-drag.log`, `before-task-controls.png`, `before-shared-section-titles.png` and the supplied screenshots.
- Inbox: real pointer drag moves the whole block; downward/upward autoscroll, four personal docks, two shared vertical docks, Escape cancellation, compact personal task transfer, shared controls, hide/full-width restore and account preference reload verified.
- Boards: latest completed tasks, older disclosure content, per-card title expansion, settings save/reload; API integer bounds, manager permissions, optimistic revisions and older clients verified. Migration 044 checks its pre-migration backup and schema integrity. See `workspace-layout-migration-044.md`.
- Gantt: width-dependent periods and reversible coordinates tested for day/week/month scales in Gregorian, sacred and lunar calendars, including fitted ranges; the 24-hour scale retains its day.
- Web checks: frozen install, lint, 152 tests, production build with JavaScript budget and mandatory offline assets. PHP cache/incremental sync, encrypted storage, migration, collaboration, permissions and shared UI suites passed.
- Browser: light/dark at 360, 390, 768 and 1440 px; compact controls, shared headers/Google copies, boards, Gantt and personal surfaces. Exact results are recorded in `qa-final-surfaces.log`; corresponding `after-*.png` files are retained.

Not verified: live Google Tasks after the daily quota reset; all 14 languages manually; manual 13-month intercalary year; simultaneous incoming changes from multiple devices and linked Google accounts; native touch dragging on every device. Browser fixtures do not call Google.

Deploy uses the existing GitHub Actions workflow and public SHA/health checks. SSH was not required for this UI release; earlier read-only GENESIS Google log diagnostics are documented in the preceding release report. Android 2.7.3 artifacts and the minimum version requirement are retained in the website-only deployment.
