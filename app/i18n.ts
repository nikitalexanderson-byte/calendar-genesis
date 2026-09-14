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
