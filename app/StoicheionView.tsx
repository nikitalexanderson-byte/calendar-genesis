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
  STOICHEION_LETTERS,
  type StoicheionLetter,
} from "./stoicheion-data";

const DAILY_DRAW_STORAGE_PREFIX = "genesis-stoicheion-day-v1:";
const INITIAL_ENTROPY = 0x9e3779b9;

type StoredDailyDraw = {
  dayKey: string;
  letterId: string;
  seed: number;
  reversed: boolean;
};

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
};

const MOTION_TRAVEL_REQUIRED = 280;

type SpreadPosition = {
  id: string;
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
  const headingPattern = /^(Космогонический профиль|Космологический профиль|Магическая настройка[^\n:]*|Числовая суть[^\n:]*|Парадное положение|Перевернутое положение|Практика[^\n:]*|Примечание к источнику|Буквенный и числовой профиль|Временная трактовка)/;
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

function LetterDetails({
  letter,
  reversed,
  onClose,
}: {
  letter: StoicheionLetter;
  reversed: boolean | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="stoicheion-letter-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`letter-${letter.id}-title`}
    >
      <article>
        <button type="button" className="stoicheion-dialog-close" onClick={onClose} aria-label="Закрыть описание буквы">×</button>
        <header>
          <div className="stoicheion-dialog-symbol" aria-hidden="true">
            <strong>{letter.symbol}</strong>
            <span>{letter.lowercase}</span>
          </div>
          <div>
            <span className="eyebrow">{String(letter.order).padStart(2, "0")} · значение {letter.value} · Пифмен {letter.pythmen}</span>
            <h2 id={`letter-${letter.id}-title`}>{letter.name}</h2>
            <p>{letter.tagline}</p>
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
                {section.heading ? <h3>{section.heading}</h3> : null}
                <p>{section.body}</p>
              </section>
            );
          })}
        </div>
      </article>
    </div>,
    document.body,
  );
}

