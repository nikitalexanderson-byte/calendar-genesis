import { readFile } from "node:fs/promises";

const outputRoot = new URL("../dist-beget/public_html/", import.meta.url);
const [html, manifest, serviceWorker] = await Promise.all([
  readFile(new URL("index.html", outputRoot), "utf8"),
  readFile(new URL("precache-manifest.js", outputRoot), "utf8"),
  readFile(new URL("sw.js", outputRoot), "utf8"),
]);

const entryAssets = Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/gi), (match) => match[1]);
if (!entryAssets.length) throw new Error("Built index.html contains no JavaScript or CSS entry assets.");

const missingAssets = entryAssets.filter((asset) => !manifest.includes(JSON.stringify(asset)));
if (missingAssets.length) throw new Error(`Offline precache manifest is missing: ${missingAssets.join(", ")}`);
if (!/__GENESIS_PRECACHE_VERSION="[a-f0-9]{16}"/.test(manifest)) throw new Error("Offline precache manifest has no build fingerprint.");
if (!serviceWorker.includes('importScripts(new URL("./precache-manifest.js", SCOPE).href)')) throw new Error("Service worker does not import the generated precache manifest.");

console.log(`Offline precache verified: ${entryAssets.length} mandatory entry assets.`);
