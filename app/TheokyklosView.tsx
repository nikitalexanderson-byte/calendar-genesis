"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  THEOKYKLOS_DIRECTION_IDS,
  THEOKYKLOS_SEGMENTS,
  type TheokyklosLocalizedText,
  type TheokyklosSegment,
  type TheokyklosSegmentId,
} from "./theokyklos-data";
import type { Language } from "./i18n";

type Point = { x: number; y: number };

const CENTER: Point = { x: 450, y: 420 };

function localized(copy: TheokyklosLocalizedText, language: Language) {
  return copy[language];
}

function polarPoint(angle: number, radius: number): Point {
  const radians = angle * Math.PI / 180;
  return {
    x: CENTER.x + Math.cos(radians) * radius,
    y: CENTER.y + Math.sin(radians) * radius,
  };
}

function annularSectorPath(centerAngle: number, innerRadius = 174, outerRadius = 302) {
  const startAngle = centerAngle - 20.5;
  const endAngle = centerAngle + 20.5;
  const outerStart = polarPoint(startAngle, outerRadius);
  const outerEnd = polarPoint(endAngle, outerRadius);
  const innerEnd = polarPoint(endAngle, innerRadius);
  const innerStart = polarPoint(startAngle, innerRadius);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function groupLabel(segment: TheokyklosSegment, language: Language) {
  const labels = language === "en"
    ? {
        paired: "Vector of transformation",
        single: "Self-sufficient vector",
        axis: "Vertical axis of power",
        core: "Center and hearth",
        threshold: "Guardian of the threshold",
      }
    : {
        paired: "Вектор трансформации",
        single: "Самодостаточный вектор",
        axis: "Вертикаль силы",
        core: "Центр и очаг",
        threshold: "Страж порога",
      };
  return labels[segment.group];
}

function directionLabel(id: TheokyklosSegmentId, language: Language) {
  const labels: Record<(typeof THEOKYKLOS_DIRECTION_IDS)[number], TheokyklosLocalizedText> = {
    north: { ru: "Север", en: "North" },
    northeast: { ru: "Северо-Восток", en: "Northeast" },
    east: { ru: "Восток", en: "East" },
    southeast: { ru: "Юго-Восток", en: "Southeast" },
    south: { ru: "Юг", en: "South" },
    southwest: { ru: "Юго-Запад", en: "Southwest" },
    west: { ru: "Запад", en: "West" },
    northwest: { ru: "Северо-Запад", en: "Northwest" },
  };
  return localized(labels[id as (typeof THEOKYKLOS_DIRECTION_IDS)[number]], language);
}

export function TheokyklosView({ language }: { language: Language }) {
  const [selectedId, setSelectedId] = useState<TheokyklosSegmentId | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const segmentsById = useMemo(() => new Map(THEOKYKLOS_SEGMENTS.map((segment) => [segment.id, segment])), []);
  const directions = THEOKYKLOS_DIRECTION_IDS.map((id) => segmentsById.get(id)).filter((segment): segment is TheokyklosSegment => Boolean(segment));
  const selected = selectedId ? segmentsById.get(selectedId) ?? null : null;

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedId]);

  const selectSegment = (id: TheokyklosSegmentId) => {
    setSelectedId(id);
  };

  const selectWithKeyboard = (event: ReactKeyboardEvent<SVGGElement>, id: TheokyklosSegmentId) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectSegment(id);
  };

  const interactiveProps = (segment: TheokyklosSegment) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": `${localized(segment.title, language)} — ${localized(segment.patrons, language)}`,
    "aria-pressed": selectedId === segment.id,
    onClick: () => selectSegment(segment.id),
    onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => selectWithKeyboard(event, segment.id),
  });

  const zenith = segmentsById.get("zenith")!;
  const nadir = segmentsById.get("nadir")!;
  const hearth = segmentsById.get("hearth")!;
  const center = segmentsById.get("center")!;
  const entrance = segmentsById.get("entrance")!;
  const exit = segmentsById.get("exit")!;

  return (
    <section className="theokyklos-view" aria-labelledby="theokyklos-title">
      <header className="theokyklos-hero">
        <div className="theokyklos-hero-copy">
          <span className="eyebrow">ΘΕΟΚΥΚΛΟΣ · {language === "en" ? "THE CIRCLE OF GODS" : "КРУГ БОГОВ"}</span>
          <h1 id="theokyklos-title">{language === "en" ? "Theokyklos" : "Теокиклос"}</h1>
          <p>{language === "en"
            ? "An interactive circle of divine powers: eight directions of manifestation, the vertical axis, the sacred hearth, the Point of the Absolute, and the guardians of entry and exit."
            : "Интерактивный круг божественных сил: восемь направлений проявления, вертикальная ось, сакральный очаг, Точка Абсолюта и стражи входа и выхода."}</p>
        </div>
        <div className="theokyklos-hero-seal" aria-hidden="true">
          <span>Θ</span>
        </div>
      </header>

      <div className="theokyklos-layout">
        <section className="theokyklos-mandala-card" aria-labelledby="theokyklos-mandala-title">
          <div className="theokyklos-mandala-heading">
            <div>
              <span className="eyebrow">{language === "en" ? "Living diagram" : "Живая схема"}</span>
              <h2 id="theokyklos-mandala-title">{language === "en" ? "Circle of Divine Powers" : "Круг божественных сил"}</h2>
            </div>
            <p>{language === "en" ? "Select any ray, ring, pole, or gate." : "Выберите любой луч, круг, полюс или врата."}</p>
          </div>

          <div className="theokyklos-mandala-viewport">
            <svg className="theokyklos-mandala" viewBox="0 0 900 880" role="img" aria-labelledby="theokyklos-svg-title theokyklos-svg-description">
              <title id="theokyklos-svg-title">{language === "en" ? "Interactive Circle of Divine Powers" : "Интерактивный Круг божественных сил"}</title>
              <desc id="theokyklos-svg-description">{language === "en"
                ? "Eight directional sectors surround Hestia's inner ring and the central point of Dionysus and Ariadne. Zeus and Hera stand at the zenith, Hades and Persephone at the nadir, with guardians of entry and exit below."
                : "Восемь направлений окружают внутреннее кольцо Гестии и центральную точку Диониса и Ариадны. Зевс и Гера стоят в зените, Аид и Персефона — в надире, а внизу находятся стражи входа и выхода."}</desc>
              <defs>
                <radialGradient id="theokyklos-core-glow" cx="50%" cy="45%" r="66%">
                  <stop offset="0%" stopColor="#f1d890" stopOpacity=".94" />
                  <stop offset="48%" stopColor="#b7722e" stopOpacity=".52" />
                  <stop offset="100%" stopColor="#102b2d" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="theokyklos-axis-glow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9c57d" stopOpacity=".9" />
                  <stop offset="50%" stopColor="#83a8a4" stopOpacity=".16" />
                  <stop offset="100%" stopColor="#766f8f" stopOpacity=".84" />
                </linearGradient>
                <filter id="theokyklos-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="9" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              <circle className="theokyklos-celestial-field" cx={CENTER.x} cy={CENTER.y} r="345" />
              <circle className="theokyklos-orbit orbit-outer" cx={CENTER.x} cy={CENTER.y} r="320" />
              <circle className="theokyklos-orbit orbit-inner" cx={CENTER.x} cy={CENTER.y} r="166" />
              <path className="theokyklos-axis" d="M450 92V748" />
              <path className="theokyklos-cross-axis" d="M122 420H778" />
              <circle className="theokyklos-core-aura" cx={CENTER.x} cy={CENTER.y} r="164" fill="url(#theokyklos-core-glow)" />

              {directions.map((segment) => {
                const label = polarPoint(segment.angle!, 238);
                return (
                  <g
                    {...interactiveProps(segment)}
                    className={`theokyklos-svg-segment direction-segment segment-${segment.id}${selectedId === segment.id ? " is-selected" : ""}`}
                    key={segment.id}
                  >
                    <path className="theokyklos-segment-shape" d={annularSectorPath(segment.angle!)} />
                    <text className="theokyklos-segment-label" x={label.x} y={label.y - 10} textAnchor="middle">
                      <tspan className="theokyklos-segment-sigil" x={label.x}>{segment.symbol}</tspan>
                      <tspan className="theokyklos-segment-direction" x={label.x} dy="22">{directionLabel(segment.id, language)}</tspan>
                      <tspan className="theokyklos-segment-name" x={label.x} dy="17">{localized(segment.patrons, language)}</tspan>
                    </text>
                  </g>
                );
              })}

              <g
                {...interactiveProps(hearth)}
                className={`theokyklos-svg-segment hearth-segment${selectedId === "hearth" ? " is-selected" : ""}`}
              >
                <circle className="theokyklos-hearth-hit" cx={CENTER.x} cy={CENTER.y} r="139" />
                <circle className="theokyklos-hearth-line" cx={CENTER.x} cy={CENTER.y} r="139" />
                <text className="theokyklos-ring-label" x={CENTER.x} y="301" textAnchor="middle">
                  <tspan>{language === "en" ? "RING" : "КОЛЬЦО"}</tspan>
                </text>
              </g>

              <g
                {...interactiveProps(center)}
                className={`theokyklos-svg-segment center-segment${selectedId === "center" ? " is-selected" : ""}`}
              >
                <circle className="theokyklos-center-disc" cx={CENTER.x} cy={CENTER.y} r="86" />
                <circle className="theokyklos-center-line" cx={CENTER.x} cy={CENTER.y} r="69" />
                <text className="theokyklos-center-label" x={CENTER.x} y="397" textAnchor="middle">
                  <tspan className="theokyklos-center-sigil" x={CENTER.x}>{center.symbol}</tspan>
                  <tspan x={CENTER.x} dy="27">{localized(center.patrons, language)}</tspan>
                  <tspan className="theokyklos-center-caption" x={CENTER.x} dy="20">{localized(center.short, language)}</tspan>
                </text>
              </g>

              <g
                {...interactiveProps(zenith)}
                className={`theokyklos-svg-segment axis-node zenith-node${selectedId === "zenith" ? " is-selected" : ""}`}
              >
                <circle cx="450" cy="61" r="47" />
                <text x="450" y="51" textAnchor="middle"><tspan className="axis-node-sigil">{zenith.symbol}</tspan><tspan x="450" dy="22">{localized(zenith.short, language)}</tspan></text>
              </g>
              <g
                {...interactiveProps(nadir)}
                className={`theokyklos-svg-segment axis-node nadir-node${selectedId === "nadir" ? " is-selected" : ""}`}
              >
                <circle cx="450" cy="785" r="47" />
                <text x="450" y="775" textAnchor="middle"><tspan className="axis-node-sigil">{nadir.symbol}</tspan><tspan x="450" dy="22">{localized(nadir.short, language)}</tspan></text>
              </g>

              <g
                {...interactiveProps(entrance)}
                className={`theokyklos-svg-segment threshold-node entrance-node${selectedId === "entrance" ? " is-selected" : ""}`}
              >
                <path d="M108 827V758Q108 712 154 712Q200 712 200 758V827" />
                <text x="154" y="760" textAnchor="middle"><tspan className="threshold-sigil">{entrance.symbol}</tspan><tspan x="154" dy="22">{localized(entrance.short, language)}</tspan></text>
              </g>
              <g
                {...interactiveProps(exit)}
                className={`theokyklos-svg-segment threshold-node exit-node${selectedId === "exit" ? " is-selected" : ""}`}
              >
                <path d="M700 827V758Q700 712 746 712Q792 712 792 758V827" />
                <text x="746" y="760" textAnchor="middle"><tspan className="threshold-sigil">{exit.symbol}</tspan><tspan x="746" dy="22">{localized(exit.short, language)}</tspan></text>
              </g>

              <g className="theokyklos-stars" aria-hidden="true">
                <circle cx="93" cy="265" r="2" /><circle cx="812" cy="252" r="2" /><circle cx="92" cy="577" r="1.5" />
                <circle cx="809" cy="588" r="1.5" /><circle cx="284" cy="64" r="1.5" /><circle cx="620" cy="62" r="2" />
                <path d="M74 420h20M84 410v20M806 420h20M816 410v20" />
              </g>
            </svg>
          </div>

          <div className="theokyklos-segment-index" aria-label={language === "en" ? "All Theokyklos segments" : "Все сегменты Теокиклоса"}>
            {THEOKYKLOS_SEGMENTS.map((segment) => (
              <button
                type="button"
                className={selectedId === segment.id ? "active" : ""}
                onClick={() => selectSegment(segment.id)}
                aria-pressed={selectedId === segment.id}
                key={segment.id}
              >
                <span aria-hidden="true">{segment.symbol}</span>
                <small>{localized(segment.short, language)}</small>
                <strong>{localized(segment.patrons, language)}</strong>
              </button>
            ))}
          </div>
        </section>

        {selected ? (
          <div className="modal-backdrop theokyklos-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
            <aside id="theokyklos-details" className={`theokyklos-details segment-${selected.id}`} role="dialog" aria-modal="true" aria-labelledby="theokyklos-details-title">
              <button ref={closeButtonRef} className="theokyklos-details-close" type="button" onClick={() => setSelectedId(null)} aria-label={language === "en" ? "Close segment description" : "Закрыть описание сегмента"}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <header>
                <span className="theokyklos-details-symbol" aria-hidden="true">{selected.symbol}</span>
                <div>
                  <span className="eyebrow">{groupLabel(selected, language)}</span>
                  <h2 id="theokyklos-details-title">{localized(selected.title, language)}</h2>
                  <strong>{localized(selected.patrons, language)}</strong>
                </div>
              </header>
              <p className="theokyklos-essence">{localized(selected.essence, language)}</p>
              <p className="theokyklos-description">{localized(selected.description, language)}</p>
              <section className="theokyklos-incantation" aria-labelledby="theokyklos-incantation-title">
                <div>
                  <span className="eyebrow">{language === "en" ? "Sacred utterance" : "Сакральное произнесение"}</span>
                  <h3 id="theokyklos-incantation-title">{language === "en" ? "Words of the segment" : "Слова сегмента"}</h3>
                </div>
                <p>{language === "en"
                  ? "Pronounce each word deliberately, moving from meaning to sound."
                  : "Произносите каждое слово осознанно, переходя от смысла к звучанию."}</p>
                <ol>
                  {selected.words.map((sacredWord) => (
                    <li key={sacredWord.greek}>
                      <span lang="grc">{sacredWord.greek}</span>
                      <div>
                        <strong>«{localized(sacredWord.pronunciation, language)}»</strong>
                        <small>{localized(sacredWord.meaning, language)}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        ) : null}
      </div>

    </section>
  );
}
