"use client";

import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChartWidth } from "@/app/components/charts/use-chart-width";
import { niceScale } from "@/lib/stats/series";

export type WpmChartPoint = {
  number: number;
  wpm: number;
  average: number;
  /** Already formatted on the server, in the players' time zone. */
  date: string;
  href: string;
};

export type WpmChartLabels = {
  raceSeries: string;
  averageSeries: string;
  axis: string;
  summary: string;
  open: string;
  /** "{number}", "{wpm}" filled in per point. */
  race: string;
  average: string;
  unit: string;
};

const HEIGHT = 260;
const MARGIN = { top: 12, right: 16, bottom: 36, left: 44 };

export function WpmChart({
  points,
  labels,
  locale,
}: {
  points: WpmChartPoint[];
  labels: WpmChartLabels;
  locale: string;
}) {
  const router = useRouter();
  const { ref: frame, width, measured } = useChartWidth();
  const [active, setActive] = useState<number | null>(null);

  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const scale = niceScale(
    Math.min(...points.map((point) => Math.min(point.wpm, point.average))),
    Math.max(...points.map((point) => Math.max(point.wpm, point.average))),
  );
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) =>
    MARGIN.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) =>
    MARGIN.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;

  const averagePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.average).toFixed(1)}`)
    .join("");
  const xTicks = pickTicks(points.length, Math.max(2, Math.floor(plotWidth / 70)));

  function nearest(event: PointerEvent<SVGSVGElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - box.left - MARGIN.left;
    if (points.length === 1) {
      return 0;
    }
    const index = Math.round((position / plotWidth) * (points.length - 1));
    return Math.min(points.length - 1, Math.max(0, index));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const last = points.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Enter" && active !== null) {
      router.push(points[active].href);
    }
  }

  const current = active === null ? null : points[active];
  const tooltipLeft = active === null ? 0 : x(active);

  return (
    <figure className="grid gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="4" className="fill-chart-1" />
          </svg>
          {labels.raceSeries}
        </li>
        <li className="flex items-center gap-2">
          <svg width="16" height="12" aria-hidden="true">
            <line x1="1" y1="6" x2="15" y2="6" strokeWidth="2" strokeLinecap="round" className="stroke-chart-2" />
          </svg>
          {labels.averageSeries}
        </li>
      </ul>

      <div ref={frame} className="relative overflow-hidden">
        <svg
          width={width}
          height={HEIGHT}
          tabIndex={0}
          role="img"
          aria-label={labels.summary}
          className={`block cursor-pointer touch-pan-y rounded-md ${measured ? "" : "invisible"}`}
          onPointerMove={(event) => setActive(nearest(event))}
          onPointerDown={(event) => setActive(nearest(event))}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") {
              setActive(null);
            }
          }}
          onClick={() => {
            if (current) {
              router.push(current.href);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-line"
                strokeWidth="1"
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted font-mono text-[11px] tabular-nums"
              >
                {format(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - MARGIN.bottom + 18}
              textAnchor="middle"
              className="fill-muted font-mono text-[11px] tabular-nums"
            >
              {points[index].number}
            </text>
          ))}
          <text
            x={MARGIN.left + plotWidth / 2}
            y={HEIGHT - 2}
            textAnchor="middle"
            className="fill-muted text-[11px]"
          >
            {labels.axis}
          </text>

          {current && active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              className="stroke-muted"
              strokeWidth="1"
            />
          )}
          {points.map((point, index) => (
            <circle
              key={point.href}
              cx={x(index)}
              cy={y(point.wpm)}
              r={index === active ? 6 : 4}
              strokeWidth="2"
              className="fill-chart-1 stroke-background"
            />
          ))}
          <path
            d={averagePath}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart-2"
          />
          {current && active !== null && (
            <circle
              cx={x(active)}
              cy={y(current.average)}
              r="4"
              strokeWidth="2"
              className="fill-chart-2 stroke-background"
            />
          )}
        </svg>

        {current && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-10 grid gap-1 border border-line bg-background px-3 py-2 text-sm whitespace-nowrap shadow-md rounded-leaf"
            style={
              tooltipLeft < width / 2
                ? { left: tooltipLeft + 12 }
                : { left: tooltipLeft - 12, transform: "translateX(-100%)" }
            }
          >
            <span className="font-mono text-xs text-muted">
              {labels.race.replace("{number}", String(current.number))} · {current.date}
            </span>
            <span className="flex items-center gap-2">
              <svg width="12" height="12" aria-hidden="true">
                <circle cx="6" cy="6" r="4" className="fill-chart-1" />
              </svg>
              <strong className="tabular-nums">
                {format(current.wpm)} {labels.unit}
              </strong>
            </span>
            <span className="flex items-center gap-2 text-muted">
              <svg width="12" height="12" aria-hidden="true">
                <line x1="1" y1="6" x2="11" y2="6" strokeWidth="2" strokeLinecap="round" className="stroke-chart-2" />
              </svg>
              <span className="tabular-nums">{labels.average.replace("{wpm}", format(current.average))}</span>
            </span>
          </div>
        )}
        <p aria-live="polite" className="sr-only">
          {current &&
            `${labels.race.replace("{number}", String(current.number))}, ${current.date}, ${format(current.wpm)} ${labels.unit}, ${labels.average.replace("{wpm}", format(current.average))}`}
        </p>
      </div>
      <figcaption className="text-sm text-muted">{labels.open}</figcaption>
    </figure>
  );
}

/** Evenly spread indices, always including the first and the last. */
function pickTicks(length: number, count: number): number[] {
  if (length <= count) {
    return Array.from({ length }, (_, index) => index);
  }
  const ticks = new Set<number>();
  for (let step = 0; step < count; step++) {
    ticks.add(Math.round((step / (count - 1)) * (length - 1)));
  }
  return [...ticks];
}
