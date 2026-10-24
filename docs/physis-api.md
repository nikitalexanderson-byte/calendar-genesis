# Physis HTTP API v1

The existing PHP router serves `/api/physis/v1`. No Android bootstrap, shared workspace, Google Calendar or public sharing API includes Physis data. All responses are `no-store`; browser exports are produced from this owner-scoped API after local decryption.

## Admission and session boundary

The browser pilot is enabled by the Git-controlled `GENESIS_PHYSIS_WEB_ENABLED=true` in `server/src/physis.php`. `server/config.example.php` documents `physis_enabled=true`; an explicit boolean `false` in the private config is the data-preserving kill switch. Invalid non-boolean values fail closed. Activation was requested after verification of the published native 2.9.7/102 entry point; see [physis-browser-access.md](physis-browser-access.md).

`server/src/physis.php` contains the exact tester allowlist: `nikitalexanderson@gmail.com`, `jurijjlogvinov@gmail.com`, `picishina@gmail.com` (the third account was explicitly added by the user on 24 October 2026). Comparison permits case and surrounding whitespace only. It does not normalize Gmail dots or aliases. The guard runs for the whole namespace, including unknown, export and nested routes, before querying Physis records or parsing request bodies. Every unavailable identity receives the same `403 PHYSIS_UNAVAILABLE`.

The existing server-side Google code exchange now records `auth_identity.email`, strict boolean `email_verified`, and `channel` together with the verified Google subject. Only a current primary Google identity with trusted verified allowlisted email and `channel=web` is admitted. Linked Google identities are denied even if their workspace owner's email is allowlisted. Native token login stamps `channel=native`; old sessions without claims/channel fail closed and require a new web sign-in. No client header, User-Agent or client-provided owner/email changes this decision.

For an otherwise valid legacy primary tester session with missing/unknown channel, only `GET /access` adds `reauthRequired: true` to its existing 403 `PHYSIS_UNAVAILABLE`. It supplies no owner ID or private data and does not authorize any operation. The browser uses this hint to show the Google confirmation entry instead of silently hiding Physis. Native/linked/unverified web/outsider/anonymous and an explicitly disabled pilot do not receive it. All private routes preserve their identical denial. See [physis-access-recovery.md](physis-access-recovery.md).

The published native 2.9.7/102 APK launches Compose `MainActivity`, has a separate encrypted cookie jar and an API route allowlist without Physis or browser OAuth. Its native Google session is denied by every Physis endpoint. The historical `BrowserLauncherActivity` is not registered in that APK; its old implementation opens an external browser/Custom Tab, using browser cookies. External browser use remains browser access even when opened from an app link. No User-Agent or screen-width heuristic is involved. No APK or Android source changes are part of this module.

Mutations require the existing session cookie, `X-CSRF-Token` and `Content-Type: application/json`. The session file lock is released after authorization, so concurrency control is enforced by SQLite rather than serialized session access. Owner ID always comes from the current session. Request objects with additional keys such as `owner_id` are rejected.

## Objects and endpoints

Standard base64 (with canonical padding) encodes all byte fields. IDs and `requestId` are lowercase UUIDs. Revision/cursor values are nonnegative JSON integers; initial revision is zero.

```ts
type Envelope = {
  version: 1; schemaVersion: 1; keyVersion: number;
  iv: string;          // exactly 12 random bytes
  ciphertext: string; // AES-GCM ciphertext with 16-byte tag; 17..262144 bytes
};
type Vault = {
  version: 1; keyVersion: number;
  password: { salt: string; iterations: 600000; iv: string; ciphertext: string };
  recovery: { iv: string; ciphertext: string };
};
type WireRecord = {
  id: string; revision: number; sequence: number;
  updatedAt: string; deletedAt: string | null; envelope: Envelope | null;
};
```

Password salt is 16 bytes. Both wrapped-key ciphertexts are 48 bytes (32-byte key plus 16-byte GCM tag). Both IVs are 12 bytes. The server validates shape and versions; only a client holding the key can verify GCM authenticity. It cannot inspect or repair malformed encrypted application data.

