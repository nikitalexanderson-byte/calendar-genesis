"use client";

import { useState, type CSSProperties, type PointerEvent } from "react";
import type { AchievementDefinition } from "./achievements";

type AchievementSigilProps = {
  motif: AchievementDefinition["motif"];
  artwork: string;
  unlocked: boolean;
  concealed: boolean;
  label: string;
};

function AchievementMotif({ motif }: Pick<AchievementSigilProps, "motif">) {
  if (motif === "spark") return <><path d="m32 15 4 12 12 5-12 5-4 12-4-12-12-5 12-5Z" /><circle cx="32" cy="32" r="4" /></>;
  if (motif === "steps") return <><path d="M15 45h12V35h10V25h12V15" /><path d="m42 15h7v7" /></>;
  if (motif === "sun") return <><circle cx="32" cy="32" r="12" /><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" /></>;
  if (motif === "circle") return <><circle cx="32" cy="32" r="20" /><path d="m23 32 6 6 13-14" /></>;
  if (motif === "crown") return <><path d="m14 23 9 8 9-16 9 16 9-8-4 23H18Z" /><path d="M19 51h26" /></>;
  if (motif === "leaf") return <><path d="M49 15C30 15 18 25 17 44c18 2 31-9 32-29Z" /><path d="M17 49c8-12 16-19 27-27" /></>;
  if (motif === "column") return <><path d="M18 13h28M21 19h22M23 19v27M32 19v27M41 19v27M19 46h26M16 52h32" /></>;
  if (motif === "shield") return <><path d="M32 10 49 17v13c0 12-7 20-17 25-10-5-17-13-17-25V17Z" /><path d="M24 32h16M32 24v16" /></>;
  if (motif === "return") return <><path d="M49 26A19 19 0 1 0 50 41" /><path d="m40 16 9 10 5-13" /><path d="M22 41c5-8 13-12 21-9" /></>;
  return <><path d="m15 39 8-18 9 23 8-29 9 24" /><circle cx="15" cy="39" r="3" /><circle cx="23" cy="21" r="3" /><circle cx="32" cy="44" r="3" /><circle cx="40" cy="15" r="3" /><circle cx="49" cy="39" r="3" /></>;
}

export function AchievementSigil({ motif, artwork, unlocked, concealed, label }: AchievementSigilProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const move = (event: PointerEvent<HTMLSpanElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -8, y: ((event.clientX - bounds.left) / bounds.width - .5) * 8 });
  };
  return (
    <span
      className={`achievement-sigil${unlocked ? " unlocked" : " locked"}`}
      style={{ "--achievement-tilt-x": `${tilt.x}deg`, "--achievement-tilt-y": `${tilt.y}deg` } as CSSProperties}
      role="img"
      aria-label={label}
      onPointerMove={move}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        {!concealed ? <image className="achievement-sigil-art" href={artwork} x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet" /> : null}
        {concealed ? <>
          <circle className="achievement-sigil-orbit" cx="32" cy="32" r="27" />
          <circle className="achievement-sigil-field" cx="32" cy="32" r="22" />
          <g className="achievement-sigil-motif"><AchievementMotif motif={motif} /></g>
        </> : null}
        {!unlocked ? <path className="achievement-sigil-lock" d="M26 31v-4a6 6 0 0 1 12 0v4m-15 0h18v14H23Z" /> : null}
      </svg>
    </span>
  );
}
