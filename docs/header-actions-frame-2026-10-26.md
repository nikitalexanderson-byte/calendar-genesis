# Header actions frame — 26 October 2026

The right-hand header actions now share one surrounding frame. Their own button borders and independent behavior remain visible. The frame matches the calendar switcher's height and vertical alignment, without treating the actions as mutually exclusive modes. It contains four controls on the ordinary web layout and includes the existing Android download control when present (five controls).

The compact header measures both groups' padding, borders and internal gaps when dividing the remaining width. The existing small-target header exceptions remain: with five controls, button sizes are 28px at 320px, 33px at 360px, 36.75px at 390px, and 44px at tablet/desktop widths. The two groups have identical heights in every checked state. Existing icons, tooltips, account, voice, theme, notification and installation behavior are retained. No backend, data, migration, Android build or deployment-workflow changes.

Validation: frozen install, lint (only the two existing Mindmap image warnings), all 730 tests, and build:beget with Mindmaps enabled passed. The existing JavaScript budget and offline-precache checks passed. Browser inspection covered light/dark at 320/360/390/768/1440 with both four and five controls (20 states), checking group height/alignment, visible button frames, bounds, page overflow and Android download URL. Account dialog opening/closing and the account tooltip/focus state passed; no page errors. Results: `output/header-actions-browser.log`.

Before screenshots: `output/playwright/header-actions-before-{390,768,1440}.png`. After screenshots: `output/playwright/header-actions-after-{web,android}-{light,dark}-{320,360,390,768,1440}.png` and `header-actions-focus-and-tooltip.png`.

Unverified: physical phones/tablets, native Android app, Safari/Firefox, enlarged system fonts, screen readers, installation/download completion, voice recording and non-Russian flows. No SSH or manual production database operations. Existing deploy.yml publishes web/API; Android remains disabled. Code rollback is a Git revert through the same workflow.
