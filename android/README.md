# GENESIS for Android

This module wraps the HTTPS PWA as a Trusted Web Activity. The browser and Android app therefore share the same Google session, server account, tasks, projects and reminders.

## Debug build

Use Android Studio's bundled JDK and pass the final Beget URL:

```powershell
.\gradlew.bat :app:assembleDebug -PgenesisUrl=https://genesis.example.com/
```

The APK is created in `app/build/outputs/apk/debug/`. Until Digital Asset Links are published, Android opens the site as a secure Custom Tab; after verification it becomes a full-screen Trusted Web Activity.

## Play Market release

1. Create an upload key and keep it outside Git.
2. Build an Android App Bundle with `:app:bundleRelease` and the production HTTPS URL.
3. Put the release certificate SHA-256 fingerprint into `assetlinks.json.template` and publish it as `https://<domain>/.well-known/assetlinks.json`.
4. Verify the association, Google OAuth production consent screen, privacy policy and Play Console data-safety answers.

The application ID is `ru.genesis.calendar`, target SDK is Android 16 / API 36, and the Android Browser Helper dependency provides the TWA shell.
