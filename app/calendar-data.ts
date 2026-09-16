import source from "../references/days.txt?raw";
import { MoonPhase, SearchMoonPhase, Seasons } from "astronomy-engine";
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

export type LunarYearInfo = {
  sacredYear: number;
  startMonthIndex: number;
  endMonthIndex: number;
  monthCount: number;
  startDate: Date;
  endDate: Date;
};

export type LunarMonthDefinition = {
  index: number;
  roman: string;
  name: string;
  title: string;
  description: string;
};

export type LunarDecade = {
  id: "growth" | "fullness" | "outflow";
  name: string;
  range: string;
};

export type LunarDateInfo = {
  year: LunarYearInfo;
  monthIndex: number;
  monthOrdinal: number;
  month: LunarMonthDefinition;
  day: number;
  monthLength: number;
  decade: LunarDecade;
  isThreshold: boolean;
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

export const LUNAR_MONTHS: readonly LunarMonthDefinition[] = [
  { index: 0, roman: "I", name: "Генезион", title: "Месяц Рождения и Замысла", description: "Время формулировать цели на год. Энергия чистого потенциала: начинания ещё невидимы, но их внутренний импульс уже задан." },
  { index: 1, roman: "II", name: "Агонион", title: "Месяц Преодоления", description: "Первые трудности на пути реализации замысла. Время приложения усилий, здоровой конкуренции и тренировки воли." },
  { index: 2, roman: "III", name: "Эвризион", title: "Месяц Открытий", description: "Время инсайтов и первых результатов работы. Пройдя сопротивление, система обнаруживает новые решения и возможности." },
  { index: 3, roman: "IV", name: "Кинонион", title: "Месяц Связей", description: "Время социальной активности, укрепления отношений, переговоров и союзов. Фокус естественно смещается с «Я» на «Мы»." },
  { index: 4, roman: "V", name: "Акмеон", title: "Месяц Вершины", description: "Точка максимальной продуктивности и раскрытия потенциала. Время воплощать намерение и принимать плоды собственных действий." },
  { index: 5, roman: "VI", name: "Критион", title: "Месяц Переоценки", description: "Экватор года и время трезвого взгляда на достигнутое: распознать ошибки, сохранить существенное и отсечь лишнее." },
  { index: 6, roman: "VII", name: "Практион", title: "Месяц Усердия", description: "После переоценки приходит время упорной, рутинной, но осмысленной работы и внедрения новых правил в повседневность." },
  { index: 7, roman: "VIII", name: "Софион", title: "Месяц Мудрости", description: "Время передачи опыта, обучения и философского размышления. Накопленное знание становится действующей силой." },
  { index: 8, roman: "IX", name: "Катартион", title: "Месяц Очищения", description: "Подготовка к завершению цикла: освобождение от долгов, старых обид и ненужных вещей, духовная и физическая уборка." },
  { index: 9, roman: "X", name: "Мнемонион", title: "Месяц Памяти", description: "Обращение к прошлому. Время вспоминать предков и наставников, благодарить их и подводить исторические итоги года." },
  { index: 10, roman: "XI", name: "Эремион", title: "Месяц Тишины", description: "Время уединения, медитации и глубокого внутреннего покоя, когда внешняя активность уступает место вниманию к себе." },
  { index: 11, roman: "XII", name: "Телейон", title: "Месяц Завершения", description: "Окончательная точка цикла: завершение начатого, подведение итогов и освобождение пространства перед новым рождением." },
  { index: 12, roman: "XIII", name: "Апорион", title: "Вставочный месяц · Вне Времени", description: "Сакральная пауза перед новым циклом. Период неопределённости и творческого хаоса, когда старые правила уже не действуют, а новые ещё не проявились." },
] as const;

export const LUNAR_DECADES: readonly LunarDecade[] = [
  { id: "growth", name: "Декада Роста", range: "1–10 сутки" },
  { id: "fullness", name: "Декада Полноты", range: "11–20 сутки" },
  { id: "outflow", name: "Декада Исхода", range: "21 сутки — Рубеж" },
] as const;

const ENGLISH_DAYS = englishDays as readonly Pick<SacredDay, "name" | "description">[];

export const DAY_MS = 86_400_000;
export const MOON_CYCLE = 29.53058867;
export const MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

const newMoonCache = new Map<number, Date>();
const lunarYearCache = new Map<number, LunarYearInfo>();

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
  const phaseAngle = MoonPhase(date);
  const fraction = phaseAngle / 360;
  const index = lunarMonthIndex(date);
  const monthStart = getLunarMonthStart(index);
  const age = Math.max(0, Math.round((utcDay(date) - utcDay(monthStart)) / DAY_MS));
  const day = age + 1;
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
  const isNewMoon = day === 1;
  const isFullMoon = Math.abs(phaseAngle - 180) <= 18;
  const isWaxing = phaseAngle < 180;
  const epithet = isNewMoon ? "Геката" : isWaxing ? "Артемида" : "Геката";
  const direction = isWaxing && !isNewMoon ? "Восходящая луна" : "Нисходящая луна";
  const event = isNewMoon
    ? "Торжество Гекаты · новолуние"
    : isFullMoon
      ? "Торжество Артемиды · полнолуние"
      : "";

  return {
    age,
    day,
    phaseStep: Math.round(fraction * 30) % 30,
    epithet,
    direction,
    phase: phaseNames[phaseIndex],
    event,
    illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
  };
}

