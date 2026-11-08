import { afterAll, describe, expect, test } from "bun:test";
import { createTestAccount, createTestGuest, deleteTestUsers, uniqueName } from "@/test/db";
import { findProfile, isAccountUsername, setGuestNickname } from "./users";

// Runs against the typeracer_test database (see test/setup.ts).

afterAll(deleteTestUsers);

describe("isAccountUsername (AUTH-02)", () => {
  test("another account's username is taken, whatever its case", async () => {
    const account = await createTestAccount();
    const visitor = await createTestGuest();
    expect(await isAccountUsername(account.username, visitor.id)).toBe(true);
    expect(await isAccountUsername(account.username.toUpperCase(), visitor.id)).toBe(true);
    expect(await isAccountUsername(account.username, null)).toBe(true);
  });

  test("your own username is always yours to use", async () => {
    const account = await createTestAccount();
    expect(await isAccountUsername(account.username, account.id)).toBe(false);
    expect(await isAccountUsername(account.username.toUpperCase(), account.id)).toBe(false);
  });

  test("a name no account uses is free", async () => {
    expect(await isAccountUsername(uniqueName("free"), null)).toBe(false);
  });

  test("a guest's nickname doesn't reserve the name", async () => {
    const nickname = uniqueName("g");
    await createTestGuest(nickname);
    expect(await isAccountUsername(nickname, null)).toBe(false);
  });
});

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