| Request | Body / parameters | Result |
| --- | --- | --- |
| `GET /access` | none | `{available:true,ownerId,csrf}` |
| `GET /vault` | none | `{vault:Vault|null,revision}` |
| `PUT /vault` | `{requestId,expectedRevision,vault}` | `{revision}` |
| `GET /records` | `page=0&limit=100`, then `page=cursor&snapshot=N` | `{records,cursor,hasMore,minCursor,snapshot}` |
| `GET /records` | `after=cursor&limit=100` | same result, including tombstones |
| `POST /records` | `{requestId,changes:[{id,operation,expectedRevision,envelope?}]}` | `{records,cursor}` |
| `POST /rotate` | `{requestId,expectedRevision,expectedCursor,vault,records:[{id,expectedRevision,envelope}]}` | `{revision,cursor,keyVersion}` |

Create a vault with `expectedRevision:0`, `keyVersion:1`. A subsequent `PUT /vault` performs a CAS rewrap (for example a password change) and must keep the current key version. Data-key replacement must use `/rotate`.

`operation` is `create`, `update` or `delete`. Create requires revision zero and a never-used ID for that owner. Update/delete require the exact live record revision. Missing, foreign, deleted and stale records return the same `409 PHYSIS_CONFLICT`; update never creates a record. Delete has no envelope. Every returned record contains the new revision/sequence; a tombstone has `envelope:null` and a server deletion timestamp.

All changes in a batch are atomic. Mutation `records` are compact acknowledgements with `id`, `revision`, `sequence`, `updatedAt`, `deletedAt`, **without envelope**. The client reconstructs its confirmed wire record from the acknowledged metadata and the exact pending request envelope. Every mutation stores its response receipt in the same transaction, keyed by owner and request ID with a SHA-256 hash of operation plus canonical request body. Retry the **same** request ID and exact logical payload after an unknown network outcome. A matching retry returns the original response without applying changes again; changed payload/operation returns `409 PHYSIS_REQUEST_CONFLICT`. JSON object key order does not affect the hash; array order does. Receipts contain no ciphertext copies, so repeated autosave does not retain every historical encrypted snapshot for 90 days.

Rotation requires the current vault revision, owner cursor and the complete set of live records with their current revisions. The new key version must be exactly current+1. Records and vault change in one transaction; incomplete lists, duplicate IDs, stale writes and mixed key versions fail without partially changing the vault. Keep the old key and newly prepared request/key material in memory until the outcome is known. A concurrent old client receives a conflict and must reload/unlock the new vault.

## Pagination and deletion retention

Full synchronization replaces the client's confirmed collection after all pages have been read and decrypted. The first page returns `snapshot`; include it on every subsequent page. `page` is the previous page's sequence cursor, not an offset. If writes occurred between pages, the server returns `409 PHYSIS_RESYNC_REQUIRED`; restart the full read. Full pages include retained tombstones. Limits are 1–100 records and approximately 2 MiB of envelope JSON per response.

Delta reads return records whose latest sequence exceeds `after`. When `hasMore=true`, continue with the returned cursor. When finished, the cursor equals the owner's current cursor. If `after < minCursor`, a fresh full replacement is mandatory; do not merge an outdated local snapshot into the result.

Tombstones and idempotency receipts are retained for at least 90 days, with lazy cleanup under the next mutation's writer lock. Cleanup advances `minCursor`. The permanent compact `physis_used_ids` registry contains only owner/random ID and prevents recreating deleted IDs after tombstone or receipt expiry. It is removed by the existing owner-account cascade. Client import/clone must generate new IDs where appropriate.

## Encryption and visible metadata

The web client uses a random AES-256-GCM data key and a fresh 96-bit nonce per encryption. Record AAD is `genesis:physis:v1:{owner}:{id}:{schemaVersion}:{keyVersion}`. Wrapping uses the same AAD format with record IDs `vault:password` and `vault:recovery`. Password wrapping derives AES-256 via PBKDF2-HMAC-SHA256 at 600000 iterations. The separate recovery code contains a random 256-bit wrapping key. Google credentials are never used as the vault password.

The server stores only the wrapped data key, ciphertext, stable owner ID, random record IDs, revisions, sequence cursors, key/schema versions, lengths and change/deletion timestamps. Record kind, historical fact dates, notes, metrics and product/drug/exercise references are inside ciphertext. An idempotency receipt temporarily retains only the response metadata for retry; deleting a record removes its live ciphertext immediately. An old key may still decrypt old backups if someone already possesses that key; rotation is not retroactive erasure.