export function lunarMonthIndex(date: Date) {
  const target = utcDay(date);
  let index = Math.floor((date.getTime() - MOON_EPOCH) / (MOON_CYCLE * DAY_MS));
  while (target < utcDay(getLunarMonthStart(index))) index -= 1;
  while (target >= utcDay(getLunarMonthStart(index + 1))) index += 1;
  return index;
}

export function getLunarMonthDates(index: number) {
  const start = getLunarMonthStart(index);
  const end = getLunarMonthStart(index + 1);
  const length = Math.round((utcDay(end) - utcDay(start)) / DAY_MS);
  return Array.from({ length }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return date;
  });
}

export function getLunarMonthStart(index: number) {
  const moment = getNewMoonMoment(index);
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate(), 12);
}

function firstLunarMonthAfterSpringEquinox(sacredYear: number) {
  const springEquinox = Seasons(sacredYear).mar_equinox.date;
  const firstNewMoon = SearchMoonPhase(0, springEquinox, 40);
  if (!firstNewMoon) throw new Error(`Не удалось вычислить первое новолуние ${sacredYear} года.`);
  return Math.round((firstNewMoon.date.getTime() - MOON_EPOCH) / (MOON_CYCLE * DAY_MS));
}

function getNewMoonMoment(index: number) {
  const cached = newMoonCache.get(index);
  if (cached) return new Date(cached);
  const approximate = new Date(MOON_EPOCH + index * MOON_CYCLE * DAY_MS);
  const searchStart = new Date(approximate.getTime() - 2.5 * DAY_MS);
  const found = SearchMoonPhase(0, searchStart, 5);
  if (!found) throw new Error(`Не удалось вычислить новолуние ${index}.`);
  const moment = new Date(found.date);
  newMoonCache.set(index, moment);
  return new Date(moment);
}

export function getLunarYear(sacredYear: number): LunarYearInfo {
  const cached = lunarYearCache.get(sacredYear);
  if (cached) return cached;
  const startMonthIndex = firstLunarMonthAfterSpringEquinox(sacredYear);
  const endMonthIndex = firstLunarMonthAfterSpringEquinox(sacredYear + 1);
  const year = {
    sacredYear,
    startMonthIndex,
    endMonthIndex,
    monthCount: endMonthIndex - startMonthIndex,
    startDate: getLunarMonthStart(startMonthIndex),
    endDate: getLunarMonthStart(endMonthIndex),
  };
  lunarYearCache.set(sacredYear, year);
  return year;
}

export function getLunarYearForDate(date: Date) {
  const sacredYear = getSacredDate(date).sacredYear;
  const candidate = getLunarYear(sacredYear);
  return utcDay(date) >= utcDay(candidate.startDate) ? candidate : getLunarYear(sacredYear - 1);
}

export function getLunarMonthDefinition(monthOrdinal: number) {
  return LUNAR_MONTHS[Math.min(Math.max(monthOrdinal - 1, 0), LUNAR_MONTHS.length - 1)];
}

export function getLunarDecade(day: number) {
  if (day <= 10) return LUNAR_DECADES[0];
  if (day <= 20) return LUNAR_DECADES[1];
  return LUNAR_DECADES[2];
}

export function getLunarDate(date: Date): LunarDateInfo {
  const year = getLunarYearForDate(date);
  const monthIndex = lunarMonthIndex(date);
  const monthOrdinal = monthIndex - year.startMonthIndex + 1;
  const monthLength = getLunarMonthDates(monthIndex).length;
  const day = Math.round((utcDay(date) - utcDay(getLunarMonthStart(monthIndex))) / DAY_MS) + 1;
  return {
    year,
    monthIndex,
    monthOrdinal,
    month: getLunarMonthDefinition(monthOrdinal),
    day,
    monthLength,
    decade: getLunarDecade(day),
    isThreshold: day === monthLength,
  };
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
  const lunar = getLunarDate(date);
  return translateText(long
    ? `${lunar.month.name} · ${lunar.day} лунный день · ${lunar.isThreshold ? "Рубеж" : lunar.decade.name} · ${moon.phase}`
    : `${lunar.day} · ${lunar.month.name}`, undefined, true);
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
