"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  STOICHEION_LETTERS,
  STOICHEION_SOURCE_COUNT,
  STOICHEION_TOTAL_COUNT,
  type StoicheionLetter,
} from "./stoicheion-data";

const DAILY_DRAW_STORAGE_PREFIX = "genesis-stoicheion-day-v1:";
const INITIAL_ENTROPY = 0x9e3779b9;

type StoredDailyDraw = {
  dayKey: string;
  letterId: string;
  seed: number;
};

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
  onClose,
}: {
  letter: StoicheionLetter;
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
            {letter.source === "editorial-placeholder" ? <mark>Временное дополнение: описание отсутствовало в исходном файле</mark> : null}
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
  const [pointer, setPointer] = useState({ x: 50, y: 24 });
  const [dailyDraw, setDailyDraw] = useState<StoredDailyDraw | null>(null);
  const [spreadVisible, setSpreadVisible] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<StoicheionLetter | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const today = useMemo(() => new Date(), []);
  const dayKey = useMemo(() => localDayKey(today), [today]);
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(today),
    [today],
  );

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
            setDailyDraw({ dayKey, letterId: parsed.letterId, seed: parsed.seed >>> 0 });
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
  const spreadLetters = useMemo(
    () => dailyDraw ? buildStoicheionSpread(STOICHEION_LETTERS, dailyDraw.seed) : [],
    [dailyDraw],
  );
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

  const drawDailyLetter = (replaceCurrent = false) => {
    const browserEntropy = new Uint32Array(1);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(browserEntropy);
    } else {
      browserEntropy[0] = Date.now() >>> 0;
    }
    let seed = mixStoicheionEntropy(
      entropy.current ^ browserEntropy[0],
      pointer.x,
      pointer.y,
      performance.now(),
    );
    let letter = selectStoicheionCard(STOICHEION_LETTERS, seed);
    if (replaceCurrent && letter?.id === dailyDraw?.letterId) {
      seed = (seed + 1) >>> 0;
      letter = selectStoicheionCard(STOICHEION_LETTERS, seed);
    }
    if (!letter) return;
    const draw = { dayKey, letterId: letter.id, seed };
    setDailyDraw(draw);
    setSpreadVisible(false);
    setSelectedLetter(null);
    try {
      localStorage.setItem(`${DAILY_DRAW_STORAGE_PREFIX}${dayKey}`, JSON.stringify(draw));
    } catch {
      // The draw remains available for the current session if storage is blocked.
    }
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
          <dl className="stoicheion-counts" aria-label="Состав каталога">
            <div><dt>{STOICHEION_TOTAL_COUNT}</dt><dd>основные буквы</dd></div>
            <div><dt>{STOICHEION_SOURCE_COUNT}</dt><dd>описания из файла</dd></div>
            <div><dt>1</dt><dd>временное дополнение</dd></div>
          </dl>
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
              onClick={() => drawDailyLetter()}
              disabled={!storageReady}
              aria-label="Открыть случайную букву дня"
            >
              <span aria-hidden="true"><i>24</i></span>
              <strong>{storageReady ? "Открыть букву" : "Подготовка…"}</strong>
              <small>первый выбор создаст зерно расклада</small>
            </button>
          ) : (
            <div className="stoicheion-daily-result" aria-live="polite">
              <button type="button" className="stoicheion-revealed-card" onClick={() => setSelectedLetter(dailyLetter)}>
                <span>{dailyLetter.symbol}</span>
                <small>{dailyLetter.lowercase}</small>
                <strong>{dailyLetter.name}</strong>
                <i>Число {dailyLetter.value} · Пифмен {dailyLetter.pythmen}</i>
              </button>
              <div>
                <span className="eyebrow">Ваш знак на сегодня</span>
                <h3>{dailyLetter.tagline}</h3>
                <p>Выбор сохранён. Нажмите на букву, чтобы прочитать полное описание, или продолжите к раскладу девяти ликов.</p>
                <div className="stoicheion-result-actions">
                  <button type="button" className="stoicheion-text-button" onClick={() => setSelectedLetter(dailyLetter)}>Прочитать о букве</button>
                  <button type="button" className="stoicheion-redraw-button" onClick={() => drawDailyLetter(true)}>
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
                <button type="button" className="stoicheion-spread-button" onClick={() => setSpreadVisible(true)}>
                  <span aria-hidden="true">⊹</span>
                  Открыть девять ликов
                </button>
              ) : null}
            </header>

            {spreadVisible ? (
              <div className="stoicheion-spread-reading" aria-live="polite">
                <div className="stoicheion-spread-grid" aria-label="Расклад из девяти букв">
                  {SPREAD_POSITIONS.map((position, index) => {
                    const letter = spreadLetters[index];
                    return (
                      <button
                        type="button"
                        className={`stoicheion-sector sector-${position.id}`}
                        key={position.id}
                        onClick={() => setSelectedLetter(letter)}
                        aria-label={`${position.direction}: ${letter.name}, ${position.meaning}`}
                      >
                        <span className="stoicheion-direction"><i>{position.shortDirection}</i>{position.direction}</span>
                        <strong>{letter.symbol}</strong>
                        <small>{letter.name} · {letter.value}</small>
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
                {SPREAD_POSITIONS.map((position) => <i key={position.id}>{position.shortDirection}</i>)}
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
                onClick={() => setSelectedLetter(letter)}
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
          <span>24 буквы · сумма числовых значений 3999</span>
        </footer>
      </div>

      {selectedLetter ? <LetterDetails letter={selectedLetter} onClose={() => setSelectedLetter(null)} /> : null}
    </section>
  );
}
