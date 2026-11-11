"use client";

import { Fragment } from "react";
import { heatLevel, KEYBOARD_ROWS, missesByKey, SPACE_KEY } from "@/lib/race/keyboard";

export type MissedKeysLabels = {
  none: string;
  fewer: string;
  more: string;
  otherChars: string;
  space: string;
  /** "{key}" and "{count}" filled in. */
  keyMisses: string;
  list: string;
};

const LEVELS = 4;
/** Share of the chart colour mixed into the background, per heat level. */
const MIX = [0, 22, 45, 70, 100];

function heatStyle(level: number) {
  return level === 0
    ? undefined
    : { background: `color-mix(in oklab, var(--chart-1) ${MIX[level]}%, var(--background))` };
}

function textClass(level: number): string {
  if (level === 0) {
    return "text-muted";
  }
  return level >= 3 ? "text-on-heat" : "text-foreground";
}

export function MissedKeys({
  missedKeys,
  labels,
  locale,
}: {
  missedKeys: Record<string, number>;
  labels: MissedKeysLabels;
  locale: string;
}) {
  const { keys, others } = missesByKey(missedKeys);
  const most = Math.max(0, ...keys.values(), ...others.map((entry) => entry.misses));
  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  const describe = (key: string, count: number) =>
    labels.keyMisses.replace("{key}", key === SPACE_KEY ? labels.space : key).replace("{count}", format(count));
  const ranked = [
    ...[...keys].map(([key, misses]) => ({ key, misses })),
    ...others.map((entry) => ({ key: entry.char, misses: entry.misses })),
  ].sort((a, b) => b.misses - a.misses);

  return (
    <div className="grid gap-4">
      {most === 0 ? (
        <p className="font-mono text-sm text-muted">&gt; {labels.none}</p>
      ) : (
        <>
          <div aria-hidden="true" className="grid w-full max-w-2xl gap-1 overflow-x-auto font-mono text-sm">
            {KEYBOARD_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1" style={{ paddingLeft: `${rowIndex * 0.6}rem` }}>
                {row.map((key) => {
                  const count = keys.get(key) ?? 0;
                  const level = heatLevel(count, most, LEVELS);
                  return (
                    <span
                      key={key}
                      title={count > 0 ? describe(key, count) : undefined}
                      style={heatStyle(level)}
                      className={`relative grid aspect-square min-w-0 flex-1 basis-0 place-items-center border border-line rounded-md ${textClass(level)}`}
                    >
                      {key}
                      {count > 0 && (
                        <span className="absolute right-1 bottom-0.5 hidden text-[9px] leading-none tabular-nums sm:block">
                          {format(count)}
                        </span>
                      )}
                    </span>
                  );
                })}
                {/* Keeps the rows' keys the same width. */}
                {Array.from({ length: KEYBOARD_ROWS[0].length - row.length }, (_, index) => (
                  <span key={`pad-${index}`} className="min-w-0 flex-1 basis-0" />
                ))}
              </div>
            ))}
            <div className="flex justify-center pr-[15%] pl-[20%]">
              {(() => {
                const count = keys.get(SPACE_KEY) ?? 0;
                const level = heatLevel(count, most, LEVELS);
                return (
                  <span
                    title={count > 0 ? describe(SPACE_KEY, count) : undefined}
                    style={heatStyle(level)}
                    className={`relative grid h-9 w-full place-items-center border border-line text-xs rounded-md ${textClass(level)}`}
                  >
                    {labels.space}
                    {count > 0 && (
                      <span className="absolute right-1.5 bottom-0.5 text-[9px] leading-none tabular-nums">
                        {format(count)}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
          </div>

          {others.length > 0 && (
            <div aria-hidden="true" className="grid gap-2">
              <span className="text-sm text-muted">{labels.otherChars}</span>
              <ul className="flex flex-wrap gap-1 font-mono text-sm">
                {others.map((entry) => {
                  const level = heatLevel(entry.misses, most, LEVELS);
                  return (
                    <li
                      key={entry.char}
                      title={describe(entry.char, entry.misses)}
                      style={heatStyle(level)}
                      className={`flex h-9 items-center gap-1.5 border border-line px-2.5 rounded-md ${textClass(level)}`}
                    >
                      {entry.char}
                      <span className="text-[10px] tabular-nums">{format(entry.misses)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div aria-hidden="true" className="flex items-center gap-2 text-xs text-muted">
            {labels.fewer}
            {MIX.slice(1).map((_, index) => (
              <span key={index} style={heatStyle(index + 1)} className="size-4 border border-line rounded-sm" />
            ))}
            {labels.more}
          </div>

          <p className="text-sm">
            <span className="text-muted">{labels.list}</span>{" "}
            {ranked.map((entry, index) => (
              <Fragment key={entry.key}>
                {index > 0 && <span className="text-muted"> · </span>}
                <span className="whitespace-nowrap">
                  <span className="font-mono">{entry.key === SPACE_KEY ? labels.space : entry.key}</span>{" "}
                  <span className="tabular-nums">{format(entry.misses)}</span>
                </span>
              </Fragment>
            ))}
          </p>
        </>
      )}
    </div>
  );
}
