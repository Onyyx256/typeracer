import { afterEach, describe, expect, test } from "bun:test";
import {
  LOGIN_WINDOW_MS,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
  recordLoginFailure,
  resetLoginFailures,
  tooManyLoginFailures,
} from "./login-attempts";

afterEach(resetLoginFailures);

const now = 1_000_000;

function fail(times: number, ip: string, username: (attempt: number) => string) {
  for (let attempt = 0; attempt < times; attempt++) {
    recordLoginFailure(ip, username(attempt), now);
  }
}

describe("log-in attempts", () => {
  test("blocks an account from an address after 5 failures", () => {
    fail(MAX_FAILURES_PER_ACCOUNT - 1, "1.2.3.4", () => "alice");
    expect(tooManyLoginFailures("1.2.3.4", "alice", now)).toBe(false);
    recordLoginFailure("1.2.3.4", "alice", now);
    expect(tooManyLoginFailures("1.2.3.4", "alice", now)).toBe(true);
  });

  test("ignores the username's case", () => {
    fail(MAX_FAILURES_PER_ACCOUNT, "1.2.3.4", () => "Alice");
    expect(tooManyLoginFailures("1.2.3.4", "aLICE", now)).toBe(true);
  });

  test("the owner on another address can still log in", () => {
    fail(MAX_FAILURES_PER_ACCOUNT, "1.2.3.4", () => "alice");
    expect(tooManyLoginFailures("5.6.7.8", "alice", now)).toBe(false);
  });

  test("blocks an address trying many accounts", () => {
    fail(MAX_FAILURES_PER_IP, "1.2.3.4", (attempt) => `user${attempt}`);
    expect(tooManyLoginFailures("1.2.3.4", "someone-new", now)).toBe(true);
  });

  test("the block lifts once the window is over", () => {
    fail(MAX_FAILURES_PER_ACCOUNT, "1.2.3.4", () => "alice");
    expect(tooManyLoginFailures("1.2.3.4", "alice", now + LOGIN_WINDOW_MS)).toBe(false);
  });
});
