import { describe, expect, test } from "bun:test";
import { LOBBY_CHANNEL, roomChannel } from "./events";
import { changeClock, lastChange, notifyRoomChanged } from "./notify";

describe("last change times", () => {
  test("a room change is newer than a page rendered before it, for the room and the lobby", () => {
    const renderedAt = changeClock();
    notifyRoomChanged("ABC234");
    expect(lastChange(roomChannel("ABC234"))).toBeGreaterThanOrEqual(renderedAt);
    expect(lastChange(LOBBY_CHANNEL)).toBeGreaterThanOrEqual(renderedAt);
  });

  test("a room that hasn't changed has no time", () => {
    expect(lastChange(roomChannel("ZZZ999"))).toBeNull();
  });
});
