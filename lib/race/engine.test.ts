import { describe, expect, test } from "bun:test";
import {
  BURST_KEYS,
  COUNTDOWN_MS,
  MAX_KEYS_PER_BATCH,
  MAX_KEYS_PER_SECOND,
  MAX_LAG_MS,
  Race,
  SAMPLE_MS,
  START_KEYS,
} from "./engine";
import { rank } from "./ranking";

const TEXT = "un deux trois";
const T0 = 1_000_000;
const START = T0 + COUNTDOWN_MS;

const PEOPLE = [
  { userId: "a", name: "Alice", isGuest: false },
  { userId: "b", name: "Bruno", isGuest: true },
  { userId: "c", name: "Chloé", isGuest: false },
];

function newRace(options: { timeLimit?: number; errorMode?: "strict" | "free" } = {}) {
  return new Race({
    text: TEXT,
    errorMode: options.errorMode ?? "strict",
    timeLimit: options.timeLimit ?? 0,
    participants: PEOPLE,
    now: T0,
  });
}

/** Types `text` in batches of 4 keys, 200 ms apart (about 240 WPM), from `from`. */
function typeSlowly(race: Race, userId: string, text: string, from: number): number {
  let now = from;
  const keys = [...text];
  for (let index = 0; index < keys.length; index += 4) {
    now += 200;
    expect(race.applyKeys(userId, keys.slice(index, index + 4), now).ok).toBe(true);
  }
  return now;
}