The server never receives the password, data key or recovery key. Losing both password and recovery key means the vault cannot be recovered by the server. Compromised client code or an unlocked browser can access decrypted data; this design does not protect against an active XSS or malicious server-delivered JavaScript. No Physis plaintext/key is put in browser persistent storage, analytics or server logs by this API.

## Bounds, migration and rollback

- Ordinary mutation: at most 100 changes and 2 MiB HTTP body. Vault body: 4096 bytes. Rotation body: 48 MiB.
- One decoded ciphertext: at most 256 KiB including the authentication tag; client plaintext must be at most 262128 bytes.
- One owner: at most 10000 live records and 32 MiB of serialized live envelopes. Existing per-user API request/byte budgets apply.
- Local CSV/plain JSON/encrypted backup import: at most 128 MiB, covering the full 32 MiB live-envelope quota and CSV escaping. Plain imports allow 10000 records plus one CSV header (at most 100 columns, 350000 characters per field). Encrypted imports allow 10000 live records and up to 50000 total rows including tombstones, matching the paginated export bound. File size, row count and envelope bounds are checked before decryption. Plain JSON export uses compact serialization to stay within the import bound.
- Query parameters and payload keys are restricted; nesting is bounded by the existing JSON reader.

Migration `083_physis.sql` only adds tables/indexes with owner foreign-key cascades. The standard migration runner applies it at first DB access. Existing `deploy.yml` performs the approved server configuration/SQLite backup before deployment. No production database was read or changed manually for this implementation.

Code rollback follows the repository's normal `git revert` deployment. Leave the additive schema/data in place; do not attempt automatic database rollback. Disabling `physis_enabled` is the immediate data-preserving kill switch. Native workflows remain disabled.

## Reproducible checks

Run `php server/tests/physis-security.php` with PHP 8.3+ and PDO SQLite, OpenSSL, sodium and mbstring. The harness creates a fresh temporary configuration, DB and session directory; it never loads the existing `server/config.php`. The local config hook is available only to explicitly configured CLI/CLI-server processes and cannot be selected by HTTP input or production PHP SAPIs.

The suite uses all real migrations, the production router over loopback HTTP and two independent PHP writer processes. It verifies the allowlist, verified claims, linked/native/legacy session denial, every namespace route, owner isolation, request-key tampering, CSRF, JSON/body bounds, receipt replay, atomic rollback, simultaneous CAS, pagination snapshots, tombstones and stale-client resurrection prevention after pruning, complete atomic key rotation, rewrap, no plaintext in the Physis tables, the enabled browser-only default, explicit disable, strict flag types and data preservation. Production sessions, actual Google login and physical mobile devices are not exercised by this local suite. SSH is not used by the suite.

`node --test tests/physis-crypto.test.mjs tests/physis-store.test.mjs` executes real WebCrypto with the application store and validators. It covers new-browser password/recovery unlock, nonce uniqueness, AAD/ciphertext tampering, password rewrap, byte limits, unknown-commit retries, interrupted batch encryption, queued revisions, concurrent reload/save, explicit conflict discard, partial acknowledgements, logout during an in-flight request, snapshot changes, rotation of more than 100 records, and refusal to export new-key ciphertext with an obsolete vault. The test browser-storage objects throw on any access.

For browser acceptance, `php server/tests/physis-browser.php` creates synthetic users and a marked isolated DB under `output/physis-browser/genesis-physis-test-browser`. Set `GENESIS_PHYSIS_TEST_DIR` to that absolute path (forward slashes) and `GENESIS_PHYSIS_BROWSER_FIXTURE=1` only for a local process, then start `php -S 127.0.0.1:8842 server/tests/physis-router.php`. A web development server can proxy `/api` directly to that port. Request `/api/physis-test/login` for synthetic owner A or `/api/physis-test/login?owner=b` for owner B, then use the real `/api/session` and `/api/physis/v1` APIs. The fixture-only login route requires CLI-server, loopback, explicit opt-in and the synthetic configuration; it is absent from the production router. No real OAuth cookies or credentials are needed.
