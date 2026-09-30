import { readFile } from "node:fs/promises";

const languages = ["el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja"];
const english = JSON.parse(await readFile(new URL("../app/translations.en.json", import.meta.url), "utf8"));
const missing = [];
const welcomeParagraphs = [
  "GENESIS — приложение для планирования личных и рабочих задач, проектов, подпроектов, повторений и напоминаний. Календарь помогает составлять план дня, связывать действия и отмечать выполненное на компьютере или телефоне.",
  "Сначала Google передаёт только подтверждённый адрес, имя и изображение профиля для безопасного входа. Уже после входа вы сами решаете, подключать ли синхронизацию: GENESIS создаёт отдельный календарь GENESIS, а доступ к Google Tasks использует для показа и двустороннего изменения ваших списков и задач. Разрешения не применяются для рекламы, профилирования или обучения моделей.",
];
const accountDomainKey = "GENESIS никогда не запрашивает пароль от Google. Авторизация выполняется только на защищённой странице accounts.google.com.";

for (const language of languages) {
  const files = ["el", "sr", "uk"].includes(language) ? [`${language}.a`, `${language}.b`] : [language];
  const catalog = Object.assign({}, ...await Promise.all(files.map(async (name) =>
    JSON.parse(await readFile(new URL(`../app/translations.${name}.json`, import.meta.url), "utf8")))));
  for (const key of Object.keys(english)) {
    if (typeof catalog[key] !== "string" || !catalog[key].trim()) missing.push(`${language}: missing ${key}`);
  }
  for (const [key, value] of Object.entries(catalog)) {
    const wrongScript = !["sr", "uk"].includes(language) && /[А-Яа-яЁё]/u.test(value);
    if (typeof value !== "string" || !value.trim() || wrongScript || /GENESISS/u.test(value)) missing.push(`${language}: invalid ${key}`);
  }
  for (const key of welcomeParagraphs) {
    if (!catalog[key]) missing.push(`${language}: missing exact welcome paragraph`);
  }
  if (!catalog[accountDomainKey]?.includes("accounts.google.com"))
    missing.push(`${language}: Google account domain changed in translation`);
}

if (missing.length) {
  for (const issue of missing) console.error(issue);
  process.exitCode = 1;
} else {
  console.log("Twelve additional locale catalogs passed coverage and script checks.");
}
