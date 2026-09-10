import source from "../references/days.txt?raw";
import englishDays from "./calendar-days.en.json";
import { runtimeLocale, translateText } from "./i18n";

export type SacredDay = {
  id: string;
  monthIndex: number;
  day: number;
  name: string;
  description: string;
  pyata: number;
  pyataTitle: string;
};

export type SacredMonth = {
  index: number;
  roman: string;
  name: string;
  title: string;
  description: string;
  season: string;
  color: string;
  symbol: string;
  artPosition: string;
  days: SacredDay[];
};

export type SolarEvent = {
  id: "spring-equinox" | "summer-solstice" | "autumn-equinox" | "winter-solstice";
  name: string;
  shortName: string;
  kind: "equinox" | "solstice";
  symbol: string;
  date: Date;
  monthIndex: number;
  day: number;
};

export type SacredDateInfo = {
  sacredYear: number;
  monthIndex: number;
  day: number;
  dayOfYear: number;
  daysInYear: number;
  apeironDays: number;
};

export type MoonInfo = {
  age: number;
  day: number;
  phaseStep: number;
  epithet: string;
  direction: "Восходящая луна" | "Нисходящая луна";
  phase: string;
  event: string;
  illumination: number;
};

export type CalendarMode = "profane" | "sacred" | "lunar";

export const ELEMENTS = [
  { name: "Земля", meaning: "Опора · Тело", symbol: "🜃" },
  { name: "Вода", meaning: "Эмоции · Поток", symbol: "🜄" },
  { name: "Воздух", meaning: "Интеллект · Связь", symbol: "🜁" },
  { name: "Огонь", meaning: "Воля · Действие", symbol: "🜂" },
  { name: "Эфир", meaning: "Дух · Синтез", symbol: "✦" },
] as const;

export const PYTHAGOREAN = [
  { name: "Монада", meaning: "Удержание · Стабильность", roman: "I" },
  { name: "Диада", meaning: "Разделение · Текучесть · Выбор пути", roman: "II" },
  { name: "Триада", meaning: "Одухотворение · Связь верха и низа", roman: "III" },
  { name: "Тетрада", meaning: "Справедливость · Полнота", roman: "IIII" },
  { name: "Пентада", meaning: "Всецелостность · Синтез", roman: "V" },
] as const;

export const PYATA_MEANINGS = [
  "Посев · Установка цели",
  "Прорастание · Первые шаги",
  "Кульминация · Максимальное усилие",
  "Испытание · Встреча с сопротивлением",
  "Плоды · Получение результата",
  "Переход · Подготовка нового цикла",
] as const;

const MONTH_STYLE = [
  ["Весна", "#6f9b68", "Α", "0%"],
  ["Весна", "#98a85d", "Β", "8.333%"],
  ["Весна", "#2f8f8a", "Γ", "16.666%"],
  ["Лето", "#dfa33d", "Δ", "25%"],
  ["Лето", "#c55235", "Ε", "33.333%"],
  ["Лето", "#b98535", "Ζ", "41.666%"],
  ["Осень", "#8f3f49", "Η", "50%"],
  ["Осень", "#6d5b8e", "Θ", "58.333%"],
  ["Осень", "#a34b33", "Ι", "66.666%"],
  ["Зима", "#4d7f91", "Κ", "75%"],
  ["Зима", "#718bb4", "Λ", "83.333%"],
  ["Зима", "#343f73", "Μ", "91.666%"],
  ["Вне времени", "#1f4a49", "Ω", "100%"],
] as const;

function parseCalendar(text: string): SacredMonth[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const months: SacredMonth[] = [];
  let current: SacredMonth | null = null;
  let pyata = 0;
  let pyataTitle = "";

  const nextDescription = (from: number) => {
    for (let i = from + 1; i < lines.length; i += 1) {
      const value = lines[i].trim();
      if (value) return value;
    }
    return "";
  };

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;

    const standardMonth = line.match(
      /^МЕСЯЦ\s+([IVX]+):\s+(.+?)\s+\((.+)\)$/i,
    );
    const apeironMonth = line.match(/^13-Й МЕСЯЦ:\s+(.+?)\s+\((.+)\)$/i);

    if (standardMonth || apeironMonth) {
      const index = months.length;
      const style = MONTH_STYLE[index] ?? MONTH_STYLE[12];
      current = {
        index,
        roman: standardMonth?.[1] ?? "XIII",
        name: (standardMonth?.[2] ?? apeironMonth?.[1] ?? "").trim(),
        title: (standardMonth?.[3] ?? apeironMonth?.[2] ?? "").trim(),
        description: nextDescription(lineIndex),
        season: style[0],
        color: style[1],
        symbol: style[2],
        artPosition: style[3],
        days: [],
      };
      months.push(current);
      pyata = 0;
      pyataTitle = "";
      return;
    }

    const pyataMatch = line.match(/^Пята\s+(\d+):\s+(.+?)\s+\(/i);
    if (pyataMatch) {
      pyata = Number(pyataMatch[1]);
      pyataTitle = pyataMatch[2].trim();
      return;
    }

    if (!current || !/^\d{2}\.\d{2}(?:\.|\s)/.test(line)) return;

    const content = line.replace(
      /^\d{2}\.\d{2}(?:\.\s*|\s*\([^)]+\)\.\s*)/,
      "",
    );
    const divider = content.indexOf("—");
    if (divider < 0) return;

    const day = current.days.length + 1;
    current.days.push({
      id: `${current.index}-${day}`,
      monthIndex: current.index,
      day,
      name: content.slice(0, divider).trim(),
      description: content.slice(divider + 1).trim(),
      pyata,
      pyataTitle,
    });
  });

  if (months.length !== 13 || months.reduce((sum, month) => sum + month.days.length, 0) !== 366) {
    throw new Error("Sacred calendar source is incomplete");
  }

  return months;
}

