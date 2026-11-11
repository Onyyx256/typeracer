import "server-only";
import { cookies } from "next/headers";
import * as z from "zod";
import { localeSchema } from "@/lib/i18n/config";
import { oauthProviderSchema } from "./oauth";

const COOKIE_NAME = "oauth";
const COOKIE_PATH = "/api/auth";
const MAX_AGE_SECONDS = 10 * 60;

const pendingSchema = z.object({
  provider: oauthProviderSchema,
  state: z.string().min(1),
  verifier: z.string().min(1),
  lang: localeSchema,
});

export type PendingOAuth = z.infer<typeof pendingSchema>;

/** Kept between leaving for the provider and coming back to the callback. */
export async function savePendingOAuth(pending: PendingOAuth): Promise<void> {
  (await cookies()).set(COOKIE_NAME, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax still sends it on the provider's top-level redirect back to the callback.
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Read once: the cookie is deleted so a state can never be replayed. */
export async function takePendingOAuth(): Promise<PendingOAuth | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  store.delete({ name: COOKIE_NAME, path: COOKIE_PATH });
  if (!raw) {
    return null;
  }
  try {
    const parsed = pendingSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
