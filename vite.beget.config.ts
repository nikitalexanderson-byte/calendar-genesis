import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { LEGAL_UPDATED, legalPages } from "./app/legal-content";
import { SERVICE_IDENTITY } from "./app/public-service";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredBase = process.env.GENESIS_BASE_PATH?.trim() || "/";
const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
const apiUrl = process.env.GENESIS_API_URL?.trim() || `${base.replace(/\/$/, "")}/api`;
const PRECACHE_STATIC_REVISION = "lunar-cool-calendar-art-v8";

function publicLegalDocuments(): Plugin {
  const escape = (text: string) => text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
  return {
    name: "genesis-public-legal-documents",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace("%GENESIS_SERVICE_IDENTITY%", escape(SERVICE_IDENTITY.ru));
    },
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset" || typeof index.source !== "string") {
        this.error("The public homepage must be built before legal documents.");
      }
      const template = index.source;
      const root = /<div id="root">[\s\S]*<\/div>/;
      if (!root.test(template)) this.error("Public homepage root is missing.");
      for (const [slug, document] of Object.entries(legalPages)) {
        const sections = document.sections.map(([title, body]) =>
          `<section><h2>${escape(title)}</h2><p>${escape(body)}</p></section>`).join("\n");
        const markup = `<div id="root"><main class="legal-shell">
          <header class="legal-header"><a class="welcome-brand" href="/"><span class="solar-mark"><i></i></span><span><strong>GENESIS</strong><small>доверие и ясность</small></span></a><a href="/">← На главную</a></header>
          <article class="legal-document"><span class="welcome-kicker">ОФИЦИАЛЬНЫЙ ДОКУМЕНТ</span><h1>${escape(document.title)}</h1><p class="legal-intro">${escape(document.intro)}</p><p class="legal-date">Редакция от ${escape(LEGAL_UPDATED)}</p>${sections}
          ${slug === "privacy" ? '<p class="legal-policy-link"><a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a></p>' : ""}</article>
          <footer class="legal-footer"><a href="/privacy">Конфиденциальность</a><a href="/terms">Соглашение</a><a href="/support">Поддержка</a><a href="/delete-account">Удаление аккаунта</a></footer>
        </main></div>`;
        const source = template.replace(root, markup)
          .replace(/<title>[^<]*<\/title>/, `<title>${escape(document.title)} · GENESIS</title>`)
          .replace(/(<meta name="description" content=")[^"]*("\s*\/?\s*>)/, `$1${escape(document.intro)}$2`)
          .replace('href="https://genesiscalendar.com/"', `href="https://genesiscalendar.com/${slug}"`);
        this.emitFile({ type: "asset", fileName: `${slug}.html`, source });
      }
    },
  };
}

function offlinePrecacheManifest(basePath: string): Plugin {
  return {
    name: "genesis-offline-precache-manifest",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const requiredFiles = Object.values(bundle)
        .map((output) => output.fileName)
        .filter((fileName) => /\.(?:js|css)$/i.test(fileName))
        .sort();
      if (!requiredFiles.length) this.error("Offline precache manifest has no JavaScript or CSS assets.");
      const fonts = ["fonts/SourceSans3.woff2", "fonts/Literata.woff2",
        "fonts/experimental/Inter-cyrillic-ext.woff2",
        "fonts/experimental/Inter-cyrillic.woff2",
        "fonts/experimental/Inter-greek-ext.woff2",
        "fonts/experimental/Inter-greek.woff2",
        "fonts/experimental/Inter-vietnamese.woff2",
        "fonts/experimental/Inter-latin-ext.woff2",
        "fonts/experimental/Inter-latin.woff2",
        "fonts/experimental/SourceSerif4-cyrillic-ext.woff2",
        "fonts/experimental/SourceSerif4-cyrillic.woff2",
        "fonts/experimental/SourceSerif4-greek.woff2",
        "fonts/experimental/SourceSerif4-vietnamese.woff2",
        "fonts/experimental/SourceSerif4-latin-ext.woff2",
        "fonts/experimental/SourceSerif4-latin.woff2"];
      const fingerprint = createHash("sha256").update(`${PRECACHE_STATIC_REVISION}\n${requiredFiles.join("\n")}`);
      fonts.forEach((file) => fingerprint.update(readFileSync(path.join(projectRoot, "public", file))));
      const version = fingerprint.digest("hex").slice(0, 16);
      const publicUrls = requiredFiles.map((fileName) => `${basePath}${fileName}`);
      fonts.forEach((file) => publicUrls.push(`${basePath}${file}`));
      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.js",
        source: `self.__GENESIS_PRECACHE_VERSION=${JSON.stringify(version)};self.__GENESIS_PRECACHE=${JSON.stringify(publicUrls)};\n`,
      });
      // Also change the top-level worker when its imported resource list changes.
      // Browsers can then detect a new build without relying on a cached import.
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `// GENESIS precache build: ${version}\n${readFileSync(path.join(projectRoot, "public", "sw.js"), "utf8")}`,
      });
    },
  };
}

