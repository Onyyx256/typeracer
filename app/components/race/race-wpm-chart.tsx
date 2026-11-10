"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChartWidth } from "@/app/components/charts/use-chart-width";
import type { WpmPoint } from "@/lib/race/types";
import { niceScale } from "@/lib/stats/series";

export type RaceWpmRunner = {
  id: string;
  name: string;
  you: boolean;
  series: WpmPoint[];
};

export type RaceWpmLabels = {
  axis: string;
  /** "{seconds}" filled in. */
  time: string;
  others: string;
  you: string;
  summary: string;
};

const COLORS = 8;
const HEIGHT = 280;
const MARGIN = { top: 12, right: 16, bottom: 36, left: 44 };
const TOOLTIP_ROWS = 8;

/** Past the 8th runner, lines are gray and grouped as "others" in the legend. */
function colorOf(index: number): string {
  return index < COLORS ? `var(--series-${index + 1})` : "var(--muted)";
}

export function RaceWpmChart({
  runners,
  labels,
  locale,
}: {
  runners: RaceWpmRunner[];
  labels: RaceWpmLabels;
  locale: string;
}) {
  const { ref, width, measured } = useChartWidth();
  const [active, setActive] = useState<number | null>(null);

  const times = [...new Set(runners.flatMap((runner) => runner.series.map((point) => point.t)))].sort(
    (a, b) => a - b,
  );
  if (times.length === 0) {
    return null;
  }
  const values = runners.flatMap((runner) => runner.series.map((point) => point.wpm));
  const scale = niceScale(Math.min(...values), Math.max(...values));
  const lastSecond = times[times.length - 1] / 1000;
  // The axis ends with the race, not at the next round number.
  const xScale = { max: lastSecond, ticks: niceScale(0, lastSecond, 6).ticks.filter((tick) => tick <= lastSecond) };
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (ms: number) => MARGIN.left + (ms / 1000 / xScale.max) * plotWidth;
  const y = (wpm: number) => MARGIN.top + plotHeight - ((wpm - scale.min) / (scale.max - scale.min)) * plotHeight;
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const seconds = (ms: number) => labels.time.replace("{seconds}", format(ms / 1000));

  function nearest(event: PointerEvent<SVGSVGElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const ms = ((event.clientX - box.left - MARGIN.left) / plotWidth) * xScale.max * 1000;
    let best = 0;
    for (let index = 1; index < times.length; index++) {
      if (Math.abs(times[index] - ms) < Math.abs(times[best] - ms)) {
        best = index;
      }
    }
    return best;
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const last = times.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    }
  }

  const activeTime = active === null ? null : times[active];
  const readings =
    activeTime === null
      ? []
      : runners
          .map((runner, index) => ({
            runner,
            index,
            point: runner.series.find((point) => point.t === activeTime),
          }))
          .flatMap(({ runner, index, point }) => (point ? [{ runner, index, wpm: point.wpm }] : []))
          .sort((a, b) => b.wpm - a.wpm);
  const announcement =
    activeTime === null
      ? ""
      : `${seconds(activeTime)}, ${readings.map((reading) => `${reading.runner.name} ${format(reading.wpm)}`).join(", ")}`;
  const colored = runners.slice(0, COLORS);
  // The player is drawn last, so their line stays on top.
  const drawOrder = runners
    .map((runner, index) => ({ runner, index }))
    .sort((a, b) => Number(a.runner.you) - Number(b.runner.you) || b.index - a.index);

  return (
    <figure className="grid gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {colored.map((runner, index) => (
          <li key={runner.id} className="flex items-center gap-2">
            <svg width="16" height="12" aria-hidden="true">
              <line
                x1="1"
                y1="6"
                x2="15"
                y2="6"
                stroke={colorOf(index)}
                strokeWidth={runner.you ? 3 : 2}
                strokeLinecap="round"
              />
            </svg>
            <span className={runner.you ? "font-medium text-foreground" : ""}>
              {runner.name}
              {runner.you && ` (${labels.you})`}
            </span>
          </li>
        ))}
        {runners.length > COLORS && (
          <li className="flex items-center gap-2">
            <svg width="16" height="12" aria-hidden="true">
              <line x1="1" y1="6" x2="15" y2="6" stroke={colorOf(COLORS)} strokeWidth="1" strokeLinecap="round" />
            </svg>
            {labels.others}
          </li>
        )}
      </ul>

      <div ref={ref} className="relative overflow-hidden">
        <svg
          width={width}
          height={HEIGHT}
          tabIndex={0}
          role="img"
          aria-label={labels.summary}
          className={`block touch-pan-y rounded-md ${measured ? "" : "invisible"}`}
          onPointerMove={(event) => setActive(nearest(event))}
          onPointerDown={(event) => setActive(nearest(event))}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") {
              setActive(null);
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
          {xScale.ticks.map((tick) => (
            <text
              key={tick}
              x={x(tick * 1000)}
              y={HEIGHT - MARGIN.bottom + 18}
              textAnchor="middle"
              className="fill-muted font-mono text-[11px] tabular-nums"
            >
              {format(tick)}
            </text>
          ))}
          <text x={MARGIN.left + plotWidth / 2} y={HEIGHT - 2} textAnchor="middle" className="fill-muted text-[11px]">
            {labels.axis}
          </text>

          {activeTime !== null && (
            <line
              x1={x(activeTime)}
              x2={x(activeTime)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              className="stroke-muted"
              strokeWidth="1"
            />
          )}
          {drawOrder.map(({ runner, index }) => {
            const last = runner.series[runner.series.length - 1];
            if (!last) {
              return null;
            }
            const path = runner.series
              .map((point, step) => `${step === 0 ? "M" : "L"}${x(point.t).toFixed(1)},${y(point.wpm).toFixed(1)}`)
              .join("");
            return (
              <g key={runner.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={colorOf(index)}
                  strokeWidth={runner.you ? 3 : index < COLORS ? 2 : 1}
                  strokeOpacity={index < COLORS ? 1 : 0.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {index < COLORS && (
                  <circle
                    cx={x(last.t)}
                    cy={y(last.wpm)}
                    r="4"
                    fill={colorOf(index)}
                    strokeWidth="2"
                    className="stroke-background"
                  />
                )}
              </g>
            );
          })}
          {readings.map((reading) =>
            reading.index < COLORS && activeTime !== null ? (
              <circle
                key={reading.runner.id}
                cx={x(activeTime)}
                cy={y(reading.wpm)}
                r="4"
                fill={colorOf(reading.index)}
                strokeWidth="2"
                className="stroke-background"
              />
            ) : null,
          )}
        </svg>

        {activeTime !== null && readings.length > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-10 grid gap-1 border border-line bg-background px-3 py-2 text-sm whitespace-nowrap shadow-md rounded-leaf"
            style={
              x(activeTime) < width / 2
                ? { left: x(activeTime) + 12 }
                : { left: x(activeTime) - 12, transform: "translateX(-100%)" }
            }
          >
            <span className="font-mono text-xs text-muted">{seconds(activeTime)}</span>
            {readings.slice(0, TOOLTIP_ROWS).map((reading) => (
              <span key={reading.runner.id} className="flex items-center gap-2">
                <svg width="12" height="12" aria-hidden="true">
                  <line
                    x1="1"
                    y1="6"
                    x2="11"
                    y2="6"
                    stroke={colorOf(reading.index)}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <strong className="w-8 text-right tabular-nums">{format(reading.wpm)}</strong>
                <span className="text-muted">{reading.runner.name}</span>
              </span>
            ))}
            {readings.length > TOOLTIP_ROWS && (
              <span className="text-xs text-muted">+{readings.length - TOOLTIP_ROWS}</span>
            )}
          </div>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </figure>
  );
}
