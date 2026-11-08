"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { createSession, getSessionUserId } from "@/lib/auth/session";
import { createGuest, findProfile } from "@/lib/auth/users";
import { nicknameSchema } from "@/lib/auth/validation";
import { DEFAULT_LOCALE, localePath, localeSchema, type Locale } from "@/lib/i18n/config";
import { roomCodeSchema } from "@/lib/rooms/code";
import {
  createRoom,
  joinRoom,
  leaveRoom,
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

/** Joining can also fail on the nickname a guest typed (AUTH-02). */
export type JoinRoomActionError = RoomActionError | "nicknameLength" | "nicknameChars";

export type JoinRoomActionResult = Omit<RoomActionResult, "error"> & {
  error: JoinRoomActionError;
};

/** Runs the database call; on success, sends the user to the room page. */
async function enterRoom(
  action: string,
  lang: Locale,
  run: () => Promise<RoomResult>,
): Promise<RoomActionResult> {
  let result: RoomResult;
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

const createRoomInput = z.object({
  lang: localeSchema,
  settings: roomSettingsSchema,
  leaveCurrent: z.boolean().default(false),
});

/** The session's user, if the row still exists. */
async function sessionProfile() {
  const userId = await getSessionUserId();
  return userId ? findProfile(userId) : null;
}

/** SALLE-01: only signed-in users create rooms, never guests (AUTH-03). */
export async function createRoomAction(input: unknown): Promise<RoomActionResult> {
  const parsed = createRoomInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const user = await sessionProfile().catch((error: unknown) => {
    logFailure("createRoom", error);
    return null;
  });
  if (!user || user.isGuest) {
    return { ok: false, error: "notSignedIn" };
  }
  const userId = user.id;
  const settings = normalizeSettings(parsed.data.settings);
  // Checked now so the room never reaches a race it can't give a text to.
  if (textConfigProblem(raceConfigSchema.parse(settings))) {
    return { ok: false, error: "noWords" };
  }

  return enterRoom("createRoom", parsed.data.lang, () =>
    createRoom(userId, settings, parsed.data.leaveCurrent),
  );
}

const joinRoomInput = z.object({
  lang: localeSchema,
  code: roomCodeSchema,
  role: z.enum(HOST_ROLES),
  leaveCurrent: z.boolean().default(false),
  /** Only read when the visitor has no session yet: they join as a guest (AUTH-02). */
  nickname: z.string().max(200).optional(),
});

/** A visitor without a session gets a guest account under the nickname they chose. */
async function joiningUserId(
  nickname: string | undefined,
): Promise<{ userId: string } | { error: JoinRoomActionError }> {
  const existing = await sessionProfile();
  if (existing) {
    return { userId: existing.id };
  }
  if (nickname === undefined) {
    return { error: "notSignedIn" };
  }
  const parsed = nicknameSchema.safeParse(nickname);
  if (!parsed.success) {
    const chars = parsed.error.issues.some((issue) => issue.message === "nicknameChars");
    return { error: chars ? "nicknameChars" : "nicknameLength" };
  }
  const guest = await createGuest(parsed.data);
  await createSession(guest.id);
  return { userId: guest.id };
}

export async function joinRoomAction(input: unknown): Promise<JoinRoomActionResult> {
  const parsed = joinRoomInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const { lang, code, role, leaveCurrent, nickname } = parsed.data;
  let joining: Awaited<ReturnType<typeof joiningUserId>>;
  try {
    joining = await joiningUserId(nickname);
  } catch (error) {
    logFailure("joinRoom", error);
    return { ok: false, error: "unavailable" };
  }
  if ("error" in joining) {
    return { ok: false, error: joining.error };
  }
  const { userId } = joining;

  return enterRoom("joinRoom", lang, () => joinRoom(userId, code, role, leaveCurrent));
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
