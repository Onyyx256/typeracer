import type { ReactNode } from "react";

export type Bar = {
  id: string;
  label: ReactNode;
  value: number;
  /** The value as read on screen, at the bar's tip. */
  display: string;
};

/** Horizontal bars, each value printed at its tip, so no hover is needed to read them. */
export function BarList({ bars, labelClassName = "" }: { bars: Bar[]; labelClassName?: string }) {
  const largest = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <ol className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
      {bars.map((bar) => (
        <li
          key={bar.id}
          className="col-span-2 grid grid-cols-subgrid items-center text-sm"
        >
          <span className={`min-w-8 text-right ${labelClassName}`}>{bar.label}</span>
          <span className="flex items-center gap-2">
            {bar.value > 0 && (
              <span
                aria-hidden="true"
                className="h-4 shrink-0 rounded-r bg-chart-1"
                style={{ width: `calc((100% - 6rem) * ${bar.value / largest})` }}
              />
            )}
            <span className="font-mono text-xs whitespace-nowrap text-muted tabular-nums">{bar.display}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
