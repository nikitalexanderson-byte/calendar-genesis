import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const origin = "https://genesiscalendar.com/";
const assetUrl = `${origin}assets/account.js`;

function worker({ assetHtml = false, cachedHtml = false, networkHtml = false } = {}) {
  const events = new Map();
  const records = new Map();
  let networkRequests = 0;
  const cache = {
    async addAll(requests) {
      for (const request of requests) records.set(request.url, new Response("content", {
        headers: { "Content-Type": request.url === assetUrl && assetHtml ? "text/html" : "application/javascript" },
      }));
    },
    async match(request) { return records.get(typeof request === "string" ? request : request.url)?.clone(); },
    async put(request, response) { records.set(typeof request === "string" ? request : request.url, response); },
    async delete(url) { return records.delete(url); },
  };
  if (cachedHtml) records.set(assetUrl, new Response("<html>fallback</html>", { headers: { "Content-Type": "text/html" } }));
  const self = {
    registration: { scope: origin }, location: { origin: new URL(origin).origin },
    __GENESIS_PRECACHE_VERSION: "test", __GENESIS_PRECACHE: ["./assets/account.js"],
    addEventListener: (name, callback) => events.set(name, callback),
  };
  runInNewContext(source, {
    self, URL, Request, Response, importScripts() {}, caches: { open: async () => cache },
    fetch: async () => { networkRequests += 1; return new Response(networkHtml ? "<html>fallback</html>" : "export const ready = true;", { headers: { "Content-Type": networkHtml ? "text/html" : "application/javascript" } }); },
  });
  return { events, records, networkRequests: () => networkRequests };
}

test("offline installation rejects HTML masquerading as a hashed JavaScript module", async () => {
  const fixture = worker({ assetHtml: true });
  let installation;
  fixture.events.get("install")({ waitUntil: promise => { installation = promise; } });
  await assert.rejects(installation, /HTML fallback/);
  assert.equal(fixture.records.has(assetUrl), false);
});

test("a poisoned module cache recovers from the network instead of returning HTML", async () => {
  const fixture = worker({ cachedHtml: true });
  let responsePromise;
  fixture.events.get("fetch")({ request: new Request(assetUrl), respondWith: promise => { responsePromise = promise; } });
  const response = await responsePromise;
  assert.equal(response.headers.get("Content-Type"), "application/javascript");
  assert.match(await response.text(), /export const ready/);
  assert.equal(fixture.networkRequests(), 1);
});

test("valid precached modules remain available without a network request", async () => {
  const fixture = worker();
  let installation;
  fixture.events.get("install")({ waitUntil: promise => { installation = promise; } });
  await installation;
  let responsePromise;
  fixture.events.get("fetch")({ request: new Request(assetUrl), respondWith: promise => { responsePromise = promise; } });
  assert.equal((await responsePromise).headers.get("Content-Type"), "application/javascript");
  assert.equal(fixture.networkRequests(), 0);
});

test("a stale SPA rewrite cannot return or cache HTML as a module", async () => {
  const fixture = worker({ networkHtml: true });
  let responsePromise;
  fixture.events.get("fetch")({ request: new Request(assetUrl), respondWith: promise => { responsePromise = promise; } });
  const response = await responsePromise;
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(fixture.records.has(assetUrl), false);
});
