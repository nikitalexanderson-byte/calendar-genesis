"use client";

import { useEffect, useSyncExternalStore } from "react";
import englishTranslations from "./translations.en.json";

export type Language = "ru" | "en";

export const LANGUAGE_STORAGE_KEY = "genesis-language-v1";
export const LANGUAGE_LOGIN_PENDING_KEY = "genesis-language-login-pending-v1";

const CYRILLIC = /[А-Яа-яЁё]/;
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt"] as const;
const ENGLISH_DESCRIPTION = "GENESIS is a task calendar and project manager with daily planning, reminders, and optional Google Calendar and Google Tasks synchronization.";
const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

const curatedTranslations: Record<string, string> = {
  "Профанский": "Profane",
  "Профанский календарь": "Profane calendar",
  "Сакральный": "Sacred",
  "Сакральный календарь": "Sacred calendar",
  "Лунный": "Lunar",
  "Лунный календарь": "Lunar calendar",
  "Круг года": "Year Wheel",
  "Пята": "Pyata",
  "Пяты": "Pyatas",
  "пята": "pyata",
  "пяты": "pyatas",
  "Апейрон": "Apeiron",
  "Стойхейон": "Stoicheion",
  "Личный кабинет": "Account",
  "Дата по сакральному календарю": "Sacred calendar date",
  "Дата по лунному календарю": "Lunar calendar date",
  "День": "Day",
  "Месяц": "Month",
  "Лунный день": "Lunar day",
  "Фаза": "Phase",
  "Луна": "Moon",
  "Русский": "Russian",
  "Английский": "English",
  "Язык": "Language",
  "Интерфейс и справочные тексты": "Interface and reference texts",
  "Основной календарь": "Primary calendar",
  "Полное отображение и система дат": "Full display and date system",
  "Выбор полностью переключает разделы «Месяц» и «Круг года», постановку задач, повторения и подписи дат. Сакральный календарь используется по умолчанию.": "Your choice fully switches the Month and Year Wheel views, task scheduling, recurrences, and date labels. The sacred calendar is used by default.",
  "Выбор полностью переключает разделы «Месяц» и «Круг года». Сакральный календарь используется по умолчанию; систему постановки задач можно выбрать отдельно для любого режима.": "Your choice fully switches the Month and Year Wheel views. The sacred calendar is the default; the task date system can be selected separately in every mode.",
  "Календарь задач": "Task calendar",
  "По какой системе выставлять даты": "Which date system to use",
  "Календарь постановки задач": "Task scheduling calendar",
  "Основной календарь не изменится; выбор дат, повторений и календарные подписи новых задач будут работать по выбранной системе.": "The primary calendar will not change; date selection, recurrences, and calendar labels for new tasks will use the selected system.",
  "Создать задачу": "Create task",
  "Новая задача на выбранный день": "New task for the selected day",
  "Дата задачи": "Task date",
  "Дата уже выбрана. При необходимости её можно изменить в форме.": "The date is already selected. You can change it in the form if needed.",
  "Закрыть создание задачи": "Close task creation",
  "Обычные даты, недели и 12 месяцев": "Standard dates, weeks, and 12 months",
  "Профанская дата": "Profane date",
  "Сакральная дата": "Sacred date",
  "Лунные сутки": "Lunar day",
  "Профанский месяц": "Profane month",
  "Календарный год": "Calendar year",
  "Лунный год": "Lunar year",
  "лунный месяц": "lunar month",
  "лунных суток": "lunar days",
  "системы дат в каждом дне": "date systems in every day",
  "солнечные точки": "solar points",
  "Новолуние открывает месяц": "The new moon opens the month",
  "Лунный год после равноденствия": "Lunar year after the equinox",
  "Генезион": "Genesion",
  "Агонион": "Agonion",
  "Эвризион": "Euresion",
  "Кинонион": "Koinonion",
  "Акмеон": "Akmeon",
  "Критион": "Krition",
  "Практион": "Praktion",
  "Софион": "Sophion",
  "Катартион": "Kathartion",
  "Мнемонион": "Mnemonion",
  "Эремион": "Eremion",
  "Телейон": "Teleion",
  "Апорион": "Aporion",
  "Месяц Рождения и Замысла": "Month of Birth and Intention",
  "Месяц Преодоления": "Month of Overcoming",
  "Месяц Открытий": "Month of Discovery",
  "Месяц Связей": "Month of Connection",
  "Месяц Вершины": "Month of the Peak",
  "Месяц Переоценки": "Month of Reassessment",
  "Месяц Усердия": "Month of Diligence",
  "Месяц Мудрости": "Month of Wisdom",
  "Месяц Очищения": "Month of Purification",
  "Месяц Памяти": "Month of Memory",
  "Месяц Тишины": "Month of Silence",
  "Месяц Завершения": "Month of Completion",
  "Вставочный месяц · Вне Времени": "Intercalary Month · Outside Time",
  "Декада Роста": "Decade of Growth",
  "Декада Полноты": "Decade of Fullness",
  "Декада Исхода": "Decade of Outflow",
  "Рубеж": "Threshold",
  "1–10 сутки": "Days 1–10",
  "11–20 сутки": "Days 11–20",
  "21 сутки — Рубеж": "Day 21 — Threshold",
  "Время формулировать цели на год. Энергия чистого потенциала: начинания ещё невидимы, но их внутренний импульс уже задан.": "A time to set intentions for the year. The energy is pure potential: beginnings are still unseen, yet their inner impulse is already present.",
  "Первые трудности на пути реализации замысла. Время приложения усилий, здоровой конкуренции и тренировки воли.": "The first difficulties on the path to realizing an intention. A time for effort, healthy competition, and training the will.",
  "Время инсайтов и первых результатов работы. Пройдя сопротивление, система обнаруживает новые решения и возможности.": "A time of insight and the first results of work. Having passed through resistance, the system discovers new solutions and possibilities.",
  "Время социальной активности, укрепления отношений, переговоров и союзов. Фокус естественно смещается с «Я» на «Мы».": "A time for social activity, stronger relationships, negotiation, and alliances. The focus naturally moves from “I” to “We”.",
  "Точка максимальной продуктивности и раскрытия потенциала. Время воплощать намерение и принимать плоды собственных действий.": "The point of greatest productivity and fulfilled potential. A time to embody intention and receive the fruits of one's actions.",
  "Экватор года и время трезвого взгляда на достигнутое: распознать ошибки, сохранить существенное и отсечь лишнее.": "The midpoint of the year and a clear-eyed review of what has been achieved: recognize mistakes, preserve what matters, and cut away the excess.",
  "После переоценки приходит время упорной, рутинной, но осмысленной работы и внедрения новых правил в повседневность.": "After reassessment comes persistent, routine, but meaningful work and the integration of new rules into daily life.",
  "Время передачи опыта, обучения и философского размышления. Накопленное знание становится действующей силой.": "A time for sharing experience, learning, and philosophical reflection. Accumulated knowledge becomes an active force.",
  "Подготовка к завершению цикла: освобождение от долгов, старых обид и ненужных вещей, духовная и физическая уборка.": "Preparation for the cycle's completion: release debts, old grievances, and unnecessary possessions through spiritual and physical cleansing.",
  "Обращение к прошлому. Время вспоминать предков и наставников, благодарить их и подводить исторические итоги года.": "A return to the past. A time to remember ancestors and mentors, thank them, and draw the year's historical conclusions.",
  "Время уединения, медитации и глубокого внутреннего покоя, когда внешняя активность уступает место вниманию к себе.": "A time of solitude, meditation, and deep inner stillness, when outward activity gives way to inward attention.",
  "Окончательная точка цикла: завершение начатого, подведение итогов и освобождение пространства перед новым рождением.": "The final point of the cycle: complete what was begun, take stock, and clear space before a new birth.",
  "Сакральная пауза перед новым циклом. Период неопределённости и творческого хаоса, когда старые правила уже не действуют, а новые ещё не проявились.": "A sacred pause before the next cycle. A period of uncertainty and creative chaos, when old rules no longer work and new ones have not yet appeared.",
  "В системе GENESIS это магический «женский» год: его внутренняя ткань определяется не месяцами и неделями солнечного года, а ростом, полнотой и исходом Луны. Весеннее равноденствие служит только ежегодной точкой настройки; условия для практик рождаются внутри самих лунных месяцев и потому не привязаны к профанскому делению года.": "In GENESIS this is a magical ‘feminine’ year: its inner fabric is defined not by the months and weeks of the solar year, but by the Moon's growth, fullness, and outflow. The spring equinox serves only as an annual anchor; conditions for practices arise within the lunar months themselves and are not tied to the profane division of the year.",
  "Это современная символическая система GENESIS, а не реконструкция единого древнегреческого календаря. Её античная опора — образ Селены как небесного знака для людей и полнота Луны в середине месяца в Гомеровом гимне; греческие лунно-солнечные календари действительно удерживали месяцы рядом с сезонами при помощи вставочного месяца.": "This is a modern symbolic GENESIS system, not a reconstruction of one universal ancient Greek calendar. Its ancient grounding is Selene as a heavenly sign for mortals and the Moon's mid-month fullness in the Homeric Hymn; Greek lunisolar calendars did keep lunar months aligned with the seasons by intercalating a month.",
  "Обычный год, полный контекст": "Standard year, complete context",
  "Обычный календарный месяц с неделями с понедельника по воскресенье. В каждом дне дополнительно показаны сакральная дата, лунные сутки, рассвет и закат.": "A standard calendar month with weeks from Monday through Sunday. Each day also shows its sacred date, lunar day, sunrise, and sunset.",
  "Лунный месяц начинается новолунием. Основной ритм образуют лунные сутки; рядом остаются видимыми профанская и сакральная даты. Лунный год начинается с первого новолуния после весеннего равноденствия.": "A lunar month begins at the new moon. Lunar days form its primary rhythm, while profane and sacred dates remain visible. The lunar year begins with the first new moon after the spring equinox.",
  "Двенадцать обычных календарных месяцев с января по декабрь. Откройте любой день, чтобы увидеть его сакральный смысл, лунные сутки, рассвет, закат и задачи.": "Twelve standard calendar months from January through December. Open any day to see its sacred meaning, lunar day, sunrise, sunset, and tasks.",
  "Клик по дню открывает задачи, сакральное значение, фазу Луны, точное время рассвета и заката для региона устройства.": "Select a day to open its tasks, sacred meaning, Moon phase, and regional sunrise and sunset times.",
};

