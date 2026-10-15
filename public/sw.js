const SCOPE = self.registration.scope;
const ASSETS_PATH = new URL("./assets/", SCOPE).pathname;
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
const LUNAR_MONTH_ART = [
  "./lunar-month-art-v1/month-01.webp",
  "./lunar-month-art-v1/month-02.webp",
  "./lunar-month-art-v1/month-03.webp",
  "./lunar-month-art-v1/month-04.webp",
  "./lunar-month-art-v1/month-05.webp",
  "./lunar-month-art-v1/month-06.webp",
  "./lunar-month-art-v1/month-07.webp",
  "./lunar-month-art-v1/month-08.webp",
  "./lunar-month-art-v1/month-09.webp",
  "./lunar-month-art-v1/month-10.webp",
  "./lunar-month-art-v1/month-11.webp",
  "./lunar-month-art-v1/month-12.webp",
  "./lunar-month-art-v1/month-13.webp",
];
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
  "./achievement-art/first-step.png",
  "./achievement-art/three-day-rhythm.png",
  "./achievement-art/seven-sunrises.png",
  "./achievement-art/fortnight-rhythm.png",
  "./achievement-art/perfect-day.png",
  "./achievement-art/habit-thirty.png",
  "./achievement-art/century.png",
  "./achievement-art/iron-rhythm.png",
  "./achievement-art/fifty-sunrises.png",
  "./achievement-art/hundred-day-path.png",
  "./achievement-art/perfect-week.png",
  "./achievement-art/perfect-month.png",
  "./achievement-art/half-year-circle.png",
  "./achievement-art/full-revolution.png",
  "./achievement-art/five-hundred-sunrises.png",
  "./achievement-art/thousand-day-path.png",
  "./achievement-art/comeback.png",
  "./achievement-art/consistency.png",
];
const HABIT_REWARD_ART = [
  "./habit-reward-art/hestia-spark.png",
  "./habit-reward-art/comeback.png",
];
const HERO_RANK_BANNER_ART = [
  "./habit-ranks/heroic-ranks.webp",
];
const CALENDAR_ART = [
  "./calendar-art/saturn-cronus.webp",
];
const HERO_PATH_ICON_FILES = [
  "01_tantal",
  "02_sisyphus",
  "03_cyclops",
  "04_icarus",
  "05_lionheart",
  "06_poison_conqueror",
  "07_golden_horn_pathfinder",
  "08_mountain_tamer",
  "09_lord_of_the_flow",
  "10_bronze_wing",
  "11_tamer_of_might",
  "12_iron_charioteer",
  "13_bearer_of_royal_honor",
  "14_guardian_of_the_western_border",
  "15_keeper_of_the_golden_garden",
  "16_risen_from_the_abyss",
  "17_amphora_of_aspiration",
  "18_amphora_of_endurance",
  "19_amphora_of_mastery",
  "20_amphora_of_abyss",
];
const HERO_PATH_ART = HERO_PATH_ICON_FILES.flatMap((fileName) => [
  `./hero-path/256/${fileName}.webp`,
  `./hero-path/512/${fileName}.webp`,
]);
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
const CORE = ["./", "./manifest.webmanifest", "./manifest.en.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./genesis-hero.png", ...MONTH_ART, ...LUNAR_MONTH_ART, ...WEEKDAY_ART, ...ACHIEVEMENT_ART, ...HABIT_REWARD_ART, ...HERO_RANK_BANNER_ART, ...CALENDAR_ART, ...HERO_PATH_ART, ...THEOKYKLOS_ART, ...THEOKYKLOS_SYMBOL_ART]
  .map((path) => new URL(path, SCOPE).href);
const REQUIRED_SHELL = [...new Set([...CORE, ...PRECACHE.map((path) => new URL(path, SCOPE).href)])];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(REQUIRED_SHELL.map((url) => new Request(url, { cache: "reload" })));
    // SPA fallback can return HTTP 200 HTML while hashed assets are being deployed.
    // Such a response must never become an installed offline JavaScript module.
    for (const url of REQUIRED_SHELL.filter((url) => new URL(url).pathname.startsWith(ASSETS_PATH))) {
      const response = await cache.match(url);
      if (!response || response.headers.get("Content-Type")?.includes("text/html")) {
        await cache.delete(url);
        throw new Error("GENESIS asset precache received an HTML fallback");
      }
    }
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

  // Versioned bundles are immutable. Keep serving the current page's cached
  // modules while a newer worker waits for all open tabs to close.
  if (url.pathname.startsWith(ASSETS_PATH)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached && !cached.headers.get("Content-Type")?.includes("text/html")) return cached;
        const response = await fetch(request);
        if (response.headers.get("Content-Type")?.includes("text/html")) {
          // Also protect clients still behind a stale SPA rewrite configuration.
          return new Response("Module unavailable", { status: 404, headers: {
            "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store",
          } });
        }
        if (response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

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

const SHARED_PUSH_RECEIPTS = "genesis-shared-push-receipts-v1";
let sharedPushChain = Promise.resolve();
let sharedPushReceived = 0;
self.addEventListener("push", (event) => {
  let id;
  try { id = event.data?.json()?.deliveryId; } catch { return; }
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) return;
  const receive = async () => {
    const receipts = await caches.open(SHARED_PUSH_RECEIPTS);
    const receiptUrl = new URL(`./__shared-push-receipt/${id}`, SCOPE).href;
    if (await receipts.match(receiptUrl)) return;
    // Cookies and current access are required even when the browser receives a valid encrypted push.
    const response = await fetch(new URL(`./api/shared/push-deliveries/${encodeURIComponent(id)}`, SCOPE).href, { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json(), message = result.message;
    if (!result.displayAllowed || !message || message.deliveryId !== id || typeof message.body !== "string") return;
    const target = new URL(message.url, SCOPE);
    if (target.origin !== new URL(SCOPE).origin || !target.pathname.startsWith(new URL(SCOPE).pathname)) return;
    await self.registration.showNotification("GENESIS", { body: message.body, lang: message.lang, tag: `genesis-shared-${id}`, renotify: false,
      data: { url: target.href, sharedDeliveryId: id } });
    await receipts.put(receiptUrl, new Response(JSON.stringify({ receivedAt: Date.now() }), { headers: { "Content-Type": "application/json" } }));
    // Keep receipts beyond the provider TTL. Only old opaque IDs are removed, never current unread content.
    if (++sharedPushReceived % 50 === 0) for (const key of await receipts.keys()) {
      const old = await receipts.match(key); let receivedAt;
      try { receivedAt = (await old.json()).receivedAt; } catch { continue; }
      if (typeof receivedAt === "number" && receivedAt < Date.now() - 172800000) await receipts.delete(key);
    }
  };
  sharedPushChain = sharedPushChain.catch(() => undefined).then(receive).catch(() => undefined);
  event.waitUntil(sharedPushChain);
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
