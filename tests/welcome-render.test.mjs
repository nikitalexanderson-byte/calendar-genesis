import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("anonymous welcome renders Google-only sign-in in every supported language", async () => {
  const server = await createServer({
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const { WelcomeScreen } = await server.ssrLoadModule(fileURLToPath(new URL("../app/WelcomeScreen.tsx", import.meta.url)));
    const { LANGUAGES } = await server.ssrLoadModule(fileURLToPath(new URL("../app/i18n.ts", import.meta.url)));
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
    await server.close();
  }
});
