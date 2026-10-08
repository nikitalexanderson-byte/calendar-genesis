import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const output = new URL("../dist-beget/public_html/", import.meta.url);
const pages = {
  privacy: "Политика конфиденциальности",
  terms: "Пользовательское соглашение",
  support: "Поддержка GENESIS",
  "delete-account": "Удаление аккаунта и данных",
};
for (const [slug, title] of Object.entries(pages)) {
  const html = await readFile(new URL(`${slug}.html`, output), "utf8");
  const body = html.split("<body>")[1]?.split("</body>")[0];
  assert.ok(body, `${slug}: HTML body is required`);
  assert.ok(body.includes(`<h1>${title}</h1>`), `${slug}: document must be readable without JavaScript`);
  assert.ok(body.includes("8 октября 2026 года"), `${slug}: revision is required`);
  assert.ok(body.includes("<section><h2>"), `${slug}: substantive sections are required`);
  assert.ok(body.includes('href="/privacy"') && body.includes('href="/terms"'), `${slug}: navigation is required`);
  assert.ok(html.includes(`rel="canonical" href="https://genesiscalendar.com/${slug}"`), `${slug}: canonical URL is required`);
  assert.match(html, /<script type="module"[^>]*src="[^"]+\.js"/, `${slug}: interactive client must remain available`);
  assert.doesNotMatch(html, /genesiscalendar\.ru|yandex|яндекс|beget/i, `${slug}: old public references must be absent`);
  if (slug === "privacy") {
    assert.ok(body.includes("Hostinger") && body.includes("Google API Services User Data Policy"));
    assert.ok(body.length > 10000, "privacy: complete policy must be served in the initial response");
  }
}
const homepage = await readFile(new URL("index.html", output), "utf8");
assert.match(homepage, /GENESIS[\s\S]*Календарь задач и проектов/);
assert.doesNotMatch(homepage, /mc\.yandex|yandex\.ru|яндекс/i);
console.log("Public homepage and four legal documents are readable without JavaScript; Google-only .com references verified.");