export default defineConfig({
  root: path.join(projectRoot, "beget"),
  base,
  publicDir: path.join(projectRoot, "public"),
  plugins: [react(), offlinePrecacheManifest(base), publicLegalDocuments()],
  define: {
    "process.env.NEXT_PUBLIC_GENESIS_API_URL": JSON.stringify(apiUrl),
    "process.env.NEXT_PUBLIC_GENESIS_BASE_PATH": JSON.stringify(base),
  },
  build: {
    outDir: path.join(projectRoot, "dist-beget", "public_html"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            ...["el.a", "el.b", "de", "de.b", "fr", "fr.b", "es", "it", "pt", "pl", "sr.a", "sr.b", "uk.a", "uk.b", "zh", "tr", "ja", "ja.b"].map((locale) => ({
              name: `locale-${locale}`,
              test: new RegExp(`translations\\.${locale}\\.json$`),
              priority: 45,
            })),
            {
              name: "locale-english",
              test: /app[\\/](?:translations\.en|curated-translations\.en)\.json$/,
              maxSize: 280_000,
              priority: 45,
            },
            {
              name: "locale-years",
              test: /app[\\/]year-translations[\\/][^\\/]+\.json$/,
              maxSize: 280_000,
              priority: 45,
            },
            {
              name: "static-data",
              test: /(?:\.json$|[\\/]references[\\/]days\.txt\?raw$)/,
              maxSize: 280_000,
              priority: 44,
            },
            {
              name: "locale-core",
              test: /app[\\/](?:i18n|region-language)\.ts$/,
              priority: 45,
            },
            {
              name: "device-access",
              test: /app[\\/]local-sign-out\.ts$/,
              priority: 45,
            },
            {
              name: "react-vendor",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "astronomy-engine",
              test: /node_modules[\\/]astronomy-engine[\\/]/,
              priority: 20,
            },
            {
              name: "sync-engine",
              test: /app[\\/](?:cloud-sync|workspace-sync-state|tracker-cache)\.ts$/,
              maxSize: 300_000,
              priority: 15,
            },
            {
              name: "task-form-controls",
              test: /app[\\/](?:TimeClockPicker|CalendarDatePicker|TaskReminderPicker|RecurrenceBuilder)\.tsx$/,
              priority: 14,
            },
            {
              name: "tracker-engine",
              test: /app[\\/](?:habits|habit-[^\\/]+|tracker-(?:analytics|core|math)|daily-goal|rewards|achievements|streak-(?:protection|rewards)|mood-tracker|sleep-tracker|addiction-tracker|sacred-practices)\.ts$/,
              priority: 14,
            },
            {
              name: "workspace-layout",
              test: /app[\\/](?:InboxToolbar\.tsx|(?:ui-visibility|use-account-layout|use-sidebar-collapse)\.ts)$/,
              priority: 14,
            },
            {
              name: "calendar-engine",
              test: /app[\\/](?:calendar-data|solar-times|day-rhythm|task-recurrence|task-reminders|time-format)\.ts$/,
              priority: 13,
            },
          ],
        },
      },
    },
  },
});
