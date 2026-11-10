import * as z from "zod";
import { getAvatarImage } from "@/lib/profile/profile";

/** AUTH-04: a user's profile photo, already resized when it was uploaded. */
export async function GET(request: Request, ctx: RouteContext<"/api/avatars/[userId]">) {
  const parsed = z.uuid().safeParse((await ctx.params).userId);
  const image = parsed.success ? await getAvatarImage(parsed.data) : null;
  if (!image) {
    return new Response(null, { status: 404 });
  }

  // Each new photo gets a new ?v=, so a versioned URL never changes.
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
