const SCOPE = self.registration.scope;
try {
  importScripts(new URL("./precache-manifest.js", SCOPE).href);
} catch {
  self.__GENESIS_PRECACHE_VERSION = "fallback";
  self.__GENESIS_PRECACHE = [];
}
const CACHE_PREFIX = "genesis-shell-";
const CACHE_VERSION = typeof self.__GENESIS_PRECACHE_VERSION === "string" ? self.__GENESIS_PRECACHE_VERSION : "fallback";
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const PRECACHE = Array.isArray(self.__GENESIS_PRECACHE) ? self.__GENESIS_PRECACHE : [];
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
const ACHIEVEMENT_ART = [
  "./achievement-art/first-step.webp",
  "./achievement-art/three-day-rhythm.webp",
  "./achievement-art/seven-sunrises.webp",
  "./achievement-art/fortnight-rhythm.webp",
  "./achievement-art/perfect-day.webp",
  "./achievement-art/habit-thirty.webp",
  "./achievement-art/century.webp",
  "./achievement-art/iron-rhythm.webp",
  "./achievement-art/fifty-sunrises.webp",
  "./achievement-art/hundred-day-path.webp",
  "./achievement-art/perfect-week.webp",
  "./achievement-art/perfect-month.webp",
  "./achievement-art/half-year-circle.webp",
  "./achievement-art/full-revolution.webp",
  "./achievement-art/five-hundred-sunrises.webp",
  "./achievement-art/thousand-day-path.webp",
  "./achievement-art/comeback.webp",
  "./achievement-art/consistency.webp",
];
const THEOKYKLOS_ART = [
  "./theokyklos-art/northwest-apollo.webp",
  "./theokyklos-art/north-athena.webp",
  "./theokyklos-art/northeast-artemis.webp",
  "./theokyklos-art/west-poseidon-amphitrite.webp",
  "./theokyklos-art/center-dionysus-ariadne.webp",
  "./theokyklos-art/east-hermes-peitho.webp",
  "./theokyklos-art/southwest-demeter.webp",
  "./theokyklos-art/south-ares-aphrodite.webp",
  "./theokyklos-art/southeast-hephaestus-aglaea.webp",
  "./theokyklos-art/zenith-zeus-hera.webp",
  "./theokyklos-art/hearth-hestia.webp",
  "./theokyklos-art/nadir-hades-persephone.webp",
  "./theokyklos-art/entrance-aether-hemera.webp",
  "./theokyklos-art/exit-eros-psyche.webp",
];
const THEOKYKLOS_SYMBOL_ART = [
  "./theokyklos-symbols/northwest-apollo.png",
  "./theokyklos-symbols/north-athena.png",
  "./theokyklos-symbols/northeast-artemis.png",
  "./theokyklos-symbols/west-poseidon-amphitrite.png",
  "./theokyklos-symbols/center-dionysus-ariadne.png",
  "./theokyklos-symbols/east-hermes-peitho.png",
  "./theokyklos-symbols/southwest-demeter.png",
  "./theokyklos-symbols/south-ares-aphrodite.png",
  "./theokyklos-symbols/southeast-hephaestus-aglaea.png",
  "./theokyklos-symbols/zenith-zeus-hera.png",
  "./theokyklos-symbols/hearth-hestia.png",
  "./theokyklos-symbols/nadir-hades-persephone.png",
  "./theokyklos-symbols/entrance-aether-hemera.png",
  "./theokyklos-symbols/exit-eros-psyche.png",
];
const CORE = ["./", "./manifest.webmanifest", "./manifest.en.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./genesis-hero.png", ...MONTH_ART, ...WEEKDAY_ART, ...ACHIEVEMENT_ART, ...THEOKYKLOS_ART, ...THEOKYKLOS_SYMBOL_ART]
  .map((path) => new URL(path, SCOPE).href);
const REQUIRED_SHELL = [...new Set([...CORE, ...PRECACHE.map((path) => new URL(path, SCOPE).href)])];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(REQUIRED_SHELL.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
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
