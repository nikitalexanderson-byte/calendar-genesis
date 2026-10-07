"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  getStoicheionLetters,
  type StoicheionLetter,
} from "./stoicheion-data";
import { getStoicheionCardArt } from "./stoicheion-card-art";
import { catalogText, sacredWordCopy, stoicheionArtCopy } from "./catalog-i18n";
import {
  isGoogleSyncConfigured,
  loadStoicheionDraws,
  saveStoicheionDraw,
  type StoicheionDrawKind,
  type StoicheionDrawRecord,
} from "./cloud-sync";
import { getRuntimeLanguage, runtimeLocale } from "./i18n";
import { THEOKYKLOS_SEGMENTS } from "./theokyklos-data";
import {
  sacredPracticesForSector,
  sacredSectorGuidance,
  type StoicheionPracticeSectorId,
} from "./sacred-practices";
import { useDialogAccessibility } from "./use-dialog-accessibility";

const LOCAL_DRAW_STORAGE_PREFIX = "genesis-stoicheion-draws-v2:";
const STOICHEION_CARD_ART_VERSION = "20260906-anatomy-glow";
const INITIAL_ENTROPY = 0x9e3779b9;
const CARD_LABEL = { ru: "Карта", en: "Card", el: "Κάρτα", de: "Karte", fr: "Carte",
  es: "Carta", it: "Carta", pt: "Carta", pl: "Karta", sr: "Карта", uk: "Картка",
  zh: "卡牌", tr: "Kart", ja: "カード" } as const;

type ClientDrawRecord = StoicheionDrawRecord & { localDeadline: number };

type MotionMode = "daily" | "spread";

type MotionTracker = {
  mode: MotionMode;
  seed: number;
  travel: number;
  lastX: number | null;
  lastY: number | null;
  replaceCurrent: boolean;
};

type SelectedReading = {
  letter: StoicheionLetter;
  reversed: boolean | null;
  position: SpreadPosition | null;
};

const MOTION_TRAVEL_REQUIRED = 4480;

type SpreadPosition = {
  id: StoicheionPracticeSectorId;
  direction: string;
  shortDirection: string;
  meaning: string;
};

const SPREAD_POSITIONS: readonly SpreadPosition[] = [
  {
    id: "northwest",
    direction: "Северо-запад",
    shortDirection: "СЗ",
    meaning: "Мир границ, переходов и рискованных действий. Скрытые угрозы или внезапные прорывы.",
  },
  {
    id: "north",
    direction: "Север",
    shortDirection: "С",
    meaning: "Мир ужаса или глубокого познания. Способность вкушать опыт и переваривать сложные ситуации.",
  },
  {
    id: "northeast",
    direction: "Северо-восток",
    shortDirection: "СВ",
    meaning: "Мир завершения, смерти старого и рождения нового. Интуитивное чутьё и материальные ценности.",
  },
  {
    id: "west",
    direction: "Запад",
    shortDirection: "З",
    meaning: "Мир опьянения, иллюзий и глубокого видения. Зависимости и способность видеть истину сквозь морок.",
  },
  {
    id: "center",
    direction: "Центр",
    shortDirection: "Ц",
    meaning: "Духовность, координация всех сфер и связь с вечностью. Точка сборки всей ситуации.",
  },
  {
    id: "east",
    direction: "Восток",
    shortDirection: "В",
    meaning: "Мир магии, созидания и интеллекта. Здесь, подобно восходящему Солнцу, зарождаются идеи и планы.",
  },
  {
    id: "southwest",
    direction: "Юго-запад",
    shortDirection: "ЮЗ",
    meaning: "Мир ярости, скрытых возможностей и трансформации через страдание. Сектор преодоления препятствий.",
  },
  {
    id: "south",
    direction: "Юг",
    shortDirection: "Ю",
    meaning: "Мир войны, активной деятельности и логического ума. Дисциплина, борьба и прямое действие.",
  },
  {
    id: "southeast",
    direction: "Юго-восток",
    shortDirection: "ЮВ",
    meaning: "Мир дикой природы и проявления Эго. Инстинкты, первичные импульсы и необузданная сила.",
  },
] as const;

const PREVIEW_POSITIONS = [
  SPREAD_POSITIONS[1],
  SPREAD_POSITIONS[2],
  SPREAD_POSITIONS[5],
  SPREAD_POSITIONS[0],
  SPREAD_POSITIONS[4],
  SPREAD_POSITIONS[8],
  SPREAD_POSITIONS[3],
  SPREAD_POSITIONS[6],
  SPREAD_POSITIONS[7],
] as const;

function localDayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toClientDraw(record: StoicheionDrawRecord): ClientDrawRecord {
  return {
    ...record,
    seed: record.seed >>> 0,
    localDeadline: Date.now() + Math.max(0, record.remainingSeconds) * 1000,
  };
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function readLocalDraws(dayKey: string): Partial<Record<StoicheionDrawKind, StoicheionDrawRecord>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${LOCAL_DRAW_STORAGE_PREFIX}${dayKey}`) || "{}") as Partial<Record<StoicheionDrawKind, StoicheionDrawRecord>>;
    const result: Partial<Record<StoicheionDrawKind, StoicheionDrawRecord>> = {};
    (["daily", "spread"] as const).forEach((kind) => {
      const draw = parsed[kind];
      if (!draw || draw.dayKey !== dayKey || draw.kind !== kind || ![1, 2].includes(draw.attempts)) return;
      const remainingSeconds = draw.attempts === 1
        ? Math.max(0, Math.ceil((Date.parse(draw.rerollDeadline) - Date.now()) / 1000))
        : 0;
      result[kind] = { ...draw, seed: draw.seed >>> 0, remainingSeconds, canReroll: draw.attempts === 1 && remainingSeconds > 0 };
    });
    return result;
  } catch {
    return {};
  }
}

function saveLocalDraw(kind: StoicheionDrawKind, seed: number, dayKey: string): StoicheionDrawRecord {
  const current = readLocalDraws(dayKey);
  const existing = current[kind];
  if (existing && (!existing.canReroll || existing.attempts >= 2)) {
    throw new Error(existing.attempts >= 2 ? "Переброс на сегодня уже использован." : "Трёхминутное окно для переброса завершилось.");
  }
  const now = new Date();
  const firstDrawAt = existing?.firstDrawAt ?? now.toISOString();
  const deadline = existing?.rerollDeadline ?? new Date(now.getTime() + 180_000).toISOString();
  const record: StoicheionDrawRecord = {
    kind,
    dayKey,
    seed: seed >>> 0,
    attempts: existing ? 2 : 1,
    firstDrawAt,
    rerollDeadline: deadline,
    remainingSeconds: existing ? 0 : 180,
    canReroll: !existing,
  };
  localStorage.setItem(`${LOCAL_DRAW_STORAGE_PREFIX}${dayKey}`, JSON.stringify({ ...current, [kind]: record }));
  return record;
}

export function mixStoicheionEntropy(seed: number, x: number, y: number, time: number) {
  let value = seed ^ Math.imul(Math.round(x * 100), 0x45d9f3b);
  value ^= Math.imul(Math.round(y * 100), 0x119de1f3);
  value ^= time | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function selectStoicheionCard<T>(cards: readonly T[], entropy: number) {
  if (!cards.length) return null;
  return cards[entropy % cards.length];
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function buildStoicheionSpread<T>(cards: readonly T[], seed: number, size = 9) {
  const pool = [...cards];
  const random = seededRandom(seed ^ 0xa511e9b3);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.min(size, pool.length));
}

export function isStoicheionCardReversed(seed: number, position = 0) {
  const orientationSeed = (seed ^ Math.imul(position + 1, 0x27d4eb2d)) >>> 0;
  return seededRandom(orientationSeed)() < 0.5;
}

export function buildStoicheionSpreadReading<T>(cards: readonly T[], seed: number, size = 9) {
  return buildStoicheionSpread(cards, seed, size).map((letter, index) => ({
    letter,
    reversed: isStoicheionCardReversed(seed, index + 1),
  }));
}

function orientationLabel(reversed: boolean) {
  return reversed ? "Перевёрнутое положение" : "Парадное положение";
}

export function pythmenFromTotal(total: number) {
  return total === 0 ? 0 : 1 + ((total - 1) % 9);
}

function pythmenTrace(total: number) {
  const steps = [total];
  let value = total;
  while (value > 9) {
    value = String(value)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
    steps.push(value);
  }
  return steps;
}

function contentBlocks(content: string) {
  return content.split(/\n{2,}/).filter(Boolean);
}

function splitContentBlock(block: string) {
  const headingPattern = /^(Космогонический профиль|Космологический профиль|Магическая настройка[^\n:]*|Числовая суть[^\n:]*|Парадное положение|Перевернутое положение|Практика[^\n:]*|Примечание к источнику|Буквенный и числовой профиль|Временная трактовка|Cosmogonic profile|Cosmological profile|Magical (?:tuning|attunement)[^\n:]*|Numerical (?:essence|profile)[^\n:]*|Upright position|Reversed position|Practice[^\n:]*|Body Practice[^\n:]*|Source note|Letter and numerical profile|Temporal interpretation)/i;
  const match = block.match(headingPattern);
  if (!match) return { heading: "", body: block };

  const colonIndex = block.indexOf(":", match[0].length - 1);
  const newlineIndex = block.indexOf("\n");
  if (colonIndex >= 0 && (newlineIndex < 0 || colonIndex < newlineIndex)) {
    return {
      heading: block.slice(0, colonIndex).trim(),
      body: block.slice(colonIndex + 1).trim(),
    };
  }
  if (newlineIndex >= 0) {
    return {
      heading: block.slice(0, newlineIndex).trim(),
      body: block.slice(newlineIndex + 1).trim(),
    };
  }
  return { heading: "", body: block };
}

type StoicheionCardVariant = "alphabet" | "daily" | "dialog" | "spread";

function StoicheionCardFace({
  letter,
  reversed = false,
  variant,
}: {
  letter: StoicheionLetter;
  reversed?: boolean;
  variant: StoicheionCardVariant;
}) {
  const art = getStoicheionCardArt(letter);
  const language = getRuntimeLanguage();
  const localizedArt = stoicheionArtCopy(letter.id, language);
  const body = localizedArt?.body ?? art.body;
  const bodyGreek = localizedArt?.bodyGreek ?? art.bodyGreek;
  const invocation = localizedArt?.invocation ?? art.invocation;
  const cardLabel = `${CARD_LABEL[language]} ${letter.name}: ${letter.symbol}, ${body}, ${bodyGreek}`;

  return (
    <span
      className={`stoicheion-card-visual stoicheion-card-visual-${variant}${reversed ? " is-reversed" : ""}`}
      data-genesis-preserve="stoicheion-card-art"
      role="img"
      aria-label={cardLabel}
      style={{
        "--stoicheion-card-accent": art.accent,
        "--stoicheion-card-accent-rgb": art.accentRgb,
      } as CSSProperties}
    >
      {/* Static pre-compressed deck art must remain a predictable public-file URL in both build targets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="stoicheion-card-artwork"
        src={`/stoicheion-cards/${letter.id}.webp?v=${STOICHEION_CARD_ART_VERSION}`}
        alt=""
        draggable={false}
        loading={variant === "daily" || variant === "dialog" ? "eager" : "lazy"}
      />
      <span className="stoicheion-card-artwork-shade" aria-hidden="true" />
      {/* The shared SVG is a decorative overlay, not content that benefits from image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="stoicheion-card-frame" src="/stoicheion-cards/frame-greek-key.svg" alt="" draggable={false} aria-hidden="true" />
      <span className="stoicheion-card-title" data-no-translate>
        <small>{String(letter.order).padStart(2, "0")}</small>
        <strong>{letter.name}</strong>
      </span>
      <span className="stoicheion-card-sigil" lang="el">
        <strong>{letter.symbol}</strong>
        <small>{letter.lowercase}</small>
      </span>
      <span className="stoicheion-card-caption" data-no-translate>
        <strong>{body}</strong>
        <small lang={language}>{bodyGreek}</small>
        <i lang={language}>{invocation}</i>
      </span>
    </span>
  );
}

function LetterDetails({
  letter,
  reversed,
  position,
  onClose,
  onOpenTheokyklosSector,
}: {
  letter: StoicheionLetter;
  reversed: boolean | null;
  position: SpreadPosition | null;
  onClose: () => void;
  onOpenTheokyklosSector?: (sectorId: StoicheionPracticeSectorId) => void;
}) {
  const language = getRuntimeLanguage();
  const sector = position ? THEOKYKLOS_SEGMENTS.find((segment) => segment.id === position.id) ?? null : null;
  const guidance = position ? sacredSectorGuidance(position.id) : null;
  const practices = position ? sacredPracticesForSector(position.id) : [];
  const dialogRef = useDialogAccessibility<HTMLDivElement>(onClose);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="stoicheion-letter-dialog"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`letter-${letter.id}-title`}
      tabIndex={-1}
    >
      <article>
        <button type="button" className="stoicheion-dialog-close" onClick={onClose} aria-label="Закрыть описание буквы">×</button>
        <header>
          <StoicheionCardFace letter={letter} reversed={Boolean(reversed)} variant="dialog" />
          <div>
            <span className="eyebrow">{String(letter.order).padStart(2, "0")} · значение {letter.value} · Пифмен {letter.pythmen}</span>
            <h2 id={`letter-${letter.id}-title`} data-no-translate>{letter.name}</h2>
            <p data-no-translate>{letter.tagline}</p>
            {reversed !== null ? (
              <mark className={`stoicheion-dialog-orientation${reversed ? " is-reversed" : ""}`}>
                {orientationLabel(reversed)}
              </mark>
            ) : null}
          </div>
        </header>
        <div className="stoicheion-letter-copy">
          {contentBlocks(letter.content).map((block, index) => {
            const section = splitContentBlock(block);
            return (
              <section key={`${letter.id}-${index}`}>
                {section.heading ? <h3 data-no-translate>{section.heading}</h3> : null}
                <p data-no-translate>{section.body}</p>
              </section>
            );
          })}
          {position && sector && guidance && reversed !== null ? (
            <section className={`stoicheion-sector-practice${reversed ? " is-reversed" : ""}`}>
              <header>
                <span aria-hidden="true">{sector.symbol}</span>
                <div><small>{language === "en" ? "Practice of the spread sector" : "Практика сектора расклада"}</small><h3>{position.direction} · <span data-no-translate>{catalogText(sector.patrons, language)}</span></h3></div>
              </header>
              <p data-no-translate>{catalogText(guidance[reversed ? "reversed" : "upright"], language)}</p>
              <div className="stoicheion-sector-words">
                <small>{language === "en" ? "Sacred words" : "Священные слова"}</small>
                <div>{sector.words.map((word) => <span key={word.greek} data-no-translate><b lang={language === "ru" || language === "el" ? "grc" : language}>{sacredWordCopy(word.greek, language)}</b><em>{catalogText(word.pronunciation, language)}</em></span>)}</div>
              </div>
              <div className="stoicheion-sector-habits">
                <small>{language === "en" ? "Suggested embodied practices" : "Предлагаемые воплощённые практики"}</small>
                {practices.map((practice) => <article key={practice.id}><span aria-hidden="true">{practice.emoji}</span><div data-no-translate><strong>{catalogText(practice.title, language)}</strong><p>{catalogText(practice.description, language)}</p></div></article>)}
              </div>
              {onOpenTheokyklosSector ? <button type="button" onClick={() => { onClose(); onOpenTheokyklosSector(position.id); }}>{language === "en" ? "Open the Theokyklos sector" : "Открыть сектор Теокиклоса"} →</button> : null}
            </section>
          ) : null}
        </div>
      </article>
    </div>,
    document.body,
  );
}

type StoicheionViewProps = {
  divinationDisabled?: boolean;
  onOpenTheokyklosSector?: (sectorId: StoicheionPracticeSectorId) => void;
  initialCardId?: string | null;
  onInitialCardOpened?: () => void;
  voiceDrawKind?: "daily" | "spread" | null;
  onVoiceDrawHandled?: () => void;
};

export function StoicheionView({ divinationDisabled = false, onOpenTheokyklosSector,
  initialCardId = null, onInitialCardOpened, voiceDrawKind = null, onVoiceDrawHandled }: StoicheionViewProps) {
  const locale = runtimeLocale();
  const language = getRuntimeLanguage();
  const letters = useMemo(() => getStoicheionLetters(language), [language]);
  const entropy = useRef(INITIAL_ENTROPY);
  const motionTracker = useRef<MotionTracker | null>(null);
  const motionField = useRef<HTMLButtonElement | null>(null);
  const handledVoiceDraw = useRef<"daily" | "spread" | null>(null);
  const [pointer, setPointer] = useState({ x: 50, y: 24 });
  const [dailyDraw, setDailyDraw] = useState<ClientDrawRecord | null>(null);
  const [spreadDraw, setSpreadDraw] = useState<ClientDrawRecord | null>(null);
  const [motion, setMotion] = useState<{ mode: MotionMode; progress: number } | null>(null);
  const [selectedReading, setSelectedReading] = useState<SelectedReading | null>(null);
  useEffect(() => {
    if (!initialCardId) return;
    const letter = letters.find((candidate) => candidate.id === initialCardId);
    if (!letter) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelectedReading({ letter, reversed: null, position: null });
      onInitialCardOpened?.();
    });
    return () => { active = false; };
  }, [initialCardId, letters, onInitialCardOpened]);
  const [drawsReady, setDrawsReady] = useState(false);
  const [savingKind, setSavingKind] = useState<MotionMode | null>(null);
  const [drawError, setDrawError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const today = useMemo(() => new Date(), []);
  const dayKey = useMemo(() => localDayKey(today), [today]);
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(today),
    [locale, today],
  );
  const motionActive = motion !== null;

  useEffect(() => {
    if (!motionActive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => motionField.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [motionActive]);

  useEffect(() => {
    if (divinationDisabled) return;
    let active = true;
    const load = async () => {
      try {
        const result = isGoogleSyncConfigured
          ? await loadStoicheionDraws()
          : { dayKey, draws: readLocalDraws(dayKey) };
        if (!active) return;
        setDailyDraw(result.draws.daily ? toClientDraw(result.draws.daily) : null);
        setSpreadDraw(result.draws.spread ? toClientDraw(result.draws.spread) : null);
        setDrawError("");
      } catch (error) {
        if (!active) return;
        setDrawError(error instanceof Error ? error.message : "Не удалось загрузить расклады.");
      } finally {
        if (active) setDrawsReady(true);
      }
    };
    void load();
    return () => { active = false; };
  }, [dayKey, divinationDisabled]);

  useEffect(() => {
    if (![dailyDraw, spreadDraw].some((draw) => draw?.attempts === 1 && draw.localDeadline > Date.now())) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [dailyDraw, spreadDraw]);

  const dailyLetter = dailyDraw ? selectStoicheionCard(letters, dailyDraw.seed) : null;
  const dailyReversed = dailyDraw ? isStoicheionCardReversed(dailyDraw.seed) : false;
  const spreadSeed = spreadDraw?.seed ?? null;
  const spreadCards = useMemo(
    () => spreadSeed === null ? [] : buildStoicheionSpreadReading(letters, spreadSeed),
    [letters, spreadSeed],
  );
  const spreadLetters = spreadCards.map((card) => card.letter);
  const spreadVisible = spreadSeed !== null;
  const spreadTotal = spreadLetters.reduce((sum, letter) => sum + letter.value, 0);
  const spreadPythmen = pythmenFromTotal(spreadTotal);
  const spreadTrace = pythmenTrace(spreadTotal);
  const dailyRemaining = dailyDraw?.attempts === 1 ? Math.max(0, Math.ceil((dailyDraw.localDeadline - clock) / 1000)) : 0;
  const spreadRemaining = spreadDraw?.attempts === 1 ? Math.max(0, Math.ceil((spreadDraw.localDeadline - clock) / 1000)) : 0;
  const dailyCanReroll = Boolean(dailyDraw?.attempts === 1 && dailyRemaining > 0);
  const spreadCanReroll = Boolean(spreadDraw?.attempts === 1 && spreadRemaining > 0);

  const gatherEntropy = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    entropy.current = mixStoicheionEntropy(entropy.current, x, y, event.timeStamp);
    setPointer({ x, y });
  };

  const persistDraw = async (kind: StoicheionDrawKind, seedValue: number, replaceCurrent: boolean) => {
    let seed = seedValue >>> 0;
    if (kind === "daily" && replaceCurrent && selectStoicheionCard(letters, seed)?.id === dailyLetter?.id) {
      seed = (seed + 1) >>> 0;
    }
    if (kind === "spread" && replaceCurrent && seed === spreadDraw?.seed) {
      seed = (seed + 1) >>> 0;
    }
    setSavingKind(kind);
    setDrawError("");
    try {
      const record = isGoogleSyncConfigured
        ? (await saveStoicheionDraw(kind, seed)).draw
        : saveLocalDraw(kind, seed, dayKey);
      const clientRecord = toClientDraw(record);
      if (kind === "daily") {
        setDailyDraw(clientRecord);
      } else {
        setSpreadDraw(clientRecord);
      }
      setSelectedReading(null);
      setClock((current) => current + 1);
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : "Не удалось сохранить расклад.");
    } finally {
      setSavingKind(null);
    }
  };

  useEffect(() => {
    if (!voiceDrawKind) { handledVoiceDraw.current = null; return; }
    if (handledVoiceDraw.current === voiceDrawKind) return;
    if (divinationDisabled) {
      handledVoiceDraw.current = voiceDrawKind;
      onVoiceDrawHandled?.();
      return;
    }
    if (!drawsReady) return;
    handledVoiceDraw.current = voiceDrawKind;
    onVoiceDrawHandled?.();
    const existing = voiceDrawKind === "daily" ? dailyDraw : spreadDraw;
    if (existing || savingKind) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    queueMicrotask(() => { void persistDraw(voiceDrawKind, seed, false); });
  });

  const beginMotion = (mode: MotionMode, replaceCurrent = false, eventTime = 0) => {
    if (divinationDisabled) return;
    const existing = mode === "daily" ? dailyDraw : spreadDraw;
    const canReroll = mode === "daily" ? dailyCanReroll : spreadCanReroll;
    if ((!replaceCurrent && existing) || (replaceCurrent && (!existing || !canReroll)) || savingKind) return;
    const baseSeed = mode === "spread"
      ? (dailyDraw?.seed ?? entropy.current) ^ Math.imul(dailyLetter?.value ?? 1, 0x45d9f3b)
      : entropy.current ^ (replaceCurrent ? (dailyDraw?.seed ?? 0) : 0);
    const seed = mixStoicheionEntropy(baseSeed, pointer.x, pointer.y, eventTime);
    motionTracker.current = {
      mode,
      seed,
      travel: 0,
      lastX: null,
      lastY: null,
      replaceCurrent,
    };
    setMotion({ mode, progress: 0 });
  };

  const finishMotion = (tracker: MotionTracker) => {
    motionTracker.current = null;
    setMotion(null);
    entropy.current = tracker.seed;
    if (tracker.mode === "daily") {
      void persistDraw("daily", tracker.seed, tracker.replaceCurrent);
      return;
    }
    const seed = mixStoicheionEntropy(
      tracker.seed ^ (dailyDraw?.seed ?? INITIAL_ENTROPY) ^ Math.imul(dailyLetter?.value ?? 1, 0x119de1f3),
      pointer.x,
      pointer.y,
      tracker.travel,
    );
    void persistDraw("spread", seed, tracker.replaceCurrent);
  };

  const addMotion = (x: number, y: number, time: number, distance: number) => {
    const tracker = motionTracker.current;
    if (!tracker) return;
    tracker.seed = mixStoicheionEntropy(tracker.seed, x, y, time);
    tracker.travel += Math.min(Math.max(distance, 0), 70);
    const progress = Math.min(100, Math.round((tracker.travel / MOTION_TRAVEL_REQUIRED) * 100));
    setMotion({ mode: tracker.mode, progress });
    if (tracker.travel >= MOTION_TRAVEL_REQUIRED) finishMotion(tracker);
  };

  const moveThroughField = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const tracker = motionTracker.current;
    if (!tracker) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    const distance = tracker.lastX === null || tracker.lastY === null
      ? 0
      : Math.hypot(event.clientX - tracker.lastX, event.clientY - tracker.lastY);
    tracker.lastX = event.clientX;
    tracker.lastY = event.clientY;
    setPointer({ x, y });
    addMotion(x, y, event.timeStamp, distance);
  };

  const startTouchMotion = (event: PointerEvent<HTMLButtonElement>) => {
    const tracker = motionTracker.current;
    if (!tracker) return;
    tracker.lastX = event.clientX;
    tracker.lastY = event.clientY;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; movement still works without it.
    }
  };

  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) return;
    event.preventDefault();
    const offsets: Record<string, [number, number]> = {
      ArrowUp: [0, -11],
      ArrowDown: [0, 11],
      ArrowLeft: [-11, 0],
      ArrowRight: [11, 0],
      " ": [7, 7],
    };
    const [dx, dy] = offsets[event.key];
    const x = Math.min(100, Math.max(0, pointer.x + dx));
    const y = Math.min(100, Math.max(0, pointer.y + dy));
    setPointer({ x, y });
    addMotion(x, y, event.timeStamp, 48);
  };

  const cancelMotion = () => {
    motionTracker.current = null;
    setMotion(null);
  };
  const motionDialogRef = useDialogAccessibility<HTMLDivElement>(cancelMotion, motionActive);

  return (
    <section
      className="stoicheion-view"
      data-genesis-preserve="stoicheion"
      aria-labelledby="stoicheion-title"
      onPointerMove={gatherEntropy}
      style={{ "--stoicheion-x": `${pointer.x}%`, "--stoicheion-y": `${pointer.y}%` } as CSSProperties}
    >
        <header className="stoicheion-hero">
          <div>
            <span className="eyebrow">Гно · Метэр · Басилея</span>
            <h1 id="stoicheion-title">Стойхейон</h1>
            <p>{divinationDisabled
              ? "Двадцать четыре буквенных образа и их метафизические значения."
              : "Двадцать четыре буквенных образа, карта дня и «Космический круг» — расклад девяти ликов силы."}</p>
          </div>
        </header>

      <div className="stoicheion-inner">
      <div className="stoicheion-orbit-frame" aria-hidden="true">
      <div className="stoicheion-orbit" aria-hidden="true">
        {letters.map((letter, index) => (
          <i key={letter.id} style={{ "--letter-index": index } as CSSProperties}>{letter.symbol}</i>
        ))}
      </div>

      </div>
        {divinationDisabled ? (
          <section className="stoicheion-divination-disabled" aria-labelledby="stoicheion-divination-disabled-title">
            <span aria-hidden="true">⊘</span>
            <div>
              <span className="eyebrow">Настройка личного кабинета</span>
              <h2 id="stoicheion-divination-disabled-title">Гадания по картам выключены</h2>
              <p>Вы запретили себе гадания в личном кабинете. Карта дня и расклад девяти карт скрыты, но все буквенные карты и их значения остаются доступны ниже.</p>
            </div>
          </section>
        ) : (
          <>
        <section className={`stoicheion-day-section${dailyLetter ? " has-draw" : ""}`} aria-labelledby="stoicheion-day-title">
          <div className="stoicheion-section-intro">
            <span className="eyebrow">Первое взаимодействие · {dateLabel}</span>
            <h2 id="stoicheion-day-title">Карта дня</h2>
            <p>Выбор открывает одну из 24 авторских карт. Случайность собирается на устройстве и фиксируется на текущий день.</p>
          </div>

          {drawError ? <p className="stoicheion-draw-error" role="alert">{drawError}</p> : null}

          {!dailyLetter ? (
            <button
              type="button"
              className="stoicheion-card-back"
              onClick={(event) => beginMotion("daily", false, event.timeStamp)}
              disabled={!drawsReady || savingKind !== null}
              aria-label="Начать выбор случайной буквы дня движением"
            >
              <span aria-hidden="true"><i>24</i></span>
              <strong>{drawsReady ? "Начать выбор" : "Подготовка…"}</strong>
              <small>затем поводите мышью или пальцем</small>
            </button>
          ) : (
            <div className="stoicheion-daily-result" aria-live="polite">
              <button
                type="button"
                className={`stoicheion-revealed-card${dailyReversed ? " is-reversed" : ""}`}
                onClick={() => setSelectedReading({ letter: dailyLetter, reversed: dailyReversed, position: null })}
                aria-label={`${dailyLetter.name}, ${orientationLabel(dailyReversed)}. Открыть полное описание`}
              >
                <StoicheionCardFace letter={dailyLetter} reversed={dailyReversed} variant="daily" />
                <b className="stoicheion-card-orientation">{orientationLabel(dailyReversed)}</b>
              </button>
              <div>
                <span className="eyebrow">Ваш знак на сегодня</span>
                <h3>{dailyLetter.tagline}</h3>
                <p>Выбор сохранён. Нажмите на букву, чтобы прочитать полное описание, или продолжите к раскладу девяти ликов.</p>
                <div className="stoicheion-result-actions">
                  <button type="button" className="stoicheion-text-button" onClick={() => setSelectedReading({ letter: dailyLetter, reversed: dailyReversed, position: null })}>Прочитать о букве</button>
                  {dailyCanReroll ? (
                    <button type="button" className="stoicheion-redraw-button" disabled={savingKind !== null} onClick={(event) => beginMotion("daily", true, event.timeStamp)}>
                      <span aria-hidden="true">↻</span>
                      Перебросить · {formatCountdown(dailyRemaining)}
                    </button>
                  ) : (
                    <span className="stoicheion-limit-note">{dailyDraw?.attempts === 2 ? "Переброс на сегодня использован" : "Карта дня закреплена до завтра"}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {dailyLetter ? (
          <section className="stoicheion-nine-section" aria-labelledby="stoicheion-nine-title">
            <header>
              <div>
                <span className="eyebrow">Прорицание по девяти картам</span>
                <h2 id="stoicheion-nine-title">Космический круг и девять ликов силы</h2>
                <p>Магический квадрат 3×3 соотносит девять букв со сторонами света и архетипами человеческого бытия. Расклад выводится из числового значения карты, записанного при выборе карты дня + вашего волевого воздействия.</p>
              </div>
              {!spreadVisible ? (
                <button type="button" className="stoicheion-spread-button" disabled={savingKind !== null} onClick={(event) => beginMotion("spread", false, event.timeStamp)}>
                  <span aria-hidden="true">⊹</span>
                  Начать расклад
                </button>
              ) : null}
            </header>

            {spreadVisible ? (
              <div className="stoicheion-spread-reading" aria-live="polite">
                <div className="stoicheion-spread-grid" aria-label="Расклад из девяти букв">
                  {SPREAD_POSITIONS.map((position, index) => {
                    const card = spreadCards[index];
                    const letter = card.letter;
                    return (
                      <button
                        type="button"
                        className={`stoicheion-sector sector-${position.id}${card.reversed ? " is-reversed" : ""}`}
                        key={position.id}
                        onClick={() => setSelectedReading({ letter, reversed: card.reversed, position })}
                        aria-label={`${position.direction}: ${letter.name}, ${orientationLabel(card.reversed)}. ${position.meaning}`}
                      >
                        <span className="stoicheion-direction"><i>{position.shortDirection}</i>{position.direction}</span>
                        <StoicheionCardFace letter={letter} reversed={card.reversed} variant="spread" />
                        <small>{letter.name} · число {letter.value}</small>
                        <em>{orientationLabel(card.reversed)}</em>
                        <p>{position.meaning}</p>
                      </button>
                    );
                  })}
                </div>

                <aside className="stoicheion-isopsephy" aria-labelledby="isopsephy-title">
                  <span className="eyebrow">ἰσοψηφία · числовое равенство</span>
                  <h3 id="isopsephy-title">Пифмен расклада</h3>
                  <p className="stoicheion-sum">{spreadLetters.map((letter) => letter.value).join(" + ")} = <strong>{spreadTotal}</strong></p>
                  <div className="stoicheion-root-line">
                    <span>{spreadTrace.join(" → ")}</span>
                    <strong>{spreadPythmen}</strong>
                  </div>
                  <p>Сумма числовых значений девяти букв последовательно складывается до числового корня от 1 до 9.</p>
                  <div className="stoicheion-spread-actions">
                    {spreadCanReroll ? (
                      <button type="button" className="stoicheion-redraw-button" disabled={savingKind !== null} onClick={(event) => beginMotion("spread", true, event.timeStamp)}>
                        <span aria-hidden="true">↻</span>
                        Перебросить расклад · {formatCountdown(spreadRemaining)}
                      </button>
                    ) : (
                      <span className="stoicheion-limit-note">{spreadDraw?.attempts === 2 ? "Переброс расклада на сегодня использован" : "Расклад закреплён до завтра"}</span>
                    )}
                  </div>
                </aside>
              </div>
            ) : (
              <div className="stoicheion-nine-preview" aria-hidden="true">
                <span className="stoicheion-compass-rose" />
                <div>
                  {PREVIEW_POSITIONS.map((position) => <i key={position.id}>{position.id === "center" ? "" : position.shortDirection}</i>)}
                </div>
              </div>
            )}
          </section>
        ) : null}
          </>
        )}

        <section className="stoicheion-alphabet-section" aria-labelledby="stoicheion-alphabet-title">
          <header>
            <div>
              <span className="eyebrow">Основной греческий ряд · 24</span>
              <h2 id="stoicheion-alphabet-title">Выберите букву</h2>
            </div>
            <p>Нажмите на любой знак, чтобы открыть метафизический профиль, прямое и перевёрнутое положения, практику и числовое значение.</p>
          </header>
          <div className="stoicheion-alphabet-grid">
            {letters.map((letter) => (
              <button
                type="button"
                key={letter.id}
                onClick={() => setSelectedReading({ letter, reversed: null, position: null })}
                aria-label={`Открыть карту ${letter.name}, ${letter.symbol}`}
              >
                <StoicheionCardFace letter={letter} variant="alphabet" />
              </button>
            ))}
          </div>
        </section>

        <footer className="stoicheion-footer">
          {divinationDisabled ? (
            <span>Гадания отключены настройкой вашей учётной записи</span>
          ) : (
            <>
              <span>Случайность собирается локально</span>
              <span>Дневные попытки закрепляются за вашей учётной записью</span>
            </>
          )}
        </footer>
      </div>

      {motion && typeof document !== "undefined" ? createPortal(
        <div
          className="stoicheion-motion-veil"
          ref={motionDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={motion.mode === "daily" ? "Поле выбора карты дня" : "Поле выбора девяти карт"}
          tabIndex={-1}
          style={{
            "--motion-progress": motion.progress,
            "--motion-x": `${pointer.x}%`,
            "--motion-y": `${pointer.y}%`,
          } as CSSProperties}
        >
          <button
            ref={motionField}
            type="button"
            className="stoicheion-motion-capture"
            aria-label="Собирать случайность движением мыши, пальца или клавишами со стрелками"
            onPointerDown={startTouchMotion}
            onPointerMove={moveThroughField}
            onKeyDown={moveWithKeyboard}
          />
          <button type="button" className="stoicheion-motion-cancel" onClick={cancelMotion} aria-label="Отменить выбор">×</button>
          <div className="stoicheion-motion-stars" aria-hidden="true">
            {letters.slice(0, 12).map((letter, index) => (
              <i key={letter.id} style={{ "--motion-index": index } as CSSProperties}>{letter.symbol}</i>
            ))}
          </div>
          <div className="stoicheion-motion-copy">
            <span className="eyebrow">Поле случайности · движение создаёт зерно</span>
            <h2>{motion.mode === "daily" ? "Проведите рукой над знаками" : "Соберите девять ликов движением"}</h2>
            <p>Водите мышью по экрану или проведите пальцем несколько раз. Карта{motion.mode === "spread" ? "ы" : ""} проявится только после того, как поле соберёт достаточно движения.</p>
            <div className="stoicheion-motion-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={motion.progress}>
              <strong>{motion.progress}%</strong>
              <small>движение</small>
            </div>
            <b>{motion.progress < 35 ? "Пробуждение поля" : motion.progress < 75 ? "Знаки смешиваются" : "Образ почти проявился"}</b>
          </div>
        </div>,
        document.body,
      ) : null}

      {selectedReading ? (
        <LetterDetails
          letter={letters.find((letter) => letter.id === selectedReading.letter.id) ?? selectedReading.letter}
          reversed={selectedReading.reversed}
          position={selectedReading.position}
          onClose={() => setSelectedReading(null)}
          onOpenTheokyklosSector={onOpenTheokyklosSector}
        />
      ) : null}
    </section>
  );
}
