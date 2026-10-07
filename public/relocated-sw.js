self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: "window" });
    await Promise.all(windows.map((client) => client.navigate("/relocated.html")));
  })());
});
