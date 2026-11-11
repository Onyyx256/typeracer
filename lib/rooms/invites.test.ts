import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { createTestAccount, createTestGuest, deleteTestUsers, uniqueName } from "@/test/db";
import { resetRealtime } from "@/test/realtime";
import {
  createInvite,
  generateInviteToken,
  inviteTokenSchema,
  listInvites,
  lookUpInvite,
} from "./invites";
import { createRoom, deleteRoom, joinRoom, kickMember, leaveRoom } from "./rooms";
import { defaultRoomSettings, type RoomSettings } from "./settings";

afterEach(resetRealtime);
afterAll(deleteTestUsers);

const IP = "203.0.113.7";
const OTHER_IP = "198.51.100.4";

async function hostRoom(changes: Partial<RoomSettings> = {}) {
  const host = await createTestAccount();
  const settings = { ...defaultRoomSettings("en"), capacity: 5, visibility: "private", ...changes } as const;
  const result = await createRoom(host.id, settings, false, uniqueName("h"));
  if (!result.ok) {
    throw new Error(`createRoom failed: ${result.error}`);
  }
  return { hostId: host.id, code: result.code };
}

async function invite(hostId: string): Promise<string> {
  const result = await createInvite(hostId);
  if (!result.ok) {
    throw new Error(`createInvite failed: ${result.error}`);
  }
  return result.token;
}

async function joinWith(userId: string, code: string, token: string, ip = IP) {
  return joinRoom(userId, code, "participant", false, uniqueName("g"), { token, ip });
}

describe("invite tokens (SALLE-04)", () => {
  test("have 256 bits and are never the same twice", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateInviteToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
      expect(inviteTokenSchema.safeParse(token).success).toBe(true);
    }
  });
});

describe("createInvite (SALLE-04, SEC-01)", () => {
  test("the host of a private room gets a distinct link each time", async () => {
    const { hostId } = await hostRoom();
    const first = await invite(hostId);
    const second = await invite(hostId);
    expect(first).not.toBe(second);
  });

  test("a member who isn't host, or a stranger, can't make one", async () => {
    const { hostId, code } = await hostRoom();
    const guest = await createTestGuest();
    await joinWith(guest.id, code, await invite(hostId));
    expect(await createInvite(guest.id)).toEqual({ ok: false, error: "notHost" });
    expect(await createInvite((await createTestAccount()).id)).toEqual({ ok: false, error: "notHost" });
  });

  test("a public room has no links", async () => {
    const { hostId } = await hostRoom({ visibility: "public" });
    expect(await createInvite(hostId)).toEqual({ ok: false, error: "publicRoom" });
  });

  test("a code-only room has single-use links too (SALLE-03)", async () => {
    const { hostId, code } = await hostRoom({ visibility: "code" });
    const token = await invite(hostId);
    expect(await joinWith((await createTestGuest()).id, code, token)).toEqual({ ok: true, code });
    expect(await joinWith((await createTestGuest()).id, code, token)).toEqual({
      ok: false,
      error: "inviteUsed",
    });
  });
});

describe("joining with an invite (SALLE-04)", () => {
  test("the first person in uses the link up, from their address", async () => {
    const { hostId, code } = await hostRoom();
    const token = await invite(hostId);
    const first = await createTestGuest();
    expect(await joinWith(first.id, code, token)).toEqual({ ok: true, code });

    const second = await createTestGuest();
    expect(await lookUpInvite(token, second.id, IP)).toEqual({ ok: false, error: "inviteUsed" });
    expect(await joinWith(second.id, code, token)).toEqual({ ok: false, error: "inviteUsed" });
  });

  test("the same person can use it again after leaving, but only from the same address", async () => {
    const { hostId, code } = await hostRoom();
    const token = await invite(hostId);
    const guest = await createTestGuest();
    await joinWith(guest.id, code, token);
    await leaveRoom(guest.id);

    expect(await joinWith(guest.id, code, token, OTHER_IP)).toEqual({ ok: false, error: "inviteUsed" });
    expect(await lookUpInvite(token, guest.id, IP)).toEqual({ ok: true, code });
    expect(await joinWith(guest.id, code, token)).toEqual({ ok: true, code });
  });

  test("a refused join doesn't use the link up", async () => {
    const { hostId, code } = await hostRoom({ capacity: 2 });
    const filler = await createTestGuest();
    await joinWith(filler.id, code, await invite(hostId));
    const token = await invite(hostId);
    const late = await createTestGuest();
    expect(await joinWith(late.id, code, token)).toEqual({ ok: false, error: "full" });
    expect(await lookUpInvite(token, null, OTHER_IP)).toEqual({ ok: true, code });
  });

  test("a link only opens its own room", async () => {
    const own = await hostRoom();
    const other = await hostRoom();
    const token = await invite(own.hostId);
    const guest = await createTestGuest();
    expect(await joinWith(guest.id, other.code, token)).toEqual({ ok: false, error: "inviteInvalid" });
  });

  test("kicking someone revokes their link", async () => {
    const { hostId, code } = await hostRoom();
    const token = await invite(hostId);
    const guest = await createTestGuest();
    await joinWith(guest.id, code, token);
    await kickMember(hostId, guest.id);

    expect(await lookUpInvite(token, guest.id, IP)).toEqual({ ok: false, error: "inviteInvalid" });
    expect((await listInvites(hostId, code))[0]?.status).toBe("revoked");
  });

  test("every link stops working when the room closes", async () => {
    const { hostId, code } = await hostRoom();
    const used = await invite(hostId);
    const unused = await invite(hostId);
    const guest = await createTestGuest();
    await joinWith(guest.id, code, used);
    await deleteRoom(hostId);

    expect(await lookUpInvite(used, guest.id, IP)).toEqual({ ok: false, error: "inviteInvalid" });
    expect(await lookUpInvite(unused, null, IP)).toEqual({ ok: false, error: "inviteInvalid" });
    expect(await joinWith((await createTestGuest()).id, code, unused)).toEqual({
      ok: false,
      error: "inviteInvalid",
    });
  });

  test("an unknown token is invalid", async () => {
    expect(await lookUpInvite(generateInviteToken(), null, IP)).toEqual({
      ok: false,
      error: "inviteInvalid",
    });
  });
});

describe("listInvites (SALLE-04)", () => {
  test("shows each link's status and who accepted it, to the host only", async () => {
    const { hostId, code } = await hostRoom();
    const accepted = await invite(hostId);
    const pending = await invite(hostId);
    const guest = await createTestGuest();
    const name = uniqueName("g");
    await joinRoom(guest.id, code, "spectator", false, name, { token: accepted, ip: IP });

    expect(
      (await listInvites(hostId, code)).map(({ token, status, name }) => ({ token, status, name })),
    ).toEqual([
      { token: accepted, status: "accepted", name },
      { token: pending, status: "pending", name: null },
    ]);
    expect(await listInvites(guest.id, code)).toEqual([]);
  });
});
