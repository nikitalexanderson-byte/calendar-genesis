import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "vite";
import react from "@vitejs/plugin-react";

test("real Stoicheion keeps existing seed vectors and renders the complete future guide in fourteen languages", async () => {
  const root = fileURLToPath(new URL("../app/", import.meta.url)).replaceAll("\\", "/");
  const entry = "virtual:stoicheion-timeline-render";
  const bundle = await build({ configFile: false, logLevel: "silent", define: { "process.env.NEXT_PUBLIC_GENESIS_API_URL": '""' },
    plugins: [react(), { name: "stoicheion-timeline-render", resolveId: id => id === entry ? entry : undefined,
      load: id => id === entry ? `
        export { StoicheionView, buildStoicheionSpreadReading } from ${JSON.stringify(root + "StoicheionView.tsx")};
        export { FutureModelingGuideDialog, FutureModelingGuide } from ${JSON.stringify(root + "FutureModelingGuide.tsx")};
        export { futureModelingCopy } from ${JSON.stringify(root + "future-modeling.ts")};
        export { stoicheionTimelineCopy } from ${JSON.stringify(root + "stoicheion-timeline.ts")};
        export { setRuntimeLanguage } from ${JSON.stringify(root + "i18n.ts")};
        export { REGION_LANGUAGES } from ${JSON.stringify(root + "region-language.ts")};
      ` : undefined }],
    build: { ssr: true, write: false, rolldownOptions: { input: entry,
      external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime"], output: { codeSplitting: false } } },
  });
  const directory = new URL("../node_modules/.cache/genesis-tests/", import.meta.url);
  await mkdir(directory, { recursive: true });
  const file = new URL(`stoicheion-timeline-${randomUUID()}.mjs`, directory);
  await writeFile(file, bundle.output.find(item => item.isEntry).code);
  try {
    const api = await import(pathToFileURL(fileURLToPath(file)).href);
    const cards = Array.from({ length: 24 }, (_, index) => index);
    const full = api.buildStoicheionSpreadReading(cards, 0x12345678);
    assert.deepEqual(full.map(card => card.letter), [11, 9, 2, 19, 17, 13, 10, 20, 18]);
    assert.deepEqual(full.map(card => card.reversed), [false, true, false, true, false, false, true, true, true]);
    const triple = api.buildStoicheionSpreadReading(cards, 0x12345678, 3);
    assert.deepEqual(triple, full.slice(0, 3));
    assert.deepEqual(api.buildStoicheionSpreadReading(cards, 0xffffffff, 3).map(card => card.letter), [20, 5, 1]);
    for (const seed of [0, 1, 0x7fffffff, 0x80000000, 0xffffffff]) {
      const result = api.buildStoicheionSpreadReading(cards, seed, 3);
      assert.equal(result.length, 3);
      assert.equal(new Set(result.map(card => card.letter)).size, 3);
      assert.ok(result.every(card => typeof card.reversed === "boolean"));
      assert.deepEqual(api.buildStoicheionSpreadReading(cards, seed, 3), result);
    }
    assert.equal(api.buildStoicheionSpreadReading([], 0, 3).length, 0);
    for (const language of api.REGION_LANGUAGES) {
      api.setRuntimeLanguage(language);
      const page = renderToStaticMarkup(createElement(api.StoicheionView));
      const timelineIndex = page.indexOf('aria-labelledby="stoicheion-timeline-title"');
      const guideIndex = page.indexOf('data-testid="future-modeling-open"');
      const alphabetIndex = page.indexOf('aria-labelledby="stoicheion-alphabet-title"');
      assert.ok(timelineIndex > 0 && timelineIndex < guideIndex && guideIndex < alphabetIndex, `${language}: placement`);
      assert.ok(page.includes(api.stoicheionTimelineCopy(language).title), `${language}: timeline title`);
      const guide = renderToStaticMarkup(createElement(api.FutureModelingGuideDialog, { language, onClose() {} }));
      assert.match(guide, new RegExp(`lang="${language}"`));
      assert.equal((guide.match(/data-modeling-sector=/g) ?? []).length, 9, language);
      assert.equal((guide.match(/data-modeling-goal=/g) ?? []).length, 13, language);
      assert.equal((guide.match(/class="future-modeling-step"/g) ?? []).length, 5, language);
      assert.match(guide, /ΑΦΡΟΔΙΤΗ<\/span> · <b>993<\/b>/, language);
      assert.doesNotMatch(guide, /1093|undefined|\[object Object\]/, language);
      assert.ok(guide.includes(api.futureModelingCopy(language).title), `${language}: guide title`);
    }
  } finally { await rm(file, { force: true }); }
});
