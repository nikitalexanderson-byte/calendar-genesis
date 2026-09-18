const CACHE = "genesis-shell-v24";
const SCOPE = self.registration.scope;
const MONTH_ART = Array.from({ length: 13 }, (_, index) => `./month-art-v4/month-${String(index + 1).padStart(2, "0")}.webp`);
const WEEKDAY_ART = [
  "./weekday-art/weekday-0-sunday-apollo.webp",
  "./weekday-art/weekday-1-monday-lunar-goddesses.webp",
  "./weekday-art/weekday-2-tuesday-ares.webp",
  "./weekday-art/weekday-3-wednesday-hermes.webp",
  "./weekday-art/weekday-4-thursday-zeus-hera.webp",
  "./weekday-art/weekday-5-friday-aphrodite-hestia-dionysus.webp",
  "./weekday-art/weekday-6-saturday-cronus.webp",
];
const CORE = ["./", "./manifest.webmanifest", "./manifest.en.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./genesis-hero.png", ...MONTH_ART, ...WEEKDAY_ART]
  .map((path) => new URL(path, SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;
  if (url.pathname.includes("/downloads/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = new URL(data.url || "./#today", SCOPE).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const visibleClient = clients.find((client) => "focus" in client);
      if (visibleClient) {
        visibleClient.postMessage({
          type: "GENESIS_NOTIFICATION_OPENED",
          notificationId: data.genesisNotificationId,
          kind: data.kind,
          variant: data.variant,
        });
        await visibleClient.focus();
        if ("navigate" in visibleClient) await visibleClient.navigate(targetUrl);
        return;
      }
      await self.clients.openWindow(targetUrl);
    }),
  );
});
