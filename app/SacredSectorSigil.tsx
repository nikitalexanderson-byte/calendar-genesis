"use client";

import { useId, useState, type CSSProperties, type PointerEvent } from "react";
import { SACRED_PRACTICE_SECTOR_IDS, type SacredPracticeSectorId } from "./sacred-practices";

type SacredSectorSigilProps = {
  sectorId: SacredPracticeSectorId;
  className?: string;
  compact?: boolean;
  active?: boolean;
};

type SacredSectorMotif = {
  color: string;
  primary: string;
  secondary: string;
  tertiary?: string;
  nodes?: readonly [number, number, number][];
};

export const SACRED_SECTOR_SIGIL_MOTIFS: Readonly<Record<SacredPracticeSectorId, SacredSectorMotif>> = {
  north: {
    color: "#d9c37a",
    primary: "M30 68V48c0-17 9-27 20-32 11 5 20 15 20 32v20 M25 68h50",
    secondary: "M38 49c7-7 17-7 24 0-7 8-17 8-24 0 M50 25v12 M42 30l8-5 8 5",
    nodes: [[50, 49, 3]],
  },
  northeast: {
    color: "#a8d7cf",
    primary: "M63 20C39 25 30 47 40 68c7 14 24 18 37 8-17 2-31-7-35-21-5-15 2-28 21-35z",
    secondary: "M27 73 73 27 M55 27h18v18 M29 62l9 9",
    nodes: [[27, 73, 3]],
  },
  east: {
    color: "#e8c16d",
    primary: "M50 24v50 M50 37c-12-9-24-5-25 6 9-2 17 2 25 10 M50 37c12-9 24-5 25 6-9-2-17 2-25 10",
    secondary: "M38 26c2-9 8-12 12-12 4 0 10 3 12 12 M42 74h16 M36 54l14 11 14-11",
    nodes: [[50, 34, 3], [50, 65, 3]],
  },
  southeast: {
    color: "#e09a62",
    primary: "M25 65h50 M32 65l6-24h24l6 24 M39 41l11-17 11 17",
    secondary: "M23 31l12 7 M77 31l-12 7 M50 14v10 M29 74h42",
    nodes: [[23, 31, 2.5], [77, 31, 2.5]],
  },
  south: {
    color: "#d97a68",
    primary: "M50 18 59 36l-6-2v39l8 8H39l8-8V34l-6 2z",
    secondary: "M28 54c7-9 15-9 22 0 7-9 15-9 22 0 M34 62c5-6 11-6 16 0 5-6 11-6 16 0",
    nodes: [[50, 51, 3]],
  },
  southwest: {
    color: "#c9ad65",
    primary: "M50 20v60 M50 36c-9-11-17-11-23-9 4 10 11 15 23 16 M50 49c9-11 17-11 23-9-4 10-11 15-23 16 M50 61c-8-8-15-8-20-6 4 8 10 11 20 12",
    secondary: "M50 72c8-8 15-8 20-6-4 8-10 11-20 12",
    nodes: [[50, 20, 2.6]],
  },
  west: {
    color: "#73b9c1",
    primary: "M50 18v49 M37 29c0 11 4 18 13 23 9-5 13-12 13-23 M29 31l8-8 8 8 M55 31l8-8 8 8",
    secondary: "M19 69c10-8 20-8 31 0 11-8 21-8 31 0 M23 78c9-6 18-6 27 0 9-6 18-6 27 0",
    nodes: [[50, 52, 3]],
  },
  northwest: {
    color: "#f0c55f",
    primary: "M50 25a22 22 0 1 0 0 44 22 22 0 1 0 0-44 M50 15v10 M50 69v10 M18 47h10 M72 47h10 M27 24l7 7 M66 63l7 7 M73 24l-7 7 M34 63l-7 7",
    secondary: "M39 39c8-7 18-3 18 5 0 9-13 8-13 16 0 5 5 8 12 6",
    nodes: [[50, 47, 3]],
  },
  zenith: {
    color: "#f2d57f",
    primary: "M50 15 30 42h13L34 67l31-35H52z",
    secondary: "M23 76c9-7 18-7 27 0 9-7 18-7 27 0 M28 23c6-5 12-7 18-5 M72 23c-6-5-12-7-18-5",
    nodes: [[50, 15, 3]],
  },
  hearth: {
    color: "#ec9464",
    primary: "M50 18c4 16 19 22 16 39-2 13-10 22-16 26-11-4-19-13-18-26 1-10 7-18 15-25-2 12 3 18 8 21 8-9 8-20-5-35z",
    secondary: "M50 47c8 8 8 20 0 28-8-7-9-17 0-28 M34 82h32",
    nodes: [[50, 38, 2.5]],
  },
  nadir: {
    color: "#9a8dc2",
    primary: "M31 32a19 19 0 1 1 38 0 19 19 0 1 1-38 0 M50 51v28 M50 61h13v9h-8v9",
    secondary: "M27 80c8-7 15-7 23 0 8-7 15-7 23 0 M41 32h18",
    nodes: [[50, 32, 4]],
  },
  center: {
    color: "#d6b36a",
    primary: "M50 17 77 32v36L50 83 23 68V32z M50 28 66 37v20L50 66 34 57V37z",
    secondary: "M50 17v11 M77 32l-11 5 M77 68l-11-6 M50 83V66 M23 68l11-6 M23 32l11 5",
    nodes: [[50, 47, 4]],
  },
  entrance: {
    color: "#87c8ae",
    primary: "M24 78V30h52v48 M35 78V42h30v36 M50 42v36",
    secondary: "M18 78h64 M50 18v18 M41 27l9-9 9 9 M31 35c4-12 11-17 19-17 8 0 15 5 19 17",
    nodes: [[50, 54, 3]],
  },
  exit: {
    color: "#d2a0c2",
    primary: "M50 70c-8-18-20-25-29-22 7 1 13-2 17-8-8-7-9-16-5-23 12 2 20 10 17 25 5-15 13-23 25-25 4 7 3 16-5 23 4 6 10 9 17 8-9-3-21 4-29 22z",
    secondary: "M50 40v40 M38 78h24 M50 22v10",
    nodes: [[50, 39, 3]],
  },
};

