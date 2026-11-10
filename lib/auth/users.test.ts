import { afterAll, describe, expect, test } from "bun:test";
import { createTestAccount, createTestGuest, deleteTestUsers, uniqueName } from "@/test/db";
import { findProfile, setGuestNickname } from "./users";


afterAll(deleteTestUsers);

describe("setGuestNickname (AUTH-02)", () => {
  test("changes a guest's default name", async () => {
    const guest = await createTestGuest();
    const nickname = uniqueName("g");
    await setGuestNickname(guest.id, nickname);
    expect((await findProfile(guest.id))?.displayName).toBe(nickname);
  });

  test("never touches an account", async () => {
    const account = await createTestAccount();
    const before = (await findProfile(account.id))?.displayName;
    await setGuestNickname(account.id, uniqueName("g"));
    expect((await findProfile(account.id))?.displayName).toBe(before);
  });
});
