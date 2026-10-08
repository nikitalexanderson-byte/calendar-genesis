import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { LEGAL_UPDATED, legalPages } from "./app/legal-content";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredBase = process.env.GENESIS_BASE_PATH?.trim() || "/";
const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
const apiUrl = process.env.GENESIS_API_URL?.trim() || `${base.replace(/\/$/, "")}/api`;
const PRECACHE_STATIC_REVISION = "saturn-calendar-art-v7";

function publicLegalDocuments(): Plugin {
  const escape = (text: string) => text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
  return {
    name: "genesis-public-legal-documents",
    apply: "build",
    enforce: "post",
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
    generateBundle(_options, bundle) {
      const requiredFiles = Object.values(bundle)
        .map((output) => output.fileName)
        .filter((fileName) => /\.(?:js|css)$/i.test(fileName))
        .sort();
      if (!requiredFiles.length) this.error("Offline precache manifest has no JavaScript or CSS assets.");
      const fonts = ["fonts/SourceSans3.woff2", "fonts/Literata.woff2"];
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
            ...["el.a", "el.b", "de", "fr", "es", "it", "pt", "pl", "sr.a", "sr.b", "uk.a", "uk.b", "zh", "tr", "ja", "ja.b"].map((locale) => ({
              name: `locale-${locale}`,
              test: new RegExp(`translations\\.${locale}\\.json$`),
              priority: 40,
            })),
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
