import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredBase = process.env.GENESIS_BASE_PATH?.trim() || "/";
const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
const apiUrl = process.env.GENESIS_API_URL?.trim() || `${base.replace(/\/$/, "")}/api`;
const PRECACHE_STATIC_REVISION = "theokyklos-gods-and-rewards-v4";

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
      const version = createHash("sha256").update(`${PRECACHE_STATIC_REVISION}\n${requiredFiles.join("\n")}`).digest("hex").slice(0, 16);
      const publicUrls = requiredFiles.map((fileName) => `${basePath}${fileName}`);
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
  plugins: [react(), offlinePrecacheManifest(base)],
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
