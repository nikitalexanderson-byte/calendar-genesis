import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "vite";
import react from "@vitejs/plugin-react";

test("anonymous welcome renders Google-only sign-in in every supported language", async () => {
  const entry = "virtual:welcome-render-test";
  const bundle = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react(), {
      name: "welcome-render-entry",
      resolveId(id) { if (id === entry) return entry; },
      load(id) {
        if (id === entry) return `export { WelcomeScreen } from ${JSON.stringify(fileURLToPath(new URL("../app/WelcomeScreen.tsx", import.meta.url)).replaceAll("\\", "/"))}; export { LANGUAGES } from ${JSON.stringify(fileURLToPath(new URL("../app/i18n.ts", import.meta.url)).replaceAll("\\", "/"))};`;
      },
    }],
    // Bundle the real component without Vite's dev module transport, which can
    // time out on the large locale catalogs on Windows. React stays shared with
    // the renderer, and the assertions below still cover every language.
    build: { ssr: true, write: false, minify: false,
      rolldownOptions: { input: entry, external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime"], output: { codeSplitting: false } } },
  });
  const chunk = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((item) => item.output).find((item) => item.type === "chunk" && item.isEntry);
  assert.ok(chunk, "the real welcome component must build");
  const bundleDirectory = fileURLToPath(new URL("../node_modules/.cache/genesis-tests/", import.meta.url));
  await mkdir(bundleDirectory, { recursive: true });
  const bundlePath = path.join(bundleDirectory, `welcome-${randomUUID()}.mjs`);
  await writeFile(bundlePath, chunk.code);
  try {
    const { WelcomeScreen, LANGUAGES } = await import(pathToFileURL(bundlePath).href);
    for (const language of LANGUAGES) {
      const html = renderToStaticMarkup(createElement(WelcomeScreen, {
        nativeAndroidApkUrl: null, busy: false, error: "", language,
        onLanguageChange() {}, onGoogle() {},
      }));
      assert.ok(html.includes("GENESIS"), `${language}: public purpose must render`);
      assert.ok(html.includes("google-signin-light-pill.svg"), `${language}: Google sign-in must render`);
      assert.ok(html.includes('href="/privacy"') && html.includes('href="/terms"'), `${language}: public documents must remain linked`);
      assert.doesNotMatch(html, /yandex|яндекс|genesiscalendar\.ru/i, `${language}: obsolete public auth must be absent`);
    }
  } finally {
    await rm(bundlePath);
  }
});
