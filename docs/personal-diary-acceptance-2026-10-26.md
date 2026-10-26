# Personal diary and advice reactions — 26 October 2026

## Behavior

The personal Affairs toolbar now has Mindmaps and Diary side by side, including on mobile. The Diary button uses a sand-colored treatment and an animated book icon; animation pauses offscreen and respects reduced motion. The diary is a board of softly colored note papers using GENESIS typography and light/dark colors. Notes support editing, search, pinning and reversible archiving. There is no permanent note deletion action.

Daily advice has Favorite and Dislike actions. Favorite retains the advice text and its original source snapshot in the diary. Removing the star retains the saved note. Dislike moves the saved advice to the archive and replaces its Today card with a short confirmation and undo action. The archive is reached from the diary's More menu; notes and disliked advice can be restored. Original advice/source text remains available when opening a saved advice note.

The user explicitly cancelled Google Keep integration. No Keep OAuth scopes, credentials, Google Cloud permissions or external note transfers were added. Entries remain inside GENESIS. New UI copy is RU/EN; original note and advice content is never automatically translated.

## Storage and concurrency

- Every note is sealed on the device with the existing personal workspace key and AES-GCM adapter. Titles, bodies, advice snapshots, reactions, archive/pin flags and colors are inside ciphertext. The authenticated owner, opaque ID, revision, envelope version and update timestamp are the only readable server metadata.
- Advice-note IDs use HKDF-derived HMACs scoped to the owner, so server IDs do not expose public advice IDs. The same advice maps to the same opaque ID on the owner's devices, avoiding duplicate favorites.
- An independent account namespace preserves compatibility with old web/Android workspace writers. The API accepts strict ciphertext envelopes, requires authentication and CSRF for writes, applies per-owner limits and rejects stale revisions.
- Local offline cache and per-tab drafts are encrypted. Journaling precedes every write. Replaying an identical envelope after a lost response does not add a revision. Late session responses cannot clear drafts. Independent tab drafts remain separate.
- A concurrent edit retains the user's draft and offers a visible Save a copy action. It preserves both texts instead of overwriting the newer server version. An earlier slow read cannot replace a newer acknowledged encrypted cache entry.

## Migration, backup and rollback

Migration `085_personal_diary.sql` adds only `personal_diary_notes`, with a user-owner foreign key and account-deletion cascade. Existing consistent server-only SQLite backups include the table automatically. The isolated PHP test verifies a SQLite backup, a fresh DB connection, owner isolation, account cascade and legacy workspace compatibility. Code rollback is a Git revert through `deploy.yml`; the additive table remains intact and can be read when the feature returns. No automatic database rollback, manual production SQL, SSH or Android build is part of this change.

## Validation

- Frozen install, lint (two pre-existing Mindmap image warnings), **730 tests**, PHP syntax and isolated diary backend test passed. `build:beget` passes with Mindmaps enabled and the existing production JS chunk budget. A small diary chunk keeps the main entry below the budget; no UI dependency was added.
- Eight diary model/storage tests use the real cloud-sync WebCrypto implementation: original advice retention, favorite/dislike/restore semantics, ciphertext-only cache/API, owner-scoped IDs, ciphertext scope isolation, lost reply replay, stale-edit drafts, independent tab journals, offline recovery, storage quota, invalid receipts, late session response, draft/save serialization and stale-read cache protection.
- Both themes at **360, 390, 768 and 1440 px**: toolbar launch alignment, 44px controls, page overflow, board columns, note dialog, search and archive-menu presentation. Before screenshot: `output/playwright/diary-before-projects-390.png`; final screenshots: `output/playwright/diary-*-final-*`; metrics: `output/diary-final-confirm.log`.
- Real isolated local API/browser flows: create/edit/save/reload notes, search, pin, archive/restore, favorite an actual daily advice, dislike it and restore from archive, recover a closed encrypted draft, retry save after the browser goes offline, reject a request without CSRF (403), and preserve both texts after edits in two browser tabs. Logs: `output/diary-browser-check.log`, `output/diary-recovery-flows.log`, `output/diary-final-confirm.log`. Screenshots: `diary-favorite-advice.png`, `diary-disliked-archive.png`, `diary-conflict-recovery.png` in `output/playwright/`.

## Unverified states

Real iOS/Android hardware, Safari/Firefox, assistive technology, enlarged system fonts, very large archives and browser flows in languages other than Russian were not checked. Native Android has no new diary screen in this release and was not built. Cross-device storage correctness was tested with independent encrypted clients and browser tabs, rather than two physical devices. Production verification is read-only; no synthetic notes or reactions are created in the user's production account.