export const MONTHS = parseCalendar(source);

const ENGLISH_DAYS = englishDays as readonly Pick<SacredDay, "name" | "description">[];

export const DAY_MS = 86_400_000;
export const MOON_CYCLE = 29.53058867;
export const MOON_EPOCH = Date.UTC(2024, 0, 11, 11, 57);

function utcDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getSacredYearStart(date: Date) {
  const year = date.getFullYear();
  const thisYearStart = new Date(year, 2, 20);
  return date >= thisYearStart ? thisYearStart : new Date(year - 1, 2, 20);
}

export function getSacredDate(date: Date): SacredDateInfo {
  const start = getSacredYearStart(date);
  const nextStart = new Date(start.getFullYear() + 1, 2, 20);
  const dayOfYear = Math.round((utcDay(date) - utcDay(start)) / DAY_MS);
  const daysInYear = Math.round((utcDay(nextStart) - utcDay(start)) / DAY_MS);
  const monthIndex = dayOfYear < 360 ? Math.floor(dayOfYear / 30) : 12;
  const day = dayOfYear < 360 ? (dayOfYear % 30) + 1 : dayOfYear - 359;

  return {
    sacredYear: start.getFullYear(),
    monthIndex,
    day,
    dayOfYear,
    daysInYear,
    apeironDays: daysInYear - 360,
  };
}

export function getGregorianDate(sacredYear: number, monthIndex: number, day: number) {
  const date = new Date(sacredYear, 2, 20);
  date.setDate(date.getDate() + (monthIndex < 12 ? monthIndex * 30 + day - 1 : 360 + day - 1));
  return date;
}

export function formatGregorian(date: Date, long = false) {
  return new Intl.DateTimeFormat(runtimeLocale(), {
    day: "numeric",
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    weekday: long ? "long" : "short",
  }).format(date);
}

export function getMoon(date: Date): MoonInfo {
  const elapsed = (date.getTime() - MOON_EPOCH) / DAY_MS;
  const age = ((elapsed % MOON_CYCLE) + MOON_CYCLE) % MOON_CYCLE;
  const fraction = age / MOON_CYCLE;
  const phaseIndex = Math.round(fraction * 8) % 8;
  const phaseNames = [
    "Новолуние",
    "Молодой серп",
    "Первая четверть",
    "Растущая луна",
    "Полнолуние",
    "Убывающая луна",
    "Последняя четверть",
    "Старый серп",
  ];
  const halfCycle = MOON_CYCLE / 2;
  const isNewMoon = age < 1.5 || age > MOON_CYCLE - 1.5;
  const isFullMoon = Math.abs(age - halfCycle) <= 1.5;
  const isWaxing = age < halfCycle;
  const epithet = isNewMoon ? "Геката" : isWaxing ? "Артемида" : "Геката";
  const direction = isWaxing && !isNewMoon ? "Восходящая луна" : "Нисходящая луна";
  const event = isNewMoon
    ? "Торжество Гекаты · новолуние"
    : isFullMoon
      ? "Торжество Артемиды · полнолуние"
      : "";

  return {
    age,
    day: Math.floor(age) + 1,
    phaseStep: Math.round(fraction * 30) % 30,
    epithet,
    direction,
    phase: phaseNames[phaseIndex],
    event,
    illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
  };
}

export function lunarMonthIndex(date: Date) {
  return Math.floor((date.getTime() - MOON_EPOCH) / (MOON_CYCLE * DAY_MS));
}

export function getLunarMonthDates(index: number) {
  const approximateStart = new Date(MOON_EPOCH + index * MOON_CYCLE * DAY_MS);
  const cursor = new Date(approximateStart.getFullYear(), approximateStart.getMonth(), approximateStart.getDate() - 2, 12);
  const dates: Date[] = [];
  for (let offset = 0; offset < 35; offset += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + offset);
    if (lunarMonthIndex(date) === index) dates.push(date);
  }
  return dates;
}

