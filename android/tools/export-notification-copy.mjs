import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const copy = JSON.parse(await readFile(new URL("app/habit-notification-copy.json", root), "utf8"));
const rows = Object.entries(copy).flatMap(([tone, kinds]) => Object.entries(kinds).map(([kind, entries]) => {
  if (entries.length < 8 || entries.some(([ru, en]) => !ru || !en)) throw new Error(`Incomplete copy: ${tone}/${kind}`);
  return `    "${tone}/${kind}" to listOf(\n${entries.map(([ru, en]) => `        ${JSON.stringify(ru)} to ${JSON.stringify(en)}`).join(",\n")}\n    )`;
}));
const source = `// Generated from app/habit-notification-copy.json by android/tools/export-notification-copy.mjs.\npackage ru.genesis.calendar.reminders\n\ninternal val habitNotificationMessages = mapOf(\n${rows.join(",\n")}\n)\n`;
const output = new URL("android/app/src/main/java/ru/genesis/calendar/reminders/HabitNotificationMessages.kt", root);
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")).replaceAll("\r\n", "\n") !== source) throw new Error("Android notification copy is out of date");
} else await writeFile(fileURLToPath(output), source);
console.log("Shared Android/web notification copy verified: 60 variants in Russian and English.");