describe("ranking (COURSE-10)", () => {
  test("finishers by time, then unfinished by progress, then abandoned by progress", () => {
    const ranked = rank([
      { id: "abandoned-far", status: "abandoned" as const, progress: 0.9, durationMs: 1 },
      { id: "slow", status: "finished" as const, progress: 1, durationMs: 9000 },
      { id: "time-low", status: "timeUp" as const, progress: 0.2, durationMs: 5000 },
      { id: "abandoned-near", status: "abandoned" as const, progress: 0.1, durationMs: 1 },
      { id: "fast", status: "finished" as const, progress: 1, durationMs: 4000 },
      { id: "time-high", status: "timeUp" as const, progress: 0.7, durationMs: 5000 },
    ]);
    expect(ranked.map((entry) => entry.id)).toEqual([
      "fast",
      "slow",
      "time-high",
      "time-low",
      "abandoned-far",
      "abandoned-near",
    ]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("Race", () => {
  test("refuses keys during the countdown and from people who aren't racing", () => {
    const race = newRace();
    expect(race.applyKeys("a", ["u"], START - 1)).toEqual({ ok: false, reason: "notRacing" });
    expect(race.applyKeys("stranger", ["u"], START + 100)).toEqual({
      ok: false,
      reason: "notRacing",
    });
    expect(race.applyKeys("a", ["u"], START + 100).ok).toBe(true);
  });

  test("refuses a batch typed faster than a human could (COURSE-06)", () => {
    // A whole text sent right at the start is refused, and nothing moves.
    const race = newRace();
    expect(race.applyKeys("a", [...TEXT], START + 1)).toEqual({ ok: false, reason: "tooFast" });
    expect(race.playerState("a")?.input).toBe("");
    expect(race.applyKeys("a", Array(START_KEYS).fill("u"), START + 1).ok).toBe(true);

    const big = new Race({
      text: "a ".repeat(100),
      errorMode: "strict",
      timeLimit: 0,
      participants: PEOPLE,
      now: T0,
    });
    const keys = (count: number) => [..."a ".repeat(count)].slice(0, count);
    expect(big.applyKeys("a", keys(MAX_KEYS_PER_BATCH + 1), START + 60_000)).toEqual({
      ok: false,
      reason: "tooMany",
    });
    // After a pause the bucket is full again, but never above the burst size.
    expect(big.applyKeys("a", keys(BURST_KEYS + 2), START + 5000).ok).toBe(false);
    expect(big.applyKeys("a", keys(BURST_KEYS), START + 5000).ok).toBe(true);
    // The bucket is empty: 10 more keys 100 ms later are too fast.
    expect(big.applyKeys("a", keys(10), START + 5100)).toEqual({ ok: false, reason: "tooFast" });
    expect(big.track(START + 5100).find((entry) => entry.userId === "a")?.progress).toBeCloseTo(
      BURST_KEYS / 200,
    );
    // A second later, a normal pace is accepted again.
    expect(big.applyKeys("a", keys(MAX_KEYS_PER_SECOND), START + 6100).ok).toBe(true);
  });

  describe("speed judged on when the keys were typed", () => {
    const long = () =>
      new Race({ text: "a ".repeat(200), errorMode: "strict", timeLimit: 0, participants: PEOPLE, now: T0 });
    const keys = (count: number) => [..."a ".repeat(count)].slice(0, count);

    test("batches held by a network stall and delivered together are accepted", () => {
      const race = long();
      // 30 batches of 3 keys typed 150 ms apart (about 240 WPM) over 4.5 s,
      // all reaching the server in the same instant.
      const arrival = START + 10_000;
      const text = keys(90);
      for (let index = 0; index < 30; index++) {
        const typedAt = START + 5_500 + index * 150;
        const batch = text.slice(index * 3, index * 3 + 3);
        expect(race.applyKeys("a", batch, arrival, typedAt).ok).toBe(true);
      }
      expect(race.playerState("a")?.input).toHaveLength(90);
    });

    test("the same batches judged on arrival are refused", () => {
      const race = long();
      const results = Array.from({ length: 30 }, () => race.applyKeys("a", keys(3), START + 10_000).ok);
      expect(results.filter((ok) => !ok).length).toBeGreaterThan(0);
    });

    test("typing too fast is still refused, whatever the times say", () => {
      const race = long();
      // 60 keys claimed within half a second.
      const results = Array.from({ length: 20 }, (_, index) =>
        race.applyKeys("a", keys(3), START + 5_500, START + 5_000 + index * 25).ok,
      );
      expect(results.filter((ok) => !ok).length).toBeGreaterThan(0);
    });

    test("a time in the future counts as now", () => {
      const race = long();
      expect(race.applyKeys("a", keys(BURST_KEYS), START + 5_000).ok).toBe(true);
      // Claiming the batch was typed a minute from now doesn't refill the bucket.
      expect(race.applyKeys("a", keys(10), START + 5_100, START + 65_000)).toEqual({
        ok: false,
        reason: "tooFast",
      });
    });

    test("a time before the previous batch can't refill twice", () => {
      const race = long();
      expect(race.applyKeys("a", keys(BURST_KEYS), START + 5_000).ok).toBe(true);
      expect(race.applyKeys("a", keys(10), START + 5_100, START + 1_000)).toEqual({
        ok: false,
        reason: "tooFast",
      });
    });

    test("a batch older than the lag window counts as typed at its edge", () => {
      const race = long();
      expect(race.applyKeys("a", keys(BURST_KEYS), START + 30_000).ok).toBe(true);
      // Claimed 20 s ago: judged as typed MAX_LAG_MS ago, which is before the
      // last batch, so no refill.
      expect(race.applyKeys("a", keys(5), START + 30_100, START + 10_000).ok).toBe(false);
      expect(MAX_LAG_MS).toBeLessThan(20_000);
    });
  });

  test("a full race: finish order, WPM, accuracy and the end (COURSE-09)", () => {
    const race = newRace();
    const aliceDone = typeSlowly(race, "a", TEXT, START);
    expect(race.track(aliceDone).find((entry) => entry.userId === "a")?.status).toBe("finished");
    expect(race.isOver(aliceDone)).toBe(false);

    // Bruno makes one mistake and fixes it.
    const brunoDone = typeSlowly(race, "b", "ux\b" + TEXT.slice(1), START + 500);
    race.applyKeys("c", ["u", "n"], START + 300);
    expect(race.abandon("c", START + 4000)).toBe(true);
    expect(race.abandon("c", START + 5000)).toBe(false);
    expect(race.isOver(brunoDone)).toBe(true);

    const results = race.results(brunoDone);
    expect(results.map((entry) => [entry.name, entry.rank, entry.status])).toEqual([
      ["Alice", 1, "finished"],
      ["Bruno", 2, "finished"],
      ["Chloé", 3, "abandoned"],
    ]);
    const [alice, bruno, chloe] = results;
    expect(alice.durationMs).toBe(aliceDone - START);
    // 13 characters ÷ 5 ÷ (duration in minutes).
    expect(alice.wpm).toBeCloseTo(13 / 5 / ((aliceDone - START) / 60_000));
    expect(alice.accuracy).toBe(100);
    expect(alice.errors).toBe(0);
    expect(bruno.errors).toBe(1);
    expect(bruno.accuracy).toBeCloseTo((13 / 14) * 100);
    expect(bruno.rawWpm).toBeGreaterThan(bruno.wpm);
    expect(bruno.missedKeys).toEqual({ n: 1 });
    // Giving up leaves no accuracy (COURSE-07).
    expect(chloe.accuracy).toBeNull();
    expect(chloe.progress).toBeCloseTo(2 / TEXT.length);
    expect(chloe.durationMs).toBe(4000);
  });

  test("the time limit ends the race and ranks the unfinished by progress", () => {
    const race = newRace({ timeLimit: 30 });
    race.applyKeys("a", [..."un d"], START + 1000);
    race.applyKeys("b", [..."un deux"], START + 2000);
    const end = START + 30_000;
    expect(race.isOver(end - 1)).toBe(false);
    expect(race.isOver(end)).toBe(true);
    expect(race.applyKeys("c", ["u"], end).ok).toBe(false);

    const results = race.results(end + 500);
    expect(results.map((entry) => [entry.name, entry.status])).toEqual([
      ["Bruno", "timeUp"],
      ["Alice", "timeUp"],
      ["Chloé", "timeUp"],
    ]);
    // Measured up to the limit, not to when results were asked for.
    expect(results[0].durationMs).toBe(30_000);
  });

  test("samples each runner's WPM about once a second", () => {
    const race = newRace();
    for (let now = START; now <= START + 3500; now += 200) {
      race.tick(now);
    }
    const series = race.results(START + 3500)[0].wpmSeries;
    expect(series.map((point) => point.t)).toEqual([
      SAMPLE_MS,
      2 * SAMPLE_MS,
      3 * SAMPLE_MS,
      3500,
    ]);
  });

  test("gives back a runner's own typing, to resync their browser", () => {
    const race = newRace();
    race.applyKeys("a", ["u", "x"], START + 500);
    expect(race.playerState("a")).toEqual({
      text: TEXT,
      input: "ux",
      keystrokes: 2,
      correctKeystrokes: 1,
    });
    expect(race.playerState("nobody")).toBeNull();
  });
});

describe("catch-up bonuses (BONUS-01, BONUS-04)", () => {
  // 20 words of 4 letters: 99 characters, 25% is about 5 words.
  const LONG = Array.from({ length: 20 }, (_, index) => `w${String(index).padStart(3, "0")}`).join(" ");
  const RESERVE = "nuit noire lune ciel";

  function bonusRace(seed: number, bonuses = true) {
    return new Race({
      text: LONG,
      errorMode: "strict",
      timeLimit: 0,
      participants: PEOPLE.slice(0, 2),
      now: T0,
      bonuses: bonuses ? { seed, reserve: RESERVE } : null,
    });
  }

  /** Alice types the first `chars` characters; Bruno nothing. */
  function leadTo(race: Race, chars: number): number {
    return typeSlowly(race, "a", LONG.slice(0, chars), START);
  }

  test("nothing happens before the leader reaches 25%, or with bonuses off", () => {
    const race = bonusRace(1);
    const now = leadTo(race, 20);
    expect(race.tick(now)).toEqual([]);

    const off = bonusRace(1, false);
    expect(off.tick(leadTo(off, 80))).toEqual([]);
  });

  test("each checkpoint brings a bonus to the last runner and a hindrance to the leader", () => {
    const race = bonusRace(1);
    const at25 = leadTo(race, 30);
    const events = race.tick(at25);
    expect(events.map((event) => event.kind)[0]).toBe("rain");
    expect(events.map((event) => event.targets)).toEqual([["b"], ["a"]]);
    expect(race.tick(at25 + 200)).toEqual([]);

    // 50% and 75% fire together here, then never again.
    const later = typeSlowly(race, "a", LONG.slice(30, 95), at25);
    expect(race.tick(later)).toHaveLength(4);
    expect(race.tick(later + 200)).toEqual([]);
    const results = race.results(later + 400);
    expect(results.map((row) => row.bonuses.length)).toEqual([3, 3]);
    expect(results.find((row) => row.userId === "b")?.bonuses).toEqual(["rain", "rain", "rain"]);
  });

  /** A seed whose first hindrance is `kind`. */
  function raceWith(kind: string): { race: Race; now: number } {
    for (let seed = 0; seed < 100; seed++) {
      const race = bonusRace(seed);
      const now = leadTo(race, 30);
      if (race.tick(now).some((event) => event.kind === kind)) {
        return { race, now };
      }
    }
    throw new Error(`No seed gives ${kind}.`);
  }

  test("rain shortens the trailing runner's text, keeping progress and WPM consistent", () => {
    const { race, now } = raceWith("night");
    const bruno = race.playerState("b");
    // 10% of 20 words.
    expect(bruno?.text.split(" ")).toHaveLength(18);
    const entry = race.track(now).find((row) => row.userId === "b");
    expect(entry?.effect).toBe("rain");
    expect(entry?.progress).toBe(0);

    // Bruno now finishes after typing 18 words, and his progress is over his own text.
    const done = typeSlowly(race, "b", bruno?.text ?? "", now);
    const result = race.results(done).find((row) => row.userId === "b");
    expect(result?.status).toBe("finished");
    expect(result?.progress).toBe(1);
    expect(result?.bonuses).toEqual(["rain"]);
  });

  test("night lengthens the leader's text with the reserve words", () => {
    const { race, now } = raceWith("night");
    // 7% of 20 words, rounded: 1 word.
    expect(race.playerState("a")?.text).toBe(`${LONG} nuit`);
    const alice = race.track(now).find((row) => row.userId === "a");
    expect(alice?.effect).toBe("night");
    expect(alice?.progress).toBeCloseTo(30 / (LONG.length + 5));
  });

  test("glare only shows on the track while it lasts, and never changes the text", () => {
    const { race, now } = raceWith("glare");
    expect(race.playerState("a")?.text).toBe(LONG);
    expect(race.track(now + 4_000).find((row) => row.userId === "a")?.effect).toBe("glare");
    expect(race.track(now + 6_000).find((row) => row.userId === "a")?.effect).toBeNull();
  });

  test("the same seed gives the same bonuses", () => {
    const kinds = (seed: number) => {
      const race = bonusRace(seed);
      return race.tick(leadTo(race, 30)).map((event) => event.kind);
    };
    expect(kinds(42)).toEqual(kinds(42));
  });
});
