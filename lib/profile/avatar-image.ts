import "server-only";
import sharp from "sharp";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_SIZE = 256;
const ACCEPTED_FORMATS = ["jpeg", "png", "webp"] as const;
/** A small file can still decode to a huge image; refuse those before resizing. */
const MAX_INPUT_PIXELS = 40_000_000;

export type AvatarImageError = "avatarMissing" | "avatarTooBig" | "avatarType";

export type AvatarImageResult =
  | { ok: true; image: Buffer }
  | { ok: false; error: AvatarImageError };

function isAccepted(format: string | undefined): boolean {
  return ACCEPTED_FORMATS.some((accepted) => accepted === format);
}

/**
 * The type comes from the file's bytes, not its name. Re-encoding as WebP
 * also drops the metadata (EXIF, location).
 */
export async function prepareAvatar(bytes: Buffer): Promise<AvatarImageResult> {
  if (bytes.length === 0) {
    return { ok: false, error: "avatarMissing" };
  }
  if (bytes.length > AVATAR_MAX_BYTES) {
    return { ok: false, error: "avatarTooBig" };
  }

  try {
    const input = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const { format } = await input.metadata();
    if (!isAccepted(format)) {
      return { ok: false, error: "avatarType" };
    }
    const image = await input
      // Turns phone photos the right way up before the orientation tag is dropped.
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, image };
  } catch {
    return { ok: false, error: "avatarType" };
  }
}
