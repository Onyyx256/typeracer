"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { createSession, getSessionUserId } from "@/lib/auth/session";
import { createGuest, findProfile, setGuestNickname } from "@/lib/auth/users";
import { nicknameSchema } from "@/lib/auth/validation";
import {
  backToLobby,
  startRace,
  type BackToLobbyError,
  type StartRaceError,
} from "@/lib/race/manager";
import { DEFAULT_LOCALE, localePath, localeSchema, type Locale } from "@/lib/i18n/config";
import { roomCodeSchema } from "@/lib/rooms/code";
import type { NameError } from "@/lib/rooms/names";
import {
  createRoom,
  joinRoom,
  kickMember,
  leaveClosesRoom,
  leaveRoom,
  transferHost,
  updateRoomSettings,
  type KickError,
  type RoomError,
  type RoomResult,
  type TransferHostError,
  type UpdateSettingsError,
} from "@/lib/rooms/rooms";
import {
  HOST_ROLES,
  editableSettingsSchema,
  normalizeSettings,
  raceConfigSchema,
  roomSettingsSchema,
} from "@/lib/rooms/settings";
import { textConfigProblem } from "@/lib/texts/generate";


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

async function sessionProfile() {
  const userId = await getSessionUserId();
  return userId ? findProfile(userId) : null;
}

/**
 * Any name is allowed, an account's username included; only a name already
 * used in the same room is refused, by the database. The guest badge tells
 * a guest apart from an account of the same name.
 */
function checkName(input: string): { name: string } | { error: NameError } {
  const parsed = nicknameSchema.safeParse(input);
  if (!parsed.success) {
    const chars = parsed.error.issues.some((issue) => issue.message === "nicknameChars");
    return { error: chars ? "nameChars" : "nameLength" };
  }
  return { name: parsed.data };
}

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
  name: nameInput,
  leaveCurrent: z.boolean().default(false),
});

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
    const checked = checkName(parsed.data.name);
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
  /** A visitor without a session becomes a guest under this name. */
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
    const checked = checkName(name);
    if ("error" in checked) {
      return { ok: false, error: checked.error };
    }
    let userId = user?.id;
    if (!userId) {
      userId = (await createGuest(checked.name)).id;
      await createSession(userId);
    }
    const result = await joinRoom(userId, code, role, leaveCurrent, checked.name);
    // The name a guest got in with becomes their default for the next rooms;
    // a refused one (taken in this room) doesn't.
    if (result.ok && (!user || user.isGuest)) {
      await setGuestNickname(userId, checked.name);
    }
    return result;
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

export async function leaveClosesRoomAction(): Promise<boolean> {
  const userId = await getSessionUserId();
  if (!userId) {
    return false;
  }
  try {
    return await leaveClosesRoom(userId);
  } catch (error) {
    // Not knowing shouldn't block leaving; the leave itself reports its errors.
    logFailure("leaveClosesRoom", error);
    return false;
  }
}

const kickMemberInput = z.object({ userId: z.uuid() });

export type KickActionResult = { ok: true } | { ok: false; error: KickError | "invalid" | "unavailable" };

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

const transferHostInput = z.object({ userId: z.uuid() });

export type TransferHostActionResult =
  | { ok: true }
  | { ok: false; error: TransferHostError | "invalid" | "unavailable" };

export async function transferHostAction(input: unknown): Promise<TransferHostActionResult> {
  const parsed = transferHostInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const hostId = await getSessionUserId();
  if (!hostId) {
    return { ok: false, error: "notHost" };
  }
  try {
    return await transferHost(hostId, parsed.data.userId);
  } catch (error) {
    logFailure("transferHost", error);
    return { ok: false, error: "unavailable" };
  }
}

const updateSettingsInput = z.object({ settings: editableSettingsSchema });

export type UpdateSettingsActionResult =
  | { ok: true }
  | { ok: false; error: UpdateSettingsError | "invalid" | "noWords" | "unavailable" };

export async function updateRoomSettingsAction(
  input: unknown,
): Promise<UpdateSettingsActionResult> {
  const parsed = updateSettingsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const settings = normalizeSettings(parsed.data.settings);
  // Same check as on creation, so the next race can always get a text.
  if (textConfigProblem(raceConfigSchema.parse(settings))) {
    return { ok: false, error: "noWords" };
  }
  const hostId = await getSessionUserId();
  if (!hostId) {
    return { ok: false, error: "notHost" };
  }
  try {
    return await updateRoomSettings(hostId, settings);
  } catch (error) {
    logFailure("updateRoomSettings", error);
    return { ok: false, error: "unavailable" };
  }
}

export type StartRaceActionResult =
  | { ok: true }
  | { ok: false; error: StartRaceError | "unavailable" };

export async function startRaceAction(): Promise<StartRaceActionResult> {
  const hostId = await getSessionUserId();
  if (!hostId) {
    return { ok: false, error: "notHost" };
  }
  try {
    return await startRace(hostId);
  } catch (error) {
    logFailure("startRace", error);
    return { ok: false, error: "unavailable" };
  }
}

export type BackToLobbyActionResult =
  | { ok: true }
  | { ok: false; error: BackToLobbyError | "unavailable" };

export async function backToLobbyAction(): Promise<BackToLobbyActionResult> {
  const hostId = await getSessionUserId();
  if (!hostId) {
    return { ok: false, error: "notHost" };
  }
  try {
    return await backToLobby(hostId);
  } catch (error) {
    logFailure("backToLobby", error);
    return { ok: false, error: "unavailable" };
  }
}