const translations: Record<string, string> = {
  ...(englishTranslations as Record<string, string>),
  ...curatedTranslations,
};

const partialTranslations = Object.entries(translations)
  .filter(([source, translated]) => source.length >= 4 && source.length <= 180 && source !== translated)
  .sort(([left], [right]) => right.length - left.length);

let runtimeLanguage: Language = "ru";
const subscribeHydration = () => () => undefined;

type RenderRecord = { source: string; rendered: string };
const textRecords = new WeakMap<Text, RenderRecord>();
const attributeRecords = new WeakMap<Element, Map<string, RenderRecord>>();

function normalizedText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function preserveOuterWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

export function normalizeLanguage(value: unknown): Language {
  return value === "en" ? "en" : "ru";
}

export function browserLanguage(): Language {
  if (typeof window === "undefined") return "ru";
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "ru" || requested === "en") return requested;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "ru" || stored === "en") return stored;
  return window.navigator.languages.some((locale) => locale.toLocaleLowerCase().startsWith("ru")) ? "ru" : "en";
}

export function storeLanguage(language: Language) {
  if (typeof window !== "undefined") window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function setRuntimeLanguage(language: Language) {
  runtimeLanguage = language;
}

export function getRuntimeLanguage() {
  return runtimeLanguage;
}

export function runtimeLocale() {
  return runtimeLanguage === "en" ? "en-US" : "ru-RU";
}

export function translateText(source: string, language: Language = runtimeLanguage, allowPartial = false) {
  if (language === "ru") return source;
  if (!CYRILLIC.test(source)) return source;
  const normalized = normalizedText(source);
  const exact = translations[normalized];
  if (exact) return preserveOuterWhitespace(source, exact);
  if (!allowPartial) return source;

  let translated = normalized;
  let changed = false;
  for (const [fragment, replacement] of partialTranslations) {
    if (!translated.includes(fragment)) continue;
    translated = translated.replaceAll(fragment, replacement);
    changed = true;
  }
  // A partial match must never leave a half-translated Russian phrase behind.
  // This is especially important for sacred-day names: until a complete entry
  // exists in the catalogue, keep the original wording intact.
  return changed && !CYRILLIC.test(translated) ? preserveOuterWhitespace(source, translated) : source;
}

function localizeTextNode(node: Text, language: Language) {
  const current = node.data;
  let record = textRecords.get(node);
  if (!record || current !== record.rendered) {
    record = { source: current, rendered: current };
    textRecords.set(node, record);
  }
  const rendered = translateText(record.source, language, true);
  record.rendered = rendered;
  if (node.data !== rendered) node.data = rendered;
}

function localizeAttribute(element: Element, attribute: string, language: Language) {
  const current = element.getAttribute(attribute);
  if (current === null) return;
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }
  let record = records.get(attribute);
  if (!record || current !== record.rendered) {
    record = { source: current, rendered: current };
    records.set(attribute, record);
  }
  const rendered = translateText(record.source, language, true);
  record.rendered = rendered;
  if (current !== rendered) element.setAttribute(attribute, rendered);
}

