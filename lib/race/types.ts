export const RESULT_STATUSES = ["finished", "timeUp", "abandoned"] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

/**
 * `t` in ms since the start. `errors` counts the wrong keystrokes so far;
 * races saved before it was recorded don't have it.
 */
export type WpmPoint = { t: number; wpm: number; errors?: number };
