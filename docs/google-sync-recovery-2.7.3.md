# Google sync recovery and Android 2.7.3

The Google Cloud project `genesis-calendar-production` retains its 50,000 Tasks requests/day limit. No billing account or quota increase was requested. Website and Android requests share this project quota. OAuth sign-in uses separate identity endpoints.

## Request policy

- Personal writes still call Google immediately. Successful task/list writes update the encrypted server snapshot without invalidating it or triggering a full reread.
- All devices share one snapshot per connected account and authorization grant. A file lock serializes reads/writes across PHP workers.
- Incoming Tasks changes use `updatedMin` with a 120-second overlap, pagination, tombstones and a full read for new lists. Calendar uses `syncToken`; HTTP 410 rebuilds the snapshot once.
- Incremental refresh is capped at once per 15 minutes while clients use GENESIS. Full reconciliation is once per 24 hours. Shared project lists/events are excluded from personal imports.
- A project-wide daily-quota breaker pauses API attempts until the Pacific midnight reset (with a five-minute propagation margin). Cached data remains available with an explicit warning. Other transient failures back off for 15 minutes. Calendar and Tasks breakers are separate.
- `quotaUser` assigns a stable opaque per-account identifier; it does not increase or subdivide the global daily quota.
- Shared Google projection is opt-in per project. Shared storage remains usable without Google.

## Migration 043 and recovery

The existing deployment workflow creates a consistent SQLite backup and preserves `config.php` before code publication. Migration 043 adds an initialization marker. On first application DB access, a transaction encrypts shared task titles/descriptions/tags, comment bodies and audit details, creates decrypted read views, and enables encryption triggers. PDO SQL functions are registered before migrations. Existing clients keep the same API response shapes and permissions. Indexed relational metadata is retained.

The migration regression starts from schema 042, makes a backup, migrates existing content, verifies new writes and reads, checks the untouched backup, explicitly decrypts forward, and reapplies encryption. Runtime storage uses the existing server encryption key; it is not end-to-end encryption. Future changes to protected table columns must rebuild their explicit read views.

After encrypted data has been initialized, rolling code back must retain `shared-content-storage.php`, its bootstrap registration, migration 043 and the `*_read` queries. Revert the UI/sync release commit while retaining storage compatibility commit `edda8f3`. Do not revert the whole PR merge or the storage commit on an initialized database. An explicit, tested `genesisRollbackSharedContentStorage(PDO)` forward decryption exists, but production use requires a separate approved recovery plan and a current consistent backup. No automatic database restore or decryption is performed.

## Release behavior

Android 2.7.3 uses versionCode 79 and requires code 79 in the update manifest. Older 2.7.2 installations receive the existing required update prompt; Android still requires the user's installer confirmation. Successful Calendar/Tasks consent closes its connection dialog. Sync warnings preserve the server's actual quota/service explanation, rather than suggesting that every failure is an account permission problem. Release notes explain the shared daily quota and reset, in all 14 supported languages.

## Build artifact storage

GitHub stopped the first release attempt at Bundle upload because artifact storage usage is recalculated only every 6–12 hours. The obsolete 2.6.7 relocation package was removed; it contained reproducible tracked code and a signed build, with no config or runtime database. The 2.7.2 Bundle is retained. The existing deploy workflow now also publishes the verified Play Console Bundle and SHA-256 beside the APK on GENESIS. GitHub upload remains enabled, but its failure no longer prevents deployment. A public download hash check verifies the Bundle mirror before the run succeeds. `/api/android/download` continues to deliver the native APK.

## Verification results

Isolated PHP coverage includes account/grant isolation, encrypted cache, poll deduplication, immediate writes, list mutations, quota backoff, pagination/deletion, Calendar 410 recovery, storage migration/backup/forward rollback and existing collaboration/security suites. Web UI checks cover light/dark at 360, 390, 768 and 1440 pixels. Production and Samsung checks are recorded after deployment; Google Tasks cannot be claimed healthy while the live project quota remains exhausted.
