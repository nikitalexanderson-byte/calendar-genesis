# GENESIS native Android — internal alpha

Kotlin/Jetpack Compose implementation in the existing Android module. It is not a WebView, TWA or browser launcher. Current screens are local tasks, day/calendar, habits and settings. Feature and visual parity are incomplete: see [STATUS](../docs/android/STATUS.md).

## Build on Windows

Use installed stable SDK and Android Studio JBR. Do not accept SDK licenses automatically.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleDebugAndroidTest :app:lintDebug --no-daemon --console=plain '-Pandroid.builder.sdkDownload=false'
```

APK: `app/build/outputs/apk/debug/app-debug.apk`, package `ru.genesis.calendar.debug`, version `2.0.0-alpha01` (6). Debug and release are different identities; debug is not a release upgrade channel. Use `adb install -r` only on an approved device. Never uninstall/clear as a signing workaround.

Current toolchain: AGP 9.4.0, Gradle 9.6.0, Kotlin/Compose compiler 2.2.10, compileSdk 37.2, targetSdk 37, minSdk 26. Gradle JVM uses `file.encoding=COMPAT` because Java argfiles otherwise corrupt Cyrillic checkout paths on this Windows installation; source code remains UTF-8. No global OS setting is changed.

## Data and security

Alpha has a deliberately isolated local validation scope. Tasks and habits are stored on device, not falsely marked cloud-synced. Keystore protects field encryption; schedule metadata is in credential-encrypted app storage. Backup is disabled. Synthetic fixtures live in androidTest, not production seed data.

The Google sign-in panel is an integration diagnostic, not connected cloud workspace UI. Native backend routes are local/unpublished. Do not claim login, synchronization or release ready before real account tests.

## Release

Release no longer falls back to debug signing. A permanent owner-approved signing identity and backup, release login, data preservation, notification tests, verified links and full parity gates are required. Distribution is signed APK from the website, not Google Play. No public upload, merge/deploy or download CTA was activated.

See [environment](../docs/android/ENVIRONMENT.md), [manual steps](../docs/android/MANUAL_STEPS.md), [release runbook](../docs/android/RELEASE_RUNBOOK.md).
