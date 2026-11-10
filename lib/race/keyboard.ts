/** QWERTY rows, unshifted. Other characters (accents, quotes...) are listed apart. */
export const KEYBOARD_ROWS = [
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
] as const;

export const SPACE_KEY = " ";

const SHIFTED: Record<string, string> = {
  "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8",
  "(": "9", ")": "0", _: "-", "+": "=", "{": "[", "}": "]", ":": ";", '"': "'", "<": ",",
  ">": ".", "?": "/",
};

const ON_KEYBOARD = new Set<string>([...KEYBOARD_ROWS.flat(), SPACE_KEY]);

/** The key a character is typed with, or null when it isn't on the QWERTY rows. */
export function keyFor(char: string): string | null {
  const lower = SHIFTED[char] ?? (char.length === 1 && /[A-Z]/.test(char) ? char.toLowerCase() : char);
  return ON_KEYBOARD.has(lower) ? lower : null;
}

/**
 * Misses per key: a capital counts on its letter, "?" on "/". Characters
 * with no key of their own stay apart, most missed first.
 */
export function missesByKey(missed: Record<string, number>): {
  keys: Map<string, number>;
  others: { char: string; misses: number }[];
} {
  const keys = new Map<string, number>();
  const others = new Map<string, number>();
  for (const [char, count] of Object.entries(missed)) {
    if (count <= 0) {
      continue;
    }
    const key = keyFor(char);
    const target = key === null ? others : keys;
    const name = key ?? char;
    target.set(name, (target.get(name) ?? 0) + count);
  }
  return {
    keys,
    others: [...others]
      .map(([char, misses]) => ({ char, misses }))
      .sort((a, b) => b.misses - a.misses || a.char.localeCompare(b.char)),
  };
}

/** 0 for no misses, then 1 to `steps` by share of the most-missed key. */
export function heatLevel(misses: number, most: number, steps = 4): number {
  if (misses <= 0 || most <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil((misses / most) * steps));
}
