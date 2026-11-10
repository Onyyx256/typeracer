import { describe, expect, test } from "bun:test";
import { createRng } from "@/lib/texts/rng";
import {
  appendWords,
  glareRange,
  joinRemoved,
  leadingRunners,
  MAX_BONUSES_PER_RUNNER,
  planBonuses,
  RAIN_MARGIN_WORDS,
  removableWords,
  removeLastWords,
  shareOfWords,
  trailingRunners,
  type BonusPlan,
  type Standing,
} from "./bonuses";

function standing(userId: string, progress: number, extra: Partial<Standing> = {}): Standing {
  return { userId, progress, racing: true, received: 0, removable: 10, ...extra };
}

const ids = (list: readonly { userId: string }[]) => list.map((entry) => entry.userId);

describe("shareOfWords", () => {
  test("is a rounded share of the original text, at least one word", () => {
    expect(shareOfWords(0.1, 50)).toBe(5);
    expect(shareOfWords(0.07, 50)).toBe(4);
    expect(shareOfWords(0.03, 10)).toBe(1);
    expect(shareOfWords(0.1, 200)).toBe(20);
  });
});

describe("trailingRunners", () => {
  test("is the last runner, and anyone more than 25% behind the leader", () => {
    const standings = [
      standing("a", 0.6),
      standing("b", 0.5),
      standing("c", 0.3),
      standing("d", 0.1),
    ];
    expect(ids(trailingRunners(standings))).toEqual(["c", "d"]);
  });

  test("never includes the leader, nor runners who stopped", () => {
    expect(trailingRunners([standing("a", 0.5)])).toEqual([]);
    const standings = [standing("a", 0.5), standing("b", 0.4), standing("c", 0, { racing: false })];
    expect(ids(trailingRunners(standings))).toEqual(["b"]);
  });

  test("gives it to everyone tied for last", () => {
    const standings = [standing("a", 0.5), standing("b", 0.4), standing("c", 0.4)];
    expect(ids(trailingRunners(standings))).toEqual(["b", "c"]);
  });
});

describe("leadingRunners", () => {
  test("is the top 3 still racing, best first, without trailing runners", () => {
    const standings = [
      standing("e", 0.1),
      standing("b", 0.55),
      standing("a", 0.6, { racing: false }),
      standing("c", 0.5),
      standing("d", 0.45),
    ];
    expect(ids(leadingRunners(standings))).toEqual(["b", "c", "d"]);
  });

  test("with two runners, only the first: the second is trailing", () => {
    expect(ids(leadingRunners([standing("a", 0.3), standing("b", 0.25)]))).toEqual(["a"]);
  });

  test("never holds someone who is also trailing", () => {
    const standings = [standing("a", 0.5), standing("b", 0.45), standing("c", 0.4)];
    const trailing = new Set(ids(trailingRunners(standings)));
    expect(ids(leadingRunners(standings)).some((id) => trailing.has(id))).toBe(false);
  });
});

