import { afterEach, describe, expect, test } from "bun:test";
import { GUEST_WINDOW_MS, MAX_GUESTS, recordGuest, resetGuests, tooManyGuests } from "./guest-attempts";

afterEach(resetGuests);

const now = 1_000_000;

describe("guest creation attempts", () => {
  test("blocks an address once it made the most guests in the window", () => {
    for (let guest = 0; guest < MAX_GUESTS - 1; guest++) {
      recordGuest("1.2.3.4", now);
    }
    expect(tooManyGuests("1.2.3.4", now)).toBe(false);
    recordGuest("1.2.3.4", now);
    expect(tooManyGuests("1.2.3.4", now)).toBe(true);
    expect(tooManyGuests("5.6.7.8", now)).toBe(false);
  });

  test("the block lifts once the window is over", () => {
    for (let guest = 0; guest < MAX_GUESTS; guest++) {
      recordGuest("1.2.3.4", now);
    }
    expect(tooManyGuests("1.2.3.4", now + GUEST_WINDOW_MS)).toBe(false);
  });
});