export function SacredSectorSigil({ sectorId, className = "", compact = false, active = false }: SacredSectorSigilProps) {
  const rawId = useId();
  const uniqueId = rawId.replace(/:/g, "");
  const gradientId = `sacred-sector-gradient-${uniqueId}`;
  const glowId = `sacred-sector-glow-${uniqueId}`;
  const motif = SACRED_SECTOR_SIGIL_MOTIFS[sectorId];
  const sectorIndex = SACRED_PRACTICE_SECTOR_IDS.indexOf(sectorId);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [awakened, setAwakened] = useState(false);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
    const y = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;
    setTilt({ x: Math.round(y * -13), y: Math.round(x * 13) });
  };

  return (
    <div
      className={`sacred-sector-sigil${compact ? " compact" : ""}${active ? " active" : ""}${awakened ? " awakened" : ""}${className ? ` ${className}` : ""}`}
      style={{
        "--sector-sigil-color": motif.color,
        "--sector-tilt-x": `${tilt.x}deg`,
        "--sector-tilt-y": `${tilt.y}deg`,
        "--sector-phase": `${sectorIndex * -0.41}s`,
      } as CSSProperties}
      aria-hidden="true"
      data-sacred-sector-sigil={sectorId}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      onPointerDown={() => setAwakened((value) => !value)}
    >
      <svg viewBox="0 0 100 100" focusable="false">
        <defs>
          <radialGradient id={gradientId} cx="37%" cy="30%" r="70%">
            <stop offset="0" stopColor="#fff7dc" stopOpacity=".86" />
            <stop offset=".34" stopColor={motif.color} stopOpacity=".46" />
            <stop offset="1" stopColor={motif.color} stopOpacity=".03" />
          </radialGradient>
          <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="1.9" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle className="sacred-sector-sigil-halo" cx="50" cy="50" r="46" fill={`url(#${gradientId})`} />
        <g className="sacred-sector-sigil-orbit">
          <circle cx="50" cy="6" r="2" />
          <circle cx="91" cy="63" r="1.4" />
          <circle cx="20" cy="80" r="1.7" />
        </g>
        <path className="sacred-sector-sigil-compass" d="M50 6 54 46 94 50 54 54 50 94 46 54 6 50 46 46z" />
        <circle className="sacred-sector-sigil-ring outer" cx="50" cy="50" r="40" />
        <circle className="sacred-sector-sigil-ring inner" cx="50" cy="50" r="31" />
        <g className="sacred-sector-sigil-core" filter={`url(#${glowId})`}>
          <path d={motif.primary} />
          <path className="secondary" d={motif.secondary} />
          {motif.tertiary ? <path className="tertiary" d={motif.tertiary} /> : null}
          {motif.nodes?.map(([cx, cy, r], index) => <circle cx={cx} cy={cy} r={r} key={`${cx}-${cy}-${index}`} />)}
        </g>
      </svg>
    </div>
  );
}
