/** How a participant's race ended (RES-02). */
export const RESULT_STATUSES = ["finished", "timeUp", "abandoned"] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

/** One sample of a participant's net WPM, `t` in ms since the start (RES-03, RES-05). */
export type WpmPoint = { t: number; wpm: number };
