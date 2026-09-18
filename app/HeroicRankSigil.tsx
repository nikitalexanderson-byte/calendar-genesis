"use client";

import { useId, useState, type CSSProperties, type PointerEvent } from "react";
import { HEROIC_RANKS, type HeroicRankId } from "./habit-progress";

type HeroicRankSigilProps = {
  rankId: HeroicRankId | "unranked" | null;
  color: string;
  className?: string;
  compact?: boolean;
};

function starPoints(rays: number, outer = 32, inner = 15) {
  return Array.from({ length: rays * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / rays;
    const radius = index % 2 ? inner : outer;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  }).join(" ");
}

export function HeroicRankSigil({ rankId, color, className = "", compact = false }: HeroicRankSigilProps) {
  const rawId = useId();
  const gradientId = `rank-sigil-gradient-${rawId.replace(/:/g, "")}`;
  const glowId = `rank-sigil-glow-${rawId.replace(/:/g, "")}`;
  const rankIndex = Math.max(0, HEROIC_RANKS.findIndex((rank) => rank.id === rankId));
  const rays = 4 + rankIndex % 5;
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [awakened, setAwakened] = useState(0);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
    const y = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;
    setTilt({ x: Math.round(x * 12), y: Math.round(y * -12) });
  };

  return (
    <div
      className={`rank-sigil${compact ? " compact" : ""}${awakened % 2 ? " awakened" : ""}${className ? ` ${className}` : ""}`}
      style={{
        "--rank-color": color,
        "--sigil-tilt-x": `${tilt.x}deg`,
        "--sigil-tilt-y": `${tilt.y}deg`,
        "--sigil-phase": `${rankIndex * -0.37}s`,
      } as CSSProperties}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      onPointerDown={() => setAwakened((value) => value + 1)}
    >
      <svg viewBox="0 0 100 100" focusable="false">
        <defs>
          <radialGradient id={gradientId} cx="38%" cy="30%" r="72%">
            <stop offset="0" stopColor="#fff8dd" />
            <stop offset="0.34" stopColor={color} stopOpacity="0.95" />
            <stop offset="1" stopColor={color} stopOpacity="0.14" />
          </radialGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle className="rank-sigil-halo" cx="50" cy="50" r="45" />
        <g className="rank-sigil-orbit">
          <circle cx="50" cy="7" r="2.1" />
          <circle cx="93" cy="50" r="1.4" />
          <circle cx="50" cy="93" r="1.8" />
        </g>
        <circle className="rank-sigil-ring outer" cx="50" cy="50" r="37" />
        <circle className="rank-sigil-ring inner" cx="50" cy="50" r="27" />
        <g className="rank-sigil-core" filter={`url(#${glowId})`}>
          <polygon points={starPoints(rays, 25 + rankIndex * 0.32, 10 + (rankIndex % 3) * 2)} fill={`url(#${gradientId})`} />
          <circle cx="50" cy="50" r={5 + rankIndex * 0.18} />
          <path d={`M50 ${18 + rankIndex % 4} L54 43 L82 50 L54 57 L50 ${82 - rankIndex % 4} L46 57 L18 50 L46 43 Z`} />
        </g>
        <g className="rank-sigil-laurels">
          <path d="M25 73C14 61 13 43 22 29" />
          <path d="M75 73C86 61 87 43 78 29" />
          {[0, 1, 2, 3].map((leaf) => <circle key={leaf} cx={20 + leaf * 2} cy={62 - leaf * 9} r="2.2" />)}
          {[0, 1, 2, 3].map((leaf) => <circle key={leaf} cx={80 - leaf * 2} cy={62 - leaf * 9} r="2.2" />)}
        </g>
      </svg>
    </div>
  );
}
