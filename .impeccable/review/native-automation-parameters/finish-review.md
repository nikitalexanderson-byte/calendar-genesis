# Native C2 template parameter inspection: finish review

Review mode: inline fallback, not an independent review. Scope: the existing rule-management screen and its read-only template disclosure. This is not full C2, C1, Android release, or main-prompt acceptance.

## Context and design

The incumbent STANDART light/dark Material/Affairs interface remains the visual authority. PRODUCT.md, DESIGN.md and the canonical design sidecar are unchanged. No asset, font, library, family switch or calendar behavior was replaced. This is an Operate surface: inspect a stored action, understand the current preview, and confirm a management command.

The title has its own full-width row on narrow screens; back/refresh/close retain complete 48dp targets on a second row. Wide screens retain the compact single header row. Template parameters use readable label/value facts and localized Yes/No instead of dimmed disabled inputs. Reset and input-calendar editing controls are absent from the read-only disclosure. User names and values are never translated.

## Findings and disposition

| Finding | Disposition |
| --- | --- |
| Selecting a rule disposed the library's coroutine scope during its suspended project read. | Selection runs in the screen scope; the delayed-read regression passes. |
| A completed asynchronous list did not render after a language switch. | Pass the loaded page to the library explicitly. The full real HTTPS 14-language capture passes. |
| Clearing that page disposed pending filter/pagination requests. | Hoist these callbacks to the same screen scope. Two forced-suspension tests failed before the correction and passed afterward. |
| A stale mapping error removed the whole management card. | Known configuration failures block enable/retry while preserving edit/disable; actual transport/project-access failures clear live data. |
| German heading wrapped its final letter beside action buttons at font130. | Separate title and actions on narrow screens; the final physical capture shows the whole word. |

## Visual evidence

`output/native-automation-parameters/manifest-final.json` verifies 16 physical baseline images, 24 final base images (360/390/768/1440, both themes, three positions), and 84 final font130 images (390, all 14 languages, both themes, three positions). The after images match the final debug/test APK hashes and record logical viewport bounds separately from the full physical display. Cropped earlier UiAutomation images are excluded.

Representative originals opened directly: baseline 360 light selection; final 360 dark top; 1440 light options; 768 dark preview; final font130 German dark options, Chinese light options and Japanese dark preview. Other originals have origin/hash/PNG and geometry checks; this review does not claim every image was individually opened.

## Limits and verdict

Design verdict: **ship for this limited local C2 disclosure**. The separately recorded final 622-case JVM, both 25-case device suites, repeated C2 recovery, native lint, production-origin R8/18-holder ART and required pnpm gates passed. No further visual changes are requested. Preserve the real preview, read-only boundaries, confirmation and exact command replay.

Not tested here: signed production startup, physical Samsung/Realme, Google account exchange, production automation execution/worker recovery, TalkBack, hardware keyboard, C2 landscape, font130 outside 390dp, or a complete visual matrix of every mapping/value/error state. No browser UI changed, and this native capture is not a browser acceptance claim. Earlier C1 timeout/teardown and API35 startup ANR evidence remains recorded in the audit; passing repeats do not prove their cause or a production fix.

The complete C2 requirement and the remaining 21 functional IDs / 14 K/U/L criteria remain open. No production deployment, database mutation or SSH was used.
