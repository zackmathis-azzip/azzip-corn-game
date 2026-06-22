"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  TIMELINE_DURATION_SEC,
  TIMELINE_KERNELS,
  TIMELINE_PRIZE_SPOTS,
  TIMELINE_STARTED_AT,
  TIMELINE_TOTAL_ACTIVE,
} from "@/lib/timeline-data";
import { getHuskCells, type HuskLeaf } from "@/lib/cob-mask";
import { huskColor } from "@/lib/kernel-colors";
import {
  SPONSOR_AZZIP_LOGO_URL,
  SPONSOR_OLD_MAJOR_TIMELINE_URL,
} from "@/lib/config";

const HUSK_SEED = 1337;
const SPEEDS = [30, 60, 120, 300] as const;

const CORN = {
  unclicked: "#f3b21c",
  clickedFill: "rgba(60,42,24,0.5)",
  prize: "#ffffff",
  prizeRing: "#f0c000",
  boardBg: "#181106",
  kernelStroke: "rgba(0,0,0,0.45)",
  logo: "#f4e3b2",
};

const HUSKS = getHuskCells("desktop");

let MIN_COL = Infinity;
let MAX_COL = -Infinity;
let MIN_ROW = Infinity;
let MAX_ROW = -Infinity;
for (const k of TIMELINE_KERNELS) {
  if (k[0] < MIN_COL) MIN_COL = k[0];
  if (k[0] > MAX_COL) MAX_COL = k[0];
  if (k[1] < MIN_ROW) MIN_ROW = k[1];
  if (k[1] > MAX_ROW) MAX_ROW = k[1];
}
for (const h of HUSKS) {
  if (h.col < MIN_COL) MIN_COL = h.col;
  if (h.col > MAX_COL) MAX_COL = h.col;
  if (h.row < MIN_ROW) MIN_ROW = h.row;
  if (h.row > MAX_ROW) MAX_ROW = h.row;
}

const CELL_W = 12;
const CELL_H = 15;
const VIEW_W = (MAX_COL - MIN_COL + 1) * CELL_W;
const VIEW_H = (MAX_ROW - MIN_ROW + 1) * CELL_H;

const STARTED_LABEL = `${new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
}).format(new Date(TIMELINE_STARTED_AT))} ET`;

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function huskTransform(leaf: HuskLeaf, depth: number, cx: number, cy: number): string {
  let deg = 0;
  let dx = 0;
  let dy = 0;
  if (leaf === "back") {
    deg = -(8 + 6 * (depth - 1));
    dx = -(0.16 + 0.08 * (depth - 1)) * CELL_W;
  } else if (leaf === "top") {
    deg = -(18 + 9 * (depth - 1));
    dx = -(0.1 + 0.06 * (depth - 1)) * CELL_W;
    dy = -(0.16 + 0.08 * (depth - 1)) * CELL_H;
  } else {
    deg = 18 + 9 * (depth - 1);
    dx = -(0.1 + 0.06 * (depth - 1)) * CELL_W;
    dy = (0.16 + 0.08 * (depth - 1)) * CELL_H;
  }
  return `rotate(${deg} ${cx} ${cy}) translate(${dx} ${dy})`;
}

function TimelineBoard({ t }: { t: number }) {
  const progress = Math.min(1, t / TIMELINE_DURATION_SEC);
  const reveal = 0.28 + 0.62 * progress;
  const oldMajorShow = 0.42 + 0.58 * Math.pow(progress, 0.75);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      className="timeline-board-svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Corn cob kernel grid replay with husk leaves and sponsor reveal"
    >
      <defs>
        <filter id="timeline-azzip-bright" x="-25%" y="-25%" width="150%" height="150%">
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.35" intercept="0.14" />
            <feFuncG type="linear" slope="1.35" intercept="0.12" />
            <feFuncB type="linear" slope="1.2" intercept="0.08" />
          </feComponentTransfer>
        </filter>
        <filter
          id="timeline-old-major-bright"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="2.15 0 0 0 0.07
                    0 0.92 0 0 0
                    0 0.92 0 0 0
                    1.2 -0.22 -0.22 0 -0.045"
          />
        </filter>
      </defs>
      <g opacity={reveal} aria-hidden="true">
        <image
          href={SPONSOR_AZZIP_LOGO_URL}
          x={VIEW_W * (0.24 - 0.21)}
          y={VIEW_H * (0.5 - 0.36)}
          width={VIEW_W * 0.42}
          height={VIEW_H * 0.72}
          opacity={0.92}
          filter="url(#timeline-azzip-bright)"
          preserveAspectRatio="xMidYMid meet"
        />
        <text
          x={VIEW_W * 0.5}
          y={VIEW_H * 0.53}
          textAnchor="middle"
          fontSize={VIEW_H * 0.12}
          fontWeight={600}
          fill={CORN.logo}
          opacity={0.38}
          fontFamily="system-ui, sans-serif"
        >
          ×
        </text>
        <g opacity={oldMajorShow}>
          <image
            href={SPONSOR_OLD_MAJOR_TIMELINE_URL}
            x={VIEW_W * (0.76 - 0.16)}
            y={VIEW_H * (0.5 - 0.29)}
            width={VIEW_W * 0.32}
            height={VIEW_H * 0.58}
            opacity={0.72 + 0.28 * progress}
            filter="url(#timeline-old-major-bright)"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      </g>

      {HUSKS.map((h, i) => {
        const x = (h.col - MIN_COL) * CELL_W;
        const y = (h.row - MIN_ROW) * CELL_H;
        const cx = x + CELL_W / 2;
        const cy = y + CELL_H / 2;
        return (
          <rect
            key={`h${i}`}
            x={x + 1}
            y={y + 1}
            width={CELL_W - 2}
            height={CELL_H - 2}
            rx={3}
            fill={huskColor(h.row, h.col, HUSK_SEED)}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.5}
            transform={huskTransform(h.leaf, h.depth, cx, cy)}
          />
        );
      })}

      {TIMELINE_KERNELS.map((k, i) => {
        const [col, row, flags, tSec] = k;
        const isPrize = (flags & 1) === 1;
        const clicked = tSec >= 0 && tSec <= t;
        const fill = clicked
          ? isPrize
            ? CORN.prize
            : CORN.clickedFill
          : CORN.unclicked;
        const x = (col - MIN_COL) * CELL_W;
        const y = (row - MIN_ROW) * CELL_H;
        return (
          <rect
            key={i}
            x={x + 0.8}
            y={y + 0.8}
            width={CELL_W - 1.6}
            height={CELL_H - 1.6}
            rx={2.6}
            fill={fill}
            stroke={clicked && isPrize ? CORN.prizeRing : CORN.kernelStroke}
            strokeWidth={clicked && isPrize ? 1.2 : 0.5}
          />
        );
      })}
    </svg>
  );
}

