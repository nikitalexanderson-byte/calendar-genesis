import { readdir, readFile, stat } from "node:fs/promises";

const outputRoot = new URL("../dist-beget/public_html/", import.meta.url);
const assetsRoot = new URL("assets/", outputRoot);
const MAX_PRODUCTION_JS_CHUNK_BYTES = 350_000;
const REQUIRED_VISUAL_ASSETS = [
  "achievement-art/first-step.png",
  "achievement-art/three-day-rhythm.png",
  "achievement-art/seven-sunrises.png",
  "achievement-art/fortnight-rhythm.png",
  "achievement-art/perfect-day.png",
  "achievement-art/habit-thirty.png",
  "achievement-art/century.png",
  "achievement-art/iron-rhythm.png",
  "achievement-art/fifty-sunrises.png",
  "achievement-art/hundred-day-path.png",
  "achievement-art/perfect-week.png",
  "achievement-art/perfect-month.png",
  "achievement-art/half-year-circle.png",
  "achievement-art/full-revolution.png",
  "achievement-art/five-hundred-sunrises.png",
  "achievement-art/thousand-day-path.png",
  "achievement-art/comeback.png",
  "achievement-art/consistency.png",
  "theokyklos-art/northwest-apollo.webp",
  "theokyklos-art/north-athena.webp",
  "theokyklos-art/northeast-artemis.webp",
  "theokyklos-art/west-poseidon-amphitrite.webp",
  "theokyklos-art/center-dionysus-ariadne.webp",
  "theokyklos-art/east-hermes-peitho.webp",
  "theokyklos-art/southwest-demeter.webp",
  "theokyklos-art/south-ares-aphrodite.webp",
  "theokyklos-art/southeast-hephaestus-aglaea.webp",
  "theokyklos-art/zenith-zeus-hera.webp",
  "theokyklos-art/hearth-hestia.webp",
  "theokyklos-art/nadir-hades-persephone.webp",
  "theokyklos-art/entrance-aether-hemera.webp",
  "theokyklos-art/exit-eros-psyche.webp",
  "theokyklos-symbols/northwest-apollo.png",
  "theokyklos-symbols/north-athena.png",
  "theokyklos-symbols/northeast-artemis.png",
  "theokyklos-symbols/west-poseidon-amphitrite.png",
  "theokyklos-symbols/center-dionysus-ariadne.png",
  "theokyklos-symbols/east-hermes-peitho.png",
  "theokyklos-symbols/southwest-demeter.png",
  "theokyklos-symbols/south-ares-aphrodite.png",
  "theokyklos-symbols/southeast-hephaestus-aglaea.png",
  "theokyklos-symbols/zenith-zeus-hera.png",
  "theokyklos-symbols/hearth-hestia.png",
  "theokyklos-symbols/nadir-hades-persephone.png",
  "theokyklos-symbols/entrance-aether-hemera.png",
  "theokyklos-symbols/exit-eros-psyche.png",
];
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

const missingVisualAssets = [];
for (const asset of REQUIRED_VISUAL_ASSETS) {
  try {
    await stat(new URL(asset, outputRoot));
  } catch {
    missingVisualAssets.push(asset);
    continue;
  }
  if (!serviceWorker.includes(JSON.stringify(`./${asset}`))) missingVisualAssets.push(`${asset} (not precached)`);
}
if (missingVisualAssets.length) throw new Error(`Required visual assets are missing: ${missingVisualAssets.join(", ")}`);

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

console.log(`Offline precache verified: ${entryAssets.length} mandatory entry assets and ${REQUIRED_VISUAL_ASSETS.length} visual assets. Largest JS chunk: ${largestChunk.fileName} (${largestChunk.bytes} bytes).`);
