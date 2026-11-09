import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { races, rooms } from "@/db/schema";
import { createRoom, joinRoom, leaveRoom } from "@/lib/rooms/rooms";
import { defaultRoomSettings, type RoomState } from "@/lib/rooms/settings";
import { createTestAccount, createTestGuest, deleteTestUsers, uniqueName } from "@/test/db";
import { installFakeIo, resetRealtime } from "@/test/realtime";
import { BACKSPACE } from "./typing";
import { abandonRace, closeRace, handleKeys, raceStateFor, startRace } from "./manager";
import { getLatestRaceResults } from "./results";

// Runs against the typeracer_test database (see test/setup.ts). Random
// texts, so no passage corpus is needed.

const codes: string[] = [];

afterEach(async () => {
  // Waits for the results to be saved, so afterAll can delete them.
  await Promise.all(codes.map(closeRace));
  resetRealtime();
});

afterAll(async () => {
  // Races outlive their room (room_id is set null), so they go first.
  const roomIds = await getDb().select({ id: rooms.id }).from(rooms).where(inArray(rooms.code, codes));
  if (roomIds.length > 0) {
    await getDb().delete(races).where(inArray(races.roomId, roomIds.map((room) => room.id)));
  }
  await deleteTestUsers();
});

async function roomWithRunners(runners: number, hostRole: "participant" | "spectator" = "participant") {
  const host = await createTestAccount();
  const settings = { ...defaultRoomSettings("en"), textType: "random" as const, length: 10, hostRole };
  const created = await createRoom(host.id, settings, false, uniqueName("h"));
  if (!created.ok) {
    throw new Error(created.error);
  }
  codes.push(created.code);
  const others: string[] = [];
  for (let index = hostRole === "participant" ? 1 : 0; index < runners; index++) {
    const guest = await createTestGuest();
    const name = uniqueName("g");
    await joinRoom(guest.id, created.code, "participant", false, name);
    others.push(guest.id);
  }
  return { hostId: host.id, code: created.code, others };
}

async function stateOf(code: string): Promise<RoomState | undefined> {
  const [room] = await getDb().select({ state: rooms.state }).from(rooms).where(eq(rooms.code, code));
  return room?.state;
}

/** Waits for the async end of a race (saving the results). */
async function until(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) {
      return;
    }
    await Bun.sleep(20);
  }
  throw new Error("Timed out.");
}

describe("startRace", () => {
  test("only the host can start (SEC-01)", async () => {
    const { code, others } = await roomWithRunners(2);
    expect(await startRace(others[0])).toEqual({ ok: false, error: "notHost" });
    const stranger = await createTestAccount();
    expect(await startRace(stranger.id)).toEqual({ ok: false, error: "notHost" });
    expect(await stateOf(code)).toBe("waiting");
  });

  test("needs at least 2 runners; spectators don't count (COURSE-02)", async () => {
    const alone = await roomWithRunners(1);
    expect(await startRace(alone.hostId)).toEqual({ ok: false, error: "notEnoughRunners" });

    const watching = await roomWithRunners(1, "spectator");
    expect(await startRace(watching.hostId)).toEqual({ ok: false, error: "notEnoughRunners" });
    expect(await stateOf(watching.code)).toBe("waiting");
  });

  test("starts the countdown once, and reveals the text only then (COURSE-03)", async () => {
    installFakeIo();
    const { hostId, code } = await roomWithRunners(2);
    expect(raceStateFor(code, hostId)).toBeNull();

    expect(await startRace(hostId)).toEqual({ ok: true });
    expect(await stateOf(code)).toBe("countdown");
    expect(await startRace(hostId)).toEqual({ ok: false, error: "notStartable" });

    const state = raceStateFor(code, hostId);
    expect(state?.text.split(" ")).toHaveLength(10);
    expect(state?.startsInMs).toBeGreaterThan(2_000);
    expect(state?.endsInMs).toBeNull();
    expect(state?.track).toHaveLength(2);
    expect(state?.you).toEqual({ input: "", keystrokes: 0, correctKeystrokes: 0 });
    // A spectator or a visitor sees the race, without a typing state.
    expect(raceStateFor(code, null)?.you).toBeNull();
  });
});

describe("during the race", () => {
  test("keys during the countdown are refused and the browser is resynced (COURSE-06)", async () => {
    const { hostId, code } = await roomWithRunners(2);
    await startRace(hostId);
    expect(handleKeys(hostId, 7, ["a", BACKSPACE])).toEqual({
      code,
      seq: 7,
      you: { input: "", keystrokes: 0, correctKeystrokes: 0 },
    });
  });

  test("when everyone abandoned, the results are saved and shown (COURSE-09, RES-05)", async () => {
    const { hostId, code, others } = await roomWithRunners(3);
    await startRace(hostId);
    abandonRace(hostId);
    // Leaving the room mid-race counts as abandoning (COURSE-07).
    await leaveRoom(others[0]);
    expect(await stateOf(code)).toBe("countdown");
    abandonRace(others[1]);
    await until(async () => (await stateOf(code)) === "results");

    const saved = await getLatestRaceResults(code);
    expect(saved?.content.split(" ")).toHaveLength(10);
    expect(saved?.results.map((row) => row.status)).toEqual(["abandoned", "abandoned", "abandoned"]);
    // Giving up leaves no accuracy (COURSE-07).
    expect(saved?.results.map((row) => row.accuracy)).toEqual([null, null, null]);
    expect(saved?.results.map((row) => row.rank)).toEqual([1, 2, 3]);
    // Guests keep no history (AUTH-03); accounts do.
    const host = saved?.results.find((row) => row.userId === hostId);
    expect(host?.isGuest).toBe(false);
    expect(saved?.results.filter((row) => row.isGuest).every((row) => row.userId === null)).toBe(true);

    // The host can start again from the results, with whoever stayed (COURSE-11).
    expect(await startRace(hostId)).toEqual({ ok: true });
    expect(raceStateFor(code, hostId)?.track.map((entry) => entry.userId).sort()).toEqual(
      [hostId, others[1]].sort(),
    );
  });
});
