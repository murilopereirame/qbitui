"use client";

import { useId } from "react";
import { formatSpeed, cn } from "@/lib/utils";

interface Props {
  label: string;
  /** Samples oldest → newest; shorter series fill in from the right. */
  values: number[];
  capacity: number;
  current: number;
  /** Tailwind text colour class — the chart is drawn in `currentColor`. */
  colorClass: string;
  className?: string;
}

// The viewBox is stretched to the element's box, so strokes are drawn with
// non-scaling-stroke to keep them an even width.
const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 100;
const GRID_LINES = [0.25, 0.5, 0.75];

/** Download or upload speed over time, drawn as a filled line chart. */
export function SpeedChart({ label, values, capacity, current, colorClass, className }: Props) {
  const gradientId = useId();
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const scale = Math.max(peak, 1);

  // Newest sample sits at the right edge; a short series starts partway across.
  const step = VIEW_WIDTH / Math.max(capacity - 1, 1);
  const points = values.map((value, index) => {
    const x = VIEW_WIDTH - (values.length - 1 - index) * step;
    const y = VIEW_HEIGHT - (value / scale) * VIEW_HEIGHT;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = points.length > 1 ? `M ${points.join(" L ")}` : "";
  const area =
    points.length > 1
      ? `${line} L ${VIEW_WIDTH},${VIEW_HEIGHT} L ${(VIEW_WIDTH - (values.length - 1) * step).toFixed(2)},${VIEW_HEIGHT} Z`
      : "";

  return (
    <div className={cn("rounded-lg border border-line bg-surface p-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <span className={cn("text-sm font-semibold tabular-nums", colorClass)}>
          {formatSpeed(current)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className={cn("mt-2 h-24 w-full", colorClass)}
        role="img"
        aria-label={`${label} over the last samples, currently ${formatSpeed(current)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {GRID_LINES.map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2={VIEW_WIDTH}
            y1={VIEW_HEIGHT * fraction}
            y2={VIEW_HEIGHT * fraction}
            className="stroke-line"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="mt-1 flex justify-between text-[11px] text-fg-subtle tabular-nums">
        <span>avg {formatSpeed(average)}</span>
        <span>peak {formatSpeed(peak)}</span>
      </div>
    </div>
  );
}
