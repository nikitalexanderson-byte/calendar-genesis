import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(ROOT, "app");
const CYRILLIC = /[А-Яа-яЁё]/u;
const SKIPPED_FILES = new Set([
  "i18n.ts",
  "local-voice-plan.ts",
  "task-reminders.ts",
  "stoicheion-data.ts",
  "stoicheion-data.en.ts",
  "theokyklos-data.ts",
  "habits.ts",
  "habit-templates.ts",
  "mood-tracker.ts",
  "sleep-tracker.ts",
  "addiction-tracker.ts",
]);

function normalize(value) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    if (!/\.tsx?$/u.test(entry.name) || SKIPPED_FILES.has(entry.name) || entry.name.includes(".en.")) return [];
    return [absolute];
  }));
  return nested.flat();
}

function readCuratedTranslations(sourceText) {
  const source = ts.createSourceFile("i18n.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const entries = {};
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "curatedTranslations" && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name) || !ts.isStringLiteralLike(property.initializer)) continue;
        entries[property.name.text] = property.initializer.text;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return entries;
}

const [catalogText, i18nText] = await Promise.all([
  readFile(path.join(APP_DIR, "translations.en.json"), "utf8"),
  readFile(path.join(APP_DIR, "i18n.ts"), "utf8"),
]);
const translations = {
  ...JSON.parse(catalogText),
  ...readCuratedTranslations(i18nText),
};
const partialTranslations = Object.entries(translations)
  .filter(([source, translated]) => source.length >= 4 && source.length <= 180 && source !== translated)
  .sort(([left], [right]) => right.length - left.length);

function isCovered(source) {
  const normalized = normalize(source);
  if (!CYRILLIC.test(normalized)) return true;
  if (translations[normalized] && !CYRILLIC.test(translations[normalized])) return true;
  let translated = normalized;
  for (const [fragment, replacement] of partialTranslations) {
    if (translated.includes(fragment)) translated = translated.replaceAll(fragment, replacement);
  }
  return !CYRILLIC.test(translated);
}

function isNonUiString(node) {
  const parent = node.parent;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  return false;
}

function hasExplicitEnglishAlternative(node, source) {
  let current = node.parent;
  while (current) {
    if (ts.isConditionalExpression(current)) {
      const condition = current.condition.getText(source);
      if (/^(?:isEnglish|english)$/u.test(condition.trim())
        || /(?:\b(?:language|locale)\b|context\.language|getRuntimeLanguage\(\)|runtimeLocale\(\))[\s\S]{0,30}(?:===|startsWith\()[\s\S]{0,10}["']en/u.test(condition)) return true;
    }
    current = current.parent;
  }
  return false;
}

const missing = new Map();
for (const file of await sourceFiles(APP_DIR)) {
  const sourceText = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const record = (value, node) => {
    const normalized = normalize(value);
    if (!normalized || !CYRILLIC.test(normalized) || isCovered(normalized) || hasExplicitEnglishAlternative(node, source)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    const key = `${path.relative(ROOT, file)}:${line + 1}`;
    missing.set(`${key}\0${normalized}`, { location: key, value: normalized });
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) record(node.getText(source), node);
    if (ts.isStringLiteralLike(node) && !isNonUiString(node)) record(node.text, node);
    if (ts.isTemplateExpression(node)) {
      record(node.head.text, node.head);
      for (const span of node.templateSpans) record(span.literal.text, span.literal);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (missing.size) {
  console.error(`Untranslated Russian UI fragments: ${missing.size}`);
  for (const item of missing.values()) console.error(`${item.location}\t${item.value}`);
  process.exitCode = 1;
} else {
  console.log("English UI translation audit passed: no uncovered Russian fragments.");
}
