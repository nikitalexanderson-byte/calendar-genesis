import { readFile } from "node:fs/promises";

const languages = ["el", "de", "fr", "es", "it", "pt"];
const english = JSON.parse(await readFile(new URL("../app/translations.en.json", import.meta.url), "utf8"));
const missing = [];

for (const language of languages) {
  const files = language === "el" ? ["el.a", "el.b"] : [language];
  const catalog = Object.assign({}, ...await Promise.all(files.map(async (name) =>
    JSON.parse(await readFile(new URL(`../app/translations.${name}.json`, import.meta.url), "utf8")))));
  for (const key of Object.keys(english)) {
    if (typeof catalog[key] !== "string" || !catalog[key].trim()) missing.push(`${language}: missing ${key}`);
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== "string" || !value.trim() || /[А-Яа-яЁё]|GENESISS/u.test(value)) missing.push(`${language}: invalid ${key}`);
  }
}

if (missing.length) {
  for (const issue of missing) console.error(issue);
  process.exitCode = 1;
} else {
  console.log("Six additional locale catalogs passed coverage and script checks.");
}
