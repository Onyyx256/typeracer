"use server";

import * as z from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nicknameSchema } from "@/lib/auth/validation";
import { canWear, cosmeticsSchema } from "@/lib/profile/cosmetics";
import { prepareAvatar, type AvatarImageError } from "@/lib/profile/avatar-image";
import {
  getPlayerProgress,
  removeAvatar,
  saveAvatar,
  setCosmetics,
  setDisplayName,
} from "@/lib/profile/profile";

// Errors are codes; the account page shows them in the visitor's language.
export type AccountError =
  | AvatarImageError
  | "signedOut"
  | "nameLength"
  | "nameChars"
  | "locked"
  | "invalid"
  | "unavailable";

export type AccountResult = { ok: true } | { ok: false; error: AccountError };

/** Logs only the driver's message: Drizzle's own embeds the query parameters. */
function logFailure(action: string, error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error(
    `${action} failed:`,
    cause instanceof Error ? cause.message || cause.name : "unknown error",
  );
}

// TECH-07: the form sends one file field, nothing else is read.
const avatarFormSchema = z.object({ photo: z.instanceof(File) });

/** AUTH-04, SEC-02: checked and resized on the server, whatever the browser did. */
export async function uploadAvatarAction(formData: FormData): Promise<AccountResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "signedOut" };
  }
  const parsed = avatarFormSchema.safeParse({ photo: formData.get("photo") });
  if (!parsed.success) {
    return { ok: false, error: "avatarMissing" };
  }

  const prepared = await prepareAvatar(Buffer.from(await parsed.data.photo.arrayBuffer()));
  if (!prepared.ok) {
    return prepared;
  }
  try {
    await saveAvatar(user.id, prepared.image);
  } catch (error) {
    logFailure("uploadAvatar", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true };
}

export async function removeAvatarAction(): Promise<AccountResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "signedOut" };
  }
  try {
    await removeAvatar(user.id);
  } catch (error) {
    logFailure("removeAvatar", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true };
}

const displayNameSchema = z.object({ displayName: nicknameSchema });

/** AUTH-05: the same rules as a guest's nickname (AUTH-02). */
export async function updateDisplayNameAction(input: unknown): Promise<AccountResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "signedOut" };
  }
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    return { ok: false, error: code === "nicknameChars" ? "nameChars" : "nameLength" };
  }
  try {
    await setDisplayName(user.id, parsed.data.displayName);
  } catch (error) {
    logFailure("updateDisplayName", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true };
}

/** Only colours the player has unlocked, checked against their saved races. */
export async function updateCosmeticsAction(input: unknown): Promise<AccountResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "signedOut" };
  }
  const parsed = cosmeticsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  try {
    if (!canWear(parsed.data, await getPlayerProgress(user.id))) {
      return { ok: false, error: "locked" };
    }
    await setCosmetics(user.id, parsed.data);
  } catch (error) {
    logFailure("updateCosmetics", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true };
}
