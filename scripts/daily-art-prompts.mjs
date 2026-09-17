import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("references/days.txt"), "utf8");
const lines = source.replace(/\r/g, "").split("\n");
const months = [];
let currentMonth = null;
let pyata = 0;
let pyataTitle = "";

function nextDescription(from) {
  for (let index = from + 1; index < lines.length; index += 1) {
    const value = lines[index].trim();
    if (value) return value;
  }
  return "";
}

for (const [lineIndex, rawLine] of lines.entries()) {
  const line = rawLine.trim();
  if (!line) continue;

  const standardMonth = line.match(/^МЕСЯЦ\s+([IVX]+):\s+(.+?)\s+\((.+)\)$/iu);
  const apeironMonth = line.match(/^13-Й МЕСЯЦ:\s+(.+?)\s+\((.+)\)$/iu);
  if (standardMonth || apeironMonth) {
    currentMonth = {
      index: months.length,
      name: (standardMonth?.[2] ?? apeironMonth?.[1] ?? "").trim(),
      title: (standardMonth?.[3] ?? apeironMonth?.[2] ?? "").trim(),
      description: nextDescription(lineIndex),
      days: [],
    };
    months.push(currentMonth);
    pyata = 0;
    pyataTitle = "";
    continue;
  }

  const pyataMatch = line.match(/^Пята\s+(\d+):\s+(.+?)\s+\(/iu);
  if (pyataMatch) {
    pyata = Number(pyataMatch[1]);
    pyataTitle = pyataMatch[2].trim();
    continue;
  }

  if (!currentMonth || !/^\d{2}\.\d{2}(?:\.|\s)/u.test(line)) continue;
  const content = line.replace(/^\d{2}\.\d{2}(?:\.\s*|\s*\([^)]+\)\.\s*)/u, "");
  const divider = content.indexOf("—");
  if (divider < 0) continue;
  currentMonth.days.push({
    day: currentMonth.days.length + 1,
    name: content.slice(0, divider).trim(),
    description: content.slice(divider + 1).trim(),
    pyata,
    pyataTitle,
  });
}

const entries = months.flatMap((month) => month.days.map((day) => ({
  id: `${String(month.index + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`,
  monthIndex: month.index,
  day: day.day,
  name: day.name,
  description: day.description,
  output: `public/day-art-v1/month-${String(month.index + 1).padStart(2, "0")}/day-${String(day.day).padStart(2, "0")}.webp`,
  prompt: [
    "Use case: stylized-concept",
    "Asset type: responsive daily hero background for the GENESIS sacred calendar website",
    "Input images: Image 1 is the raw artistic style and composition reference; Image 2 is the UI placement reference only",
    `Primary request: create a unique illustration for the sacred day “${day.name}”. Express its exact meaning: ${day.description}`,
    `Calendar context: month “${month.name} — ${month.title}”. ${month.description}${day.pyata ? ` Five-day phase ${day.pyata}: “${day.pyataTitle}”.` : " Day outside ordinary time in Apeiron."}`,
    "Scene/backdrop: translate the day meaning into one clear, original ancient Greek mythic tableau using the most semantically faithful deity, human figure, ritual action, natural force, animal, plant, tool, or cosmic symbol; dark temple relief carved into nearly black stone with restrained circular celestial geometry",
    "Style/medium: extremely detailed antique bronze and blackened-gold bas-relief, museum-quality sculptural realism, weathered patina, embossed carved textures, same coherent visual family as Image 1 but a distinct scene and gesture for this day",
    "Composition/framing: 16:9 cinematic landscape; reserve the entire left 42% as dark low-detail negative space for white UI text; place the main meaningful subject and action around 64–74% of canvas so they remain visible in a mobile crop centered near 66%; keep essential anatomy and symbols away from outer edges",
    "Lighting/mood: low-key warm bronze rim light, deep teal-black shadows, sacred, mysterious, dignified; let the day meaning determine whether the emotional tone is forceful, serene, joyful, mournful, cleansing, contemplative, or liminal",
    "Color palette: near-black stone, oxidized bronze, muted old gold, very subtle dark teal; only a restrained symbolic glow when required by the day meaning",
    "Materials/textures: ancient bronze statuary, engraved stone, aged patina, shallow sculptural relief",
    "Constraints: background image only; all humanlike figures are dignified and fully covered by opaque ancient robes or armor, with no nudity, eroticism, or sexualized pose; no interface, no frame, no border, no clock, no calendar, no lettering, no numbers, no logos, no watermark; no modern objects; no bright saturated colors; no photoreal live skin; no repeated generic portrait—show the specific action or transformation described by this day; landscape composition suitable for CSS background-size cover on desktop and mobile; high detail, high resolution",
  ].join("\n"),
})));

if (entries.length !== 366) {
  throw new Error(`Expected 366 sacred days, found ${entries.length}`);
}

const fromArg = process.argv.indexOf("--from");
const countArg = process.argv.indexOf("--count");
const from = fromArg >= 0 ? Number(process.argv[fromArg + 1]) : 0;
const count = countArg >= 0 ? Number(process.argv[countArg + 1]) : entries.length;
process.stdout.write(JSON.stringify(entries.slice(from, from + count)));
