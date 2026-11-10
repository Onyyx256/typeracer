import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { AVATAR_MAX_BYTES, AVATAR_SIZE, prepareAvatar } from "./avatar-image";

function picture(format: "png" | "jpeg" | "webp" | "gif", width = 640, height = 480): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 48, g: 153, b: 117 } },
  })
    .toFormat(format)
    .toBuffer();
}

describe("profile photo (AUTH-04, SEC-02)", () => {
  test.each(["png", "jpeg", "webp"] as const)("accepts %s and makes a square WebP", async (format) => {
    const result = await prepareAvatar(await picture(format));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const meta = await sharp(result.image).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(AVATAR_SIZE);
      expect(meta.height).toBe(AVATAR_SIZE);
    }
  });

  test("refuses another image type, whatever the file is called", async () => {
    expect(await prepareAvatar(await picture("gif"))).toEqual({ ok: false, error: "avatarType" });
  });

  test("refuses bytes that aren't an image", async () => {
    const text = Buffer.from("<svg onload=alert(1)>not a photo</svg>");
    expect(await prepareAvatar(text)).toEqual({ ok: false, error: "avatarType" });
  });

  test("refuses a truncated image", async () => {
    const png = await picture("png");
    expect(await prepareAvatar(png.subarray(0, 60))).toEqual({ ok: false, error: "avatarType" });
  });

  test("refuses an empty file and one over 2 MB", async () => {
    expect(await prepareAvatar(Buffer.alloc(0))).toEqual({ ok: false, error: "avatarMissing" });
    expect(await prepareAvatar(Buffer.alloc(AVATAR_MAX_BYTES + 1))).toEqual({
      ok: false,
      error: "avatarTooBig",
    });
  });

  test("refuses an image that decodes to too many pixels", async () => {
    // A tiny PNG of one colour can claim a huge size.
    const huge = await sharp({
      create: { width: 8000, height: 8000, channels: 3, background: "#ffffff" },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(huge.length).toBeLessThan(AVATAR_MAX_BYTES);
    expect(await prepareAvatar(huge)).toEqual({ ok: false, error: "avatarType" });
  });
});
