import source from "../references/days.txt?raw";

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
  days: SacredDay[];
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
  icon: string;
  epithet: string;
  direction: "Восходящая луна" | "Нисходящая луна";
  phase: string;
  event: string;
  illumination: number;
};

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
  ["Весна", "#9fad78", "Α"],
  ["Весна", "#b6a86f", "Β"],
  ["Весна", "#7caa9e", "Γ"],
  ["Лето", "#d1a653", "Δ"],
  ["Лето", "#b96b4c", "Ε"],
  ["Лето", "#c69155", "Ζ"],
  ["Осень", "#9b5b52", "Η"],
  ["Осень", "#6d7284", "Θ"],
  ["Осень", "#7f765e", "Ι"],
  ["Зима", "#78969b", "Κ"],
  ["Зима", "#64828c", "Λ"],
  ["Зима", "#77758c", "Μ"],
  ["Вне времени", "#9a8264", "Ω"],
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

const DAY_MS = 86_400_000;
const MOON_CYCLE = 29.53058867;
const MOON_EPOCH = Date.UTC(2024, 0, 11, 11, 57);

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
  return new Intl.DateTimeFormat("ru-RU", {
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
  const icons = ["●", "◔", "◑", "◕", "○", "◕", "◑", "◔"];
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
    icon: icons[phaseIndex],
    epithet,
    direction,
    phase: phaseNames[phaseIndex],
    event,
    illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
  };
}

export function getSacredDay(monthIndex: number, day: number) {
  return MONTHS[monthIndex]?.days[day - 1] ?? MONTHS[12].days[0];
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

export const SOLAR_EVENTS: Record<string, string> = {
  "0-1": "Весеннее равноденствие",
  "3-4": "Летнее солнцестояние",
  "6-8": "Осеннее равноденствие",
  "9-8": "Зимнее солнцестояние",
};
