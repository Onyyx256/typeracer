import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { createTestAccount, deleteTestUsers, uniqueName } from "@/test/db";
import { installFakeIo, resetRealtime } from "@/test/realtime";
import { MAX_CODE_MISSES, recordCodeMiss, resetCodeMisses } from "./code-attempts";
import { invitePageMissing, roomPageMissing } from "./missing-pages";
import { createRoom } from "./rooms";
import { defaultRoomSettings, type Visibility } from "./settings";

afterEach(() => {
  resetCodeMisses();
  resetRealtime();
});
afterAll(deleteTestUsers);

const ip = "1.2.3.4";

async function hostRoom(visibility: Visibility) {
  installFakeIo();
  const host = await createTestAccount();
  const result = await createRoom(host.id, { ...defaultRoomSettings("en"), visibility }, false, uniqueName("h"));
  if (!result.ok) {
    throw new Error(`createRoom failed: ${result.error}`);
  }
  return { hostId: host.id, code: result.code };
}

describe("roomPageMissing", () => {
  test("a malformed or unknown code is missing", async () => {
    expect(await roomPageMissing("ab", null, ip)).toBe(true);
    expect(await roomPageMissing("ZZZZZZ", null, ip)).toBe(true);
  });

  test("a public or code-only room is there, whatever the case of the code", async () => {
    const open = await hostRoom("public");
    const coded = await hostRoom("code");
    expect(await roomPageMissing(open.code.toLowerCase(), null, ip)).toBe(false);
    expect(await roomPageMissing(coded.code, null, ip)).toBe(false);
  });

  test("a private room is missing to everyone but its members", async () => {
    const room = await hostRoom("private");
    const stranger = await createTestAccount();
    expect(await roomPageMissing(room.code, null, ip)).toBe(true);
    expect(await roomPageMissing(room.code, stranger.id, ip)).toBe(true);
    expect(await roomPageMissing(room.code, room.hostId, ip)).toBe(false);
  });

  test("over the miss limit, the page answers instead of the status", async () => {
    for (let miss = 0; miss < MAX_CODE_MISSES; miss++) {
      recordCodeMiss(ip);
    }
    expect(await roomPageMissing("ZZZZZZ", null, ip)).toBe(false);
  });
});

describe("invitePageMissing", () => {
  test("a malformed or unknown token is missing", async () => {
    expect(await invitePageMissing("xyz", null, ip)).toBe(true);
    expect(await invitePageMissing("a".repeat(43), null, ip)).toBe(true);
  });
});