export function StoicheionView() {
  const entropy = useRef(INITIAL_ENTROPY);
  const motionTracker = useRef<MotionTracker | null>(null);
  const motionField = useRef<HTMLButtonElement | null>(null);
  const [pointer, setPointer] = useState({ x: 50, y: 24 });
  const [dailyDraw, setDailyDraw] = useState<StoredDailyDraw | null>(null);
  const [spreadSeed, setSpreadSeed] = useState<number | null>(null);
  const [motion, setMotion] = useState<{ mode: MotionMode; progress: number } | null>(null);
  const [selectedReading, setSelectedReading] = useState<SelectedReading | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const today = useMemo(() => new Date(), []);
  const dayKey = useMemo(() => localDayKey(today), [today]);
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(today),
    [today],
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
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = localStorage.getItem(`${DAILY_DRAW_STORAGE_PREFIX}${dayKey}`);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<StoredDailyDraw>;
          if (
            parsed.dayKey === dayKey
            && typeof parsed.letterId === "string"
            && typeof parsed.seed === "number"
            && STOICHEION_LETTERS.some((letter) => letter.id === parsed.letterId)
          ) {
            const seed = parsed.seed >>> 0;
            setDailyDraw({
              dayKey,
              letterId: parsed.letterId,
              seed,
              reversed: typeof parsed.reversed === "boolean"
                ? parsed.reversed
                : isStoicheionCardReversed(seed),
            });
          }
        }
      } catch {
        // A blocked or malformed local store should never stop a private, local draw.
      } finally {
        setStorageReady(true);
      }
    });
    return () => { active = false; };
  }, [dayKey]);

  const dailyLetter = dailyDraw
    ? STOICHEION_LETTERS.find((letter) => letter.id === dailyDraw.letterId) ?? null
    : null;
  const spreadCards = useMemo(
    () => spreadSeed === null ? [] : buildStoicheionSpreadReading(STOICHEION_LETTERS, spreadSeed),
    [spreadSeed],
  );
  const spreadLetters = spreadCards.map((card) => card.letter);
  const spreadVisible = spreadSeed !== null;
  const spreadTotal = spreadLetters.reduce((sum, letter) => sum + letter.value, 0);
  const spreadPythmen = pythmenFromTotal(spreadTotal);
  const spreadTrace = pythmenTrace(spreadTotal);

  const gatherEntropy = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    entropy.current = mixStoicheionEntropy(entropy.current, x, y, event.timeStamp);
    setPointer({ x, y });
  };

  const saveDailyDraw = (seedValue: number, replaceCurrent: boolean) => {
    let seed = seedValue;
    let letter = selectStoicheionCard(STOICHEION_LETTERS, seed);
    if (replaceCurrent && letter?.id === dailyDraw?.letterId) {
      seed = (seed + 1) >>> 0;
      letter = selectStoicheionCard(STOICHEION_LETTERS, seed);
    }
    if (!letter) return;
    const draw = {
      dayKey,
      letterId: letter.id,
      seed,
      reversed: isStoicheionCardReversed(seed),
    };
    setDailyDraw(draw);
    setSpreadSeed(null);
    setSelectedReading(null);
    try {
      localStorage.setItem(`${DAILY_DRAW_STORAGE_PREFIX}${dayKey}`, JSON.stringify(draw));
    } catch {
      // The draw remains available for the current session if storage is blocked.
    }
  };

  const beginMotion = (mode: MotionMode, replaceCurrent = false) => {
    const baseSeed = mode === "spread"
      ? (dailyDraw?.seed ?? entropy.current)
      : entropy.current ^ (replaceCurrent ? (dailyDraw?.seed ?? 0) : 0);
    const seed = mixStoicheionEntropy(baseSeed, pointer.x, pointer.y, performance.now());
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
      saveDailyDraw(tracker.seed, tracker.replaceCurrent);
      return;
    }
    const seed = mixStoicheionEntropy(
      tracker.seed ^ (dailyDraw?.seed ?? INITIAL_ENTROPY),
      pointer.x,
      pointer.y,
      tracker.travel,
    );
    setSpreadSeed(seed);
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

  return (
    <section
      className="stoicheion-view"
      aria-labelledby="stoicheion-title"
      onPointerMove={gatherEntropy}
      style={{ "--stoicheion-x": `${pointer.x}%`, "--stoicheion-y": `${pointer.y}%` } as CSSProperties}
    >
      <div className="stoicheion-orbit" aria-hidden="true">
        {STOICHEION_LETTERS.map((letter, index) => (
          <i key={letter.id} style={{ "--letter-index": index } as CSSProperties}>{letter.symbol}</i>
        ))}
      </div>

      <div className="stoicheion-inner">
        <header className="stoicheion-hero">
          <div>
            <span className="eyebrow">Гно · Метэр · Басилея</span>
            <h1 id="stoicheion-title">Стойхейон</h1>
            <p>Двадцать четыре буквенных образа, карта дня и «Космический круг» — расклад девяти ликов силы.</p>
          </div>
        </header>

        <section className={`stoicheion-day-section${dailyLetter ? " has-draw" : ""}`} aria-labelledby="stoicheion-day-title">
          <div className="stoicheion-section-intro">
            <span className="eyebrow">Первое взаимодействие · {dateLabel}</span>
            <h2 id="stoicheion-day-title">Карта дня</h2>
            <p>Пока изображения карт готовятся, выбор открывает одну букву. Случайность собирается на устройстве и фиксируется на текущий день.</p>
          </div>

          {!dailyLetter ? (
            <button
              type="button"
              className="stoicheion-card-back"
              onClick={() => beginMotion("daily")}
              disabled={!storageReady}
              aria-label="Начать выбор случайной буквы дня движением"
            >
              <span aria-hidden="true"><i>24</i></span>
              <strong>{storageReady ? "Начать выбор" : "Подготовка…"}</strong>
              <small>затем поводите мышью или пальцем</small>
            </button>
          ) : (
            <div className="stoicheion-daily-result" aria-live="polite">
              <button
                type="button"
                className={`stoicheion-revealed-card${dailyDraw?.reversed ? " is-reversed" : ""}`}
                onClick={() => setSelectedReading({ letter: dailyLetter, reversed: dailyDraw?.reversed ?? false })}
              >
                <span className="stoicheion-card-glyph">{dailyLetter.symbol}</span>
                <small>{dailyLetter.lowercase}</small>
                <strong>{dailyLetter.name}</strong>
                <i>Число {dailyLetter.value} · Пифмен {dailyLetter.pythmen}</i>
                <b className="stoicheion-card-orientation">{orientationLabel(dailyDraw?.reversed ?? false)}</b>
              </button>
              <div>
                <span className="eyebrow">Ваш знак на сегодня</span>
                <h3>{dailyLetter.tagline}</h3>
                <p>Выбор сохранён. Нажмите на букву, чтобы прочитать полное описание, или продолжите к раскладу девяти ликов.</p>
                <div className="stoicheion-result-actions">
                  <button type="button" className="stoicheion-text-button" onClick={() => setSelectedReading({ letter: dailyLetter, reversed: dailyDraw?.reversed ?? false })}>Прочитать о букве</button>
                  <button type="button" className="stoicheion-redraw-button" onClick={() => beginMotion("daily", true)}>
                    <span aria-hidden="true">↻</span>
                    Бросить ещё раз
                  </button>
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
                <p>Магический квадрат 3×3 соотносит девять букв со сторонами света и архетипами человеческого бытия. Расклад выводится из зерна, записанного при выборе карты дня.</p>
              </div>
              {!spreadVisible ? (
                <button type="button" className="stoicheion-spread-button" onClick={() => beginMotion("spread")}>
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
                        onClick={() => setSelectedReading({ letter, reversed: card.reversed })}
                        aria-label={`${position.direction}: ${letter.name}, ${orientationLabel(card.reversed)}. ${position.meaning}`}
                      >
                        <span className="stoicheion-direction"><i>{position.shortDirection}</i>{position.direction}</span>
                        <strong className="stoicheion-sector-glyph">{letter.symbol}</strong>
                        <small>{letter.name} · {letter.value}</small>
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

        <section className="stoicheion-alphabet-section" aria-labelledby="stoicheion-alphabet-title">
          <header>
            <div>
              <span className="eyebrow">Основной греческий ряд · 24</span>
              <h2 id="stoicheion-alphabet-title">Выберите букву</h2>
            </div>
            <p>Нажмите на любой знак, чтобы открыть метафизический профиль, прямое и перевёрнутое положения, практику и числовое значение.</p>
          </header>
          <div className="stoicheion-alphabet-grid">
            {STOICHEION_LETTERS.map((letter) => (
              <button
                type="button"
                key={letter.id}
                className={letter.source === "editorial-placeholder" ? "is-placeholder" : ""}
                onClick={() => setSelectedReading({ letter, reversed: null })}
              >
                <i>{String(letter.order).padStart(2, "0")}</i>
                <strong>{letter.symbol}</strong>
                <span>{letter.name}</span>
                <small>{letter.value} · π {letter.pythmen}</small>
              </button>
            ))}
          </div>
        </section>

        <footer className="stoicheion-footer">
          <span>Случайность собирается локально</span>
          <span>Карта дня хранится только на устройстве</span>
        </footer>
      </div>

      {motion && typeof document !== "undefined" ? createPortal(
        <div
          className="stoicheion-motion-veil"
          role="dialog"
          aria-modal="true"
          aria-label={motion.mode === "daily" ? "Поле выбора карты дня" : "Поле выбора девяти карт"}
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
            {STOICHEION_LETTERS.slice(0, 12).map((letter, index) => (
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
          letter={selectedReading.letter}
          reversed={selectedReading.reversed}
          onClose={() => setSelectedReading(null)}
        />
      ) : null}
    </section>
  );
}