export function formatSacredDate(date: Date, long = false) {
  const sacred = getSacredDate(date);
  const month = MONTHS[sacred.monthIndex];
  const day = getSacredDay(sacred.monthIndex, sacred.day);
  if (!long) return `${sacred.day} · ${translateText(month.name)}`;
  return translateText(`${day.name} · ${sacred.day} день · Пята ${day.pyata || "Ω"} · ${month.name} ${sacred.sacredYear}`, undefined, true);
}

export function formatLunarDate(date: Date, long = false) {
  const moon = getMoon(date);
  return translateText(long
    ? `${moon.day} лунный день · ${moon.phase} · ${moon.epithet}`
    : `${moon.day} лунный день · ${moon.phase}`, undefined, true);
}

export function formatCalendarDate(date: Date, mode: CalendarMode, long = false) {
  if (mode === "sacred") return formatSacredDate(date, long);
  if (mode === "lunar") return formatLunarDate(date, long);
  return formatGregorian(date, long);
}

export function normalizeCalendarDateNote(note: string, mode: CalendarMode) {
  const normalized = note.trim();
  if (!normalized || mode === "profane" || /^Профан(?:ская|ическая) дата:/iu.test(normalized)) return "";

  const heading = translateText(mode === "sacred"
    ? "Дата по сакральному календарю"
    : "Дата по лунному календарю");
  const localized = translateText(normalized, undefined, true);
  const acceptedHeadings = mode === "sacred"
    ? ["Дата по сакральному календарю", "Sacred calendar date"]
    : ["Дата по лунному календарю", "Lunar calendar date"];
  return acceptedHeadings.some((value) => localized.startsWith(`${value}:`))
    ? localized
    : `${heading}:\n${localized}`;
}

export function calendarDateNote(date: Date, mode: CalendarMode) {
  if (mode === "sacred") {
    const sacred = getSacredDate(date);
    const month = MONTHS[sacred.monthIndex];
    const day = getSacredDay(sacred.monthIndex, sacred.day);
    return normalizeCalendarDateNote([
      `День: ${day.name} (${sacred.day})`,
      `Пята: ${day.pyata || "Ω"}${day.pyataTitle ? ` — ${day.pyataTitle}` : ""}`,
      `Месяц: ${month.name} — ${month.title}`,
    ].join("\n"), mode);
  }
  if (mode === "lunar") {
    const moon = getMoon(date);
    return normalizeCalendarDateNote([
      `Лунный день: ${moon.day}`,
      `Фаза: ${moon.phase}`,
      `Луна: ${moon.epithet} · ${moon.direction}`,
    ].join("\n"), mode);
  }
  return "";
}

export function getSacredDay(monthIndex: number, day: number) {
  const sacredDay = MONTHS[monthIndex]?.days[day - 1] ?? MONTHS[12].days[0];
  if (runtimeLocale() !== "en-US") return sacredDay;
  const index = monthIndex < 12 ? (monthIndex * 30) + day - 1 : 360 + day - 1;
  const englishDay = ENGLISH_DAYS[index];
  return englishDay ? { ...sacredDay, ...englishDay } : sacredDay;
}

export function getDayElement(monthIndex: number, day: number) {
  return monthIndex === 12 ? ELEMENTS[4] : ELEMENTS[(day - 1) % 5];
}

export function getPythagorean(monthIndex: number, day: number) {
  return monthIndex === 12 ? null : PYTHAGOREAN[(day - 1) % 5];
}

export function dateKey(monthIndex: number, day: number) {
  return `${monthIndex}-${day}`;
}

const SOLAR_DEFINITIONS = [
  { id: "spring-equinox", name: "Весеннее равноденствие", shortName: "Равноденствие", kind: "equinox", symbol: "☼", coefficient: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057] },
  { id: "summer-solstice", name: "Летнее солнцестояние", shortName: "Солнцестояние", kind: "solstice", symbol: "✺", coefficient: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030] },
  { id: "autumn-equinox", name: "Осеннее равноденствие", shortName: "Равноденствие", kind: "equinox", symbol: "☉", coefficient: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078] },
  { id: "winter-solstice", name: "Зимнее солнцестояние", shortName: "Солнцестояние", kind: "solstice", symbol: "✹", coefficient: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032] },
] as const;

function solarDate(year: number, coefficient: readonly number[]) {
  const t = (year - 2000) / 1000;
  const julianDay = coefficient.reduce((sum, value, power) => sum + value * (t ** power), 0);
  return new Date((julianDay - 2440587.5) * DAY_MS);
}

export function getSolarEvents(sacredYear: number): SolarEvent[] {
  return SOLAR_DEFINITIONS.map((definition) => {
    const date = solarDate(sacredYear, definition.coefficient);
    const sacred = getSacredDate(date);
    return {
      id: definition.id,
      name: definition.name,
      shortName: definition.shortName,
      kind: definition.kind,
      symbol: definition.symbol,
      date,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
    };
  });
}

export function getSolarEvent(sacredYear: number, monthIndex: number, day: number) {
  return getSolarEvents(sacredYear).find((event) => event.monthIndex === monthIndex && event.day === day) ?? null;
}