describe("planBonuses", () => {
  const four = [standing("a", 0.6), standing("b", 0.5), standing("c", 0.45), standing("d", 0.1)];

  function plansFor(standings: readonly Standing[], seeds = 50) {
    return Array.from({ length: seeds }, (_, seed) => planBonuses(standings, 50, createRng(seed)));
  }
  const kindsOf = (plans: readonly BonusPlan[]) => plans.map((plan) => plan.kind);

  test("each checkpoint brings rain for the trailing runners and a hindrance for the leaders", () => {
    for (const plans of plansFor(four)) {
      const [rain, hindrance] = plans;
      expect(rain?.kind).toBe("rain");
      expect(["night", "glare"]).toContain(hindrance?.kind);
      expect(plans).toHaveLength(2);
    }
  });

  test("the hindrance is night or glare, at random", () => {
    const hindrances = new Set(plansFor(four).map((plans) => plans[1]?.kind));
    expect([...hindrances].sort()).toEqual(["glare", "night"]);
  });

  test("nobody gets both: the trailing runners are never hindered", () => {
    for (const [rain, hindrance] of plansFor(four)) {
      const helped = new Set(ids(rain?.targets ?? []));
      expect(ids(hindrance?.targets ?? []).some((id) => helped.has(id))).toBe(false);
    }
  });

  test("is the same for the same seed", () => {
    expect(planBonuses(four, 50, createRng(7))).toEqual(planBonuses(four, 50, createRng(7)));
  });

  test("rain takes 10% of the words off the trailing runners", () => {
    expect(planBonuses(four, 50, createRng(1))[0]?.targets).toEqual([{ userId: "d", words: 5 }]);
  });

  test("rain never takes more than what can be removed", () => {
    const standings = [standing("a", 0.6), standing("b", 0.1, { removable: 2 })];
    expect(planBonuses(standings, 50, createRng(1))[0]?.targets).toEqual([{ userId: "b", words: 2 }]);
  });

  test("night adds 7%, 5% and 3% to the first three", () => {
    const night = plansFor(four).find((plans) => plans[1]?.kind === "night")?.[1];
    expect(night?.targets).toEqual([
      { userId: "a", words: 4 },
      { userId: "b", words: 3 },
      { userId: "c", words: 2 },
    ]);
  });

  test("glare goes to the first three, adding no words", () => {
    const glare = plansFor(four).find((plans) => plans[1]?.kind === "glare")?.[1];
    expect(glare?.targets).toEqual([
      { userId: "a", words: 0 },
      { userId: "b", words: 0 },
      { userId: "c", words: 0 },
    ]);
  });

  test("skips runners who already received the maximum, keeping the others' places", () => {
    const standings = [
      standing("a", 0.6, { received: MAX_BONUSES_PER_RUNNER }),
      standing("b", 0.5),
      standing("c", 0.1, { received: MAX_BONUSES_PER_RUNNER }),
    ];
    const night = plansFor(standings).find((plans) => kindsOf(plans).includes("night"));
    // No rain (c is capped); b keeps the 2nd place's 5%.
    expect(night).toEqual([{ kind: "night", targets: [{ userId: "b", words: 3 }] }]);
  });

  test("leaves out what has nobody to apply to", () => {
    const capped = [
      standing("a", 0.6, { received: MAX_BONUSES_PER_RUNNER }),
      standing("b", 0.1, { removable: 0 }),
    ];
    expect(planBonuses(capped, 50, createRng(1))).toEqual([]);
    const onlyRain = [standing("a", 0.6, { received: MAX_BONUSES_PER_RUNNER }), standing("b", 0.1)];
    expect(kindsOf(planBonuses(onlyRain, 50, createRng(1)))).toEqual(["rain"]);
  });
});

describe("text changes", () => {
  const text = "un deux trois quatre cinq six sept";

  test("rain keeps the word being typed and a margin after it", () => {
    // Cursor in "deux" (word 1): keeps 1 + 1 + margin words.
    expect(removableWords(text, 4)).toBe(7 - (2 + RAIN_MARGIN_WORDS));
    expect(removableWords(text, text.length)).toBe(0);
  });

  test("removes the last words, never the whole text, and says which", () => {
    expect(removeLastWords(text, 2)).toEqual({ text: "un deux trois quatre cinq", removed: "six sept" });
    expect(removeLastWords("un deux", 5)).toEqual({ text: "un", removed: "deux" });
  });

  test("words cut by a later rain go before those cut earlier", () => {
    expect(joinRemoved("cinq", "six sept")).toBe("cinq six sept");
    expect(joinRemoved("six sept", "")).toBe("six sept");
  });

  test("appends words at the end", () => {
    expect(appendWords("un deux", ["trois", "quatre"])).toBe("un deux trois quatre");
    expect(appendWords("un deux", [])).toBe("un deux");
  });

  test("glare covers from the cursor to the end of the third word", () => {
    const [start, end] = glareRange(text, 3);
    expect(text.slice(start, end)).toBe("deux trois quatre");
    const [lastStart, lastEnd] = glareRange(text, 30);
    expect(text.slice(lastStart, lastEnd)).toBe("sept");
  });
});
