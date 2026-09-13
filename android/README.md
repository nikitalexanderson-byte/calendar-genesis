# GENESIS for Android

This module wraps the HTTPS PWA as a Trusted Web Activity. The browser and Android app therefore share the same Google session, server account, tasks, projects and reminders.

## Direct test build

Use Android Studio's bundled JDK, the production Beget URL and the same persistent test keystore for every update:

```powershell
.\gradlew.bat :app:assembleRelease -PgenesisUrl=https://genesiscalendar.ru/
```

The APK is created in `app/build/outputs/apk/release/`. The current direct-download build is signed by the workstation's persistent Android test key, is not debuggable, and is minified. The matching public certificate fingerprint is published in `public/.well-known/assetlinks.json`, so Android can verify the domain and open GENESIS as a full-screen Trusted Web Activity. The private key must never be committed and must be retained to issue installable updates for this test package.

## Play Market release

1. Create an upload key and keep it outside Git.
2. Build an Android App Bundle with `:app:bundleRelease` and the production HTTPS URL.
3. Put the release certificate SHA-256 fingerprint into `assetlinks.json.template` and publish it as `https://genesiscalendar.ru/.well-known/assetlinks.json`.
4. Verify the association, Google OAuth production consent screen, privacy policy and Play Console data-safety answers.

The application ID is `ru.genesis.calendar`, target SDK is Android 16 / API 36, and the Android Browser Helper dependency provides the TWA shell.
