# GENESIS preview packages

`public/downloads/GENESIS-Android-1.2.2.apk` is the current direct-install Android test release. It opens `https://genesiscalendar.ru/` in the device browser's secure Custom Tab, with the default browser as a final fallback, so the application always uses the same current client, tasks, projects, reminders and offline service worker as the website without relying on vendor-specific TWA/WebView rendering. Each future build must use a versioned filename so website and CDN caches cannot serve an older APK for a new release.

The APK is minified and not debuggable, but it is signed only with the persistent workstation test certificate. Keep that private certificate outside Git so future test versions can update the installed app. A final Play build must use the separately protected owner-controlled upload key and its own matching Digital Asset Links fingerprint.