function LegendDot({
  color,
  ring,
  label,
}: {
  color: string;
  ring?: string;
  label: string;
}) {
  return (
    <span className="timeline-legend-item">
      <span
        className="timeline-legend-swatch"
        style={{ background: color, borderColor: ring ?? "rgba(0,0,0,0.4)" }}
      />
      {label}
    </span>
  );
}

export function CornTimeline() {
  const [speed, setSpeed] = useState<number>(120);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      lastRef.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= TIMELINE_DURATION_SEC) {
          setPlaying(false);
          return TIMELINE_DURATION_SEC;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  const { clicked, prizesGiven } = useMemo(() => {
    let c = 0;
    let p = 0;
    for (const k of TIMELINE_KERNELS) {
      if (k[3] >= 0 && k[3] <= t) {
        c++;
        if ((k[2] & 1) === 1) p++;
      }
    }
    return { clicked: c, prizesGiven: p };
  }, [t]);

  const atEnd = t >= TIMELINE_DURATION_SEC;
  const pace = (TIMELINE_TOTAL_ACTIVE / (TIMELINE_DURATION_SEC / 60)).toFixed(1);

  const togglePlay = () => {
    if (atEnd) setT(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="timeline-content">
      <div className="timeline-stats">
        <div className="timeline-stat">
          <span className="timeline-stat-value">{TIMELINE_TOTAL_ACTIVE.toLocaleString()}</span>
          <span className="timeline-stat-label">Kernels on the cob</span>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-value">{TIMELINE_PRIZE_SPOTS}</span>
          <span className="timeline-stat-label">Prize kernels</span>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-value">{fmt(TIMELINE_DURATION_SEC)}</span>
          <span className="timeline-stat-label">Time to clear board</span>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-value">{pace}/min</span>
          <span className="timeline-stat-label">Average pick pace</span>
        </div>
      </div>

      <div className="timeline-controls">
        <button type="button" className="timeline-btn timeline-btn--primary" onClick={togglePlay}>
          {playing ? "Pause" : atEnd ? "Replay" : "Play"}
        </button>
        <button
          type="button"
          className="timeline-btn"
          onClick={() => {
            setPlaying(false);
            setT(0);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className="timeline-btn"
          onClick={() => {
            setPlaying(false);
            setT(TIMELINE_DURATION_SEC);
          }}
        >
          Jump to end
        </button>
        <span className="timeline-speed-label">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`timeline-pill${speed === s ? " timeline-pill--active" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="timeline-scrubber-wrap">
        <input
          type="range"
          className="timeline-scrubber"
          min={0}
          max={TIMELINE_DURATION_SEC}
          step={1}
          value={Math.round(t)}
          onChange={(e) => {
            setPlaying(false);
            setT(Number(e.target.value));
          }}
          aria-label="Scrub timeline"
        />
        <div className="timeline-scrubber-meta">
          <span>
            Elapsed {fmt(t)} / {fmt(TIMELINE_DURATION_SEC)}
          </span>
          <span>
            {clicked.toLocaleString()} of {TIMELINE_TOTAL_ACTIVE.toLocaleString()} kernels picked ·{" "}
            {prizesGiven} of {TIMELINE_PRIZE_SPOTS} prizes won
          </span>
        </div>
      </div>

      <div className="timeline-board-wrap">
        <TimelineBoard t={t} />
      </div>

      <div className="timeline-legend">
        <LegendDot color={CORN.unclicked} label="Unpicked kernel" />
        <LegendDot color="#4a3422" label="Picked (no prize)" />
        <LegendDot color={CORN.prize} ring={CORN.prizeRing} label="Prize won" />
        <LegendDot color="#3d6b35" label="Husk leaf (decorative)" />
      </div>

      <p className="timeline-caption">
        Source: production campaign data · launched {STARTED_LABEL} · {fmt(TIMELINE_DURATION_SEC)}{" "}
        from first to last pick. Husk leaves are decorative — husk clicks were never logged.
      </p>

      <p className="timeline-back">
        <Link href="/">← Back to the game</Link>
      </p>
    </div>
  );
}
