import * as z from "zod";

export const HISTORY_PAGE_SIZE = 10;

/** Anything that isn't a page number shows the first page. */
export const historyPageSchema = z.coerce.number().int().min(1).catch(1);

export function pageCount(total: number, pageSize = HISTORY_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Each point averages itself and up to `window - 1` points before it. */
export function movingAverage(values: readonly number[], window: number): number[] {
  const size = Math.max(1, Math.floor(window));
  let sum = 0;
  return values.map((value, index) => {
    sum += value;
    if (index >= size) {
      sum -= values[index - size];
    }
    return sum / Math.min(index + 1, size);
  });
}

/** Round axis bounds that keep every value inside, with `step`-sized ticks. */
export function niceScale(
  min: number,
  max: number,
  targetTicks = 4,
): { min: number; max: number; ticks: number[] } {
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(min, max, low + 1);
  const raw = (high - low) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = start; tick <= end + step / 2; tick += step) {
    ticks.push(Math.round(tick * 1000) / 1000);
  }
  return { min: start, max: end, ticks };
}

const KEY_NAMES: Record<string, string> = {
  " ": "␣",
  "\n": "↵",
  "\t": "⇥",
};

/** Invisible characters get a visible symbol. */
export function keyLabel(char: string): string {
  return KEY_NAMES[char] ?? char;
}
