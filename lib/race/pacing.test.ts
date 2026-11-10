import { describe, expect, test } from "bun:test";
import { COUNTDOWN_MS, MAX_KEYS_PER_BATCH, Race, START_KEYS } from "./engine";
import { keysAllowed, SEND_BURST, spendAllowance, startAllowance } from "./pacing";

const T0 = 1_000_000;
const START = T0 + COUNTDOWN_MS;
const TEXT = "x".repeat(500);

function newRace() {
  return new Race({
    text: TEXT,
    errorMode: "strict",
    timeLimit: 0,
    participants: [
      { userId: "a", name: "Alice", isGuest: false },
      { userId: "b", name: "Bruno", isGuest: false },
    ],
    now: T0,
  });
}

/**
 * Sends `pending` keys every 150 ms like the typing area, paced, each
 * message reaching the server `delays[i]` ms after it was sent.
 */
function sendPaced(race: Race, from: number, pending: number, delays: (i: number) => number) {
  let allowance = startAllowance(START);
  let now = from;
  let left = pending;
  const results: boolean[] = [];
  for (let i = 0; left > 0 && i < 1000; i++, now += 150) {
    const count = Math.min(left, keysAllowed(allowance, now));
    if (count <= 0) {
      continue;
    }
    allowance = spendAllowance(allowance, now, count);
    left -= count;
    results.push(race.applyKeys("a", Array(count).fill("x"), now + delays(i)).ok);
  }
  return { results, left };
}

describe("send pacing", () => {
  test("starts with the server's allowance at the start", () => {
    expect(keysAllowed(startAllowance(START), START)).toBe(START_KEYS);
    // Before typing opens, nothing refills.
    expect(keysAllowed(startAllowance(START), START - 2000)).toBe(START_KEYS);
  });

  test("refills over time, up to the burst and the batch size", () => {
    const empty = spendAllowance(startAllowance(START), START, START_KEYS);
    expect(keysAllowed(empty, START)).toBe(0);
    expect(keysAllowed(empty, START + 200)).toBe(5);
    expect(keysAllowed(empty, START + 60_000)).toBe(Math.min(SEND_BURST, MAX_KEYS_PER_BATCH));
  });

  test("keys typed during a long disconnection all reach the server", () => {
    // 120 keys waiting when the connection comes back, 10 s into the race.
    const { results, left } = sendPaced(newRace(), START + 10_000, 120, () => 0);
    expect(left).toBe(0);
    expect(results.every(Boolean)).toBe(true);
  });

  test("still accepted when messages arrive bunched up", () => {
    // Every other message is delayed by 140 ms and arrives with the next one.
    const { results } = sendPaced(newRace(), START + 10_000, 200, (i) => (i % 2 === 0 ? 140 : 0));
    expect(results.every(Boolean)).toBe(true);
  });

  test("without pacing, the same backlog is refused", () => {
    const race = newRace();
    expect(race.applyKeys("a", Array(MAX_KEYS_PER_BATCH).fill("x"), START + 10_000).ok).toBe(false);
  });
});
