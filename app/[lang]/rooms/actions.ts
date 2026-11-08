"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { createSession, getSessionUserId } from "@/lib/auth/session";
import { createGuest, findProfile, isAccountUsername } from "@/lib/auth/users";
import { nicknameSchema } from "@/lib/auth/validation";
import { DEFAULT_LOCALE, localePath, localeSchema, type Locale } from "@/lib/i18n/config";
import { roomCodeSchema } from "@/lib/rooms/code";
import type { NameError } from "@/lib/rooms/names";
import {
  createRoom,
  joinRoom,
  kickMember,
  leaveRoom,
  type KickError,
  type RoomError,
  type RoomResult,
} from "@/lib/rooms/rooms";
import {
  HOST_ROLES,
  normalizeSettings,
  raceConfigSchema,
  roomSettingsSchema,
} from "@/lib/rooms/settings";
import { textConfigProblem } from "@/lib/texts/generate";


/** Error codes; the forms show them in the visitor's language. */
export type RoomActionError =
  | RoomError
  | NameError
  | "invalid"
  | "noWords"
  | "notSignedIn"
  | "unavailable";

export type RoomActionResult = {
  ok: false;
  error: RoomActionError;
  /** With "alreadyInRoom": the room the user is in, to offer going back or leaving it. */
  currentCode?: string;
};

/** Logs only the driver's message: Drizzle's own embeds the query parameters. */
function logFailure(action: string, error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error(
    `${action} failed:`,
    cause instanceof Error ? cause.message || cause.name : "unknown error",
  );
}

/** The session's user, if the row still exists. */
async function sessionProfile() {
  const userId = await getSessionUserId();
  return userId ? findProfile(userId) : null;
}

/**
 * The name someone picked for a room (3 to 20 characters, AUTH-02). Another
 * account's username is never available, so nobody can pass for that
 * account; your own always is.
 */
async function checkName(
  input: string,
  userId: string | null,
): Promise<{ name: string } | { error: NameError }> {
  const parsed = nicknameSchema.safeParse(input);
  if (!parsed.success) {
    const chars = parsed.error.issues.some((issue) => issue.message === "nicknameChars");
    return { error: chars ? "nameChars" : "nameLength" };
  }
  if (await isAccountUsername(parsed.data, userId)) {
    return { error: "nameReserved" };
  }
  return { name: parsed.data };
}

/** Checks the name, runs the database call; on success, sends the user to the room page. */
async function enterRoom(
  action: string,
  lang: Locale,
  run: () => Promise<RoomResult | RoomActionResult>,
): Promise<RoomActionResult> {
  let result: RoomResult | RoomActionResult;
  try {
    result = await run();
  } catch (error) {
    logFailure(action, error);
    return { ok: false, error: "unavailable" };
  }
  if (!result.ok) {
    return result;
  }
  // Outside the try: redirect() works by throwing.
  redirect(localePath(lang, `/rooms/${result.code}`));
}

const nameInput = z.string().max(200);

const createRoomInput = z.object({
  lang: localeSchema,
  settings: roomSettingsSchema,
  /** The host's name in this room. */
  name: nameInput,
  leaveCurrent: z.boolean().default(false),
});

/** SALLE-01: only signed-in users create rooms, never guests (AUTH-03). */
export async function createRoomAction(input: unknown): Promise<RoomActionResult> {
  const parsed = createRoomInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const settings = normalizeSettings(parsed.data.settings);
  // Checked now so the room never reaches a race it can't give a text to.
  if (textConfigProblem(raceConfigSchema.parse(settings))) {
    return { ok: false, error: "noWords" };
  }

  return enterRoom("createRoom", parsed.data.lang, async () => {
    const user = await sessionProfile();
    if (!user || user.isGuest) {
      return { ok: false, error: "notSignedIn" };
    }
    const checked = await checkName(parsed.data.name, user.id);
    if ("error" in checked) {
      return { ok: false, error: checked.error };
    }
    return createRoom(user.id, settings, parsed.data.leaveCurrent, checked.name);
  });
}

const joinRoomInput = z.object({
  lang: localeSchema,
  code: roomCodeSchema,
  role: z.enum(HOST_ROLES),
  /** The name in this room; a visitor without a session also becomes a guest under it (AUTH-02). */
  name: nameInput,
  leaveCurrent: z.boolean().default(false),
});

export async function joinRoomAction(input: unknown): Promise<RoomActionResult> {
  const parsed = joinRoomInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const { lang, code, role, name, leaveCurrent } = parsed.data;

  return enterRoom("joinRoom", lang, async () => {
    const user = await sessionProfile();
    const checked = await checkName(name, user?.id ?? null);
    if ("error" in checked) {
      return { ok: false, error: checked.error };
    }
    let userId = user?.id;
    if (!userId) {
      // The nickname becomes the guest's default name for the next rooms.
      userId = (await createGuest(checked.name)).id;
      await createSession(userId);
    }
    return joinRoom(userId, code, role, leaveCurrent, checked.name);
  });
}

const leaveRoomInput = z.object({ lang: localeSchema });

export async function leaveRoomAction(formData: FormData): Promise<void> {
  const parsed = leaveRoomInput.safeParse({ lang: formData.get("lang") });
  const lang = parsed.success ? parsed.data.lang : DEFAULT_LOCALE;
  const userId = await getSessionUserId();
  if (userId) {
    try {
      await leaveRoom(userId);
    } catch (error) {
      logFailure("leaveRoom", error);
      throw new Error("Could not leave the room.");
    }
  }
  redirect(localePath(lang, "/rooms"));
}

const kickMemberInput = z.object({ userId: z.uuid() });

export type KickActionResult = { ok: true } | { ok: false; error: KickError | "invalid" | "unavailable" };

/** SALLE-07: kickMember checks that the session's user hosts the room (SEC-01). */
export async function kickMemberAction(input: unknown): Promise<KickActionResult> {
  const parsed = kickMemberInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const hostId = await getSessionUserId();
  if (!hostId) {
    return { ok: false, error: "notHost" };
  }
  try {
    return await kickMember(hostId, parsed.data.userId);
  } catch (error) {
    logFailure("kickMember", error);
    return { ok: false, error: "unavailable" };
  }
}
