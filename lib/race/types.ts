export const RESULT_STATUSES = ["finished", "timeUp", "abandoned"] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

/** `t` in ms since the start. */
export type WpmPoint = { t: number; wpm: number };