function localizeTree(root: Node, language: Language) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text, language);
    return;
  }
  if (!(root instanceof Element)) return;
  if (root.matches("script, style, [data-no-translate]")) return;
  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => localizeAttribute(root, attribute, language));
  for (const child of root.childNodes) localizeTree(child, language);
}

export function useDocumentLanguage(language: Language) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  setRuntimeLanguage(hydrated ? language : "ru");

  useEffect(() => {
    runtimeLanguage = language;
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    localizeTree(document.body, language);
    const headTimer = window.setTimeout(() => {
      document.title = language === "en" ? "GENESIS — Task Calendar and Project Manager" : "GENESIS — календарь задач и менеджер проектов";
      const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (description) {
        description.content = language === "en"
          ? ENGLISH_DESCRIPTION
          : "GENESIS — календарь задач и менеджер проектов с планом дня, напоминаниями и необязательной синхронизацией Google Calendar и Google Tasks.";
      }
      const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifest) manifest.href = `${APP_BASE}/${language === "en" ? "manifest.en.webmanifest" : "manifest.webmanifest"}`;
    }, 100);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target as Text, language);
        } else if (mutation.type === "attributes") {
          localizeAttribute(mutation.target as Element, mutation.attributeName ?? "", language);
        } else {
          mutation.addedNodes.forEach((node) => localizeTree(node, language));
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    return () => {
      window.clearTimeout(headTimer);
      observer.disconnect();
    };
  }, [language]);
}
