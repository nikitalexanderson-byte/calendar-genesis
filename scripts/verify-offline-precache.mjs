import { readdir, readFile, stat } from "node:fs/promises";

const outputRoot = new URL("../dist-beget/public_html/", import.meta.url);
const assetsRoot = new URL("assets/", outputRoot);
const MAX_PRODUCTION_JS_CHUNK_BYTES = 350_000;
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

const javascriptAssets = (await readdir(assetsRoot)).filter((fileName) => fileName.endsWith(".js"));
const javascriptAssetSizes = await Promise.all(javascriptAssets.map(async (fileName) => ({
  fileName,
  bytes: (await stat(new URL(fileName, assetsRoot))).size,
})));
const oversizedChunks = javascriptAssetSizes.filter(({ bytes }) => bytes > MAX_PRODUCTION_JS_CHUNK_BYTES);
if (oversizedChunks.length) {
  throw new Error(`Production JavaScript chunk budget exceeded (${MAX_PRODUCTION_JS_CHUNK_BYTES} bytes): ${oversizedChunks.map(({ fileName, bytes }) => `${fileName}=${bytes}`).join(", ")}`);
}
const largestChunk = javascriptAssetSizes.sort((left, right) => right.bytes - left.bytes)[0];

console.log(`Offline precache verified: ${entryAssets.length} mandatory entry assets. Largest JS chunk: ${largestChunk.fileName} (${largestChunk.bytes} bytes).`);
