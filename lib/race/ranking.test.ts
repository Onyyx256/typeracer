import { describe, expect, test } from "bun:test";
import { rank, type Rankable } from "./ranking";

type Entry = Rankable & { name: string };

function entry(name: string, status: Rankable["status"], progress: number, durationMs: number): Entry {
  return { name, status, progress, durationMs };
}

function names(entries: readonly Entry[]): string[] {
  return rank(entries).map((ranked) => ranked.name);
}

describe("rank", () => {
  test("puts finishers first, then time-ups, then those who gave up", () => {
    const entries = [
      entry("quit", "abandoned", 0.9, 10_000),
      entry("late", "timeUp", 0.5, 60_000),
      entry("done", "finished", 1, 50_000),
    ];
    expect(names(entries)).toEqual(["done", "late", "quit"]);
  });

  test("orders finishers by time, fastest first", () => {
    const entries = [
      entry("slow", "finished", 1, 40_000),
      entry("fast", "finished", 1, 20_000),
      entry("middle", "finished", 1, 30_000),
    ];
    expect(names(entries)).toEqual(["fast", "middle", "slow"]);
  });

  test("orders the others by progress, furthest first", () => {
    const entries = [
      entry("timeUpLow", "timeUp", 0.2, 60_000),
      entry("timeUpHigh", "timeUp", 0.8, 60_000),
      entry("quitLow", "abandoned", 0.1, 5_000),
      entry("quitHigh", "abandoned", 0.6, 30_000),
    ];
    expect(names(entries)).toEqual(["timeUpHigh", "timeUpLow", "quitHigh", "quitLow"]);
  });

  test("keeps the given order for ties", () => {
    const entries = [entry("first", "finished", 1, 30_000), entry("second", "finished", 1, 30_000)];
    expect(names(entries)).toEqual(["first", "second"]);
  });

  test("numbers the places from 1 and leaves the input alone", () => {
    const entries = [entry("b", "finished", 1, 20_000), entry("a", "finished", 1, 10_000)];
    expect(rank(entries).map((ranked) => ranked.rank)).toEqual([1, 2]);
    expect(entries.map((e) => e.name)).toEqual(["b", "a"]);
    expect(rank([])).toEqual([]);
  });
});
