import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import * as z from "zod";
import { callbackUrl, fetchProfile, oauthProviderSchema } from "@/lib/auth/oauth";
import { takePendingOAuth } from "@/lib/auth/oauth-state";
import { createSession } from "@/lib/auth/session";
import { findOrCreateOAuthUser } from "@/lib/auth/users";
import type { OAuthError } from "@/lib/auth/validation";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n/config";

const callbackSchema = z.union([
  z.object({ code: z.string().min(1).max(512), state: z.string().min(1).max(128) }),
  z.object({ error: z.string().min(1).max(256) }),
]);

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Logs only the message: Drizzle's errors embed the query parameters. */
function logFailure(provider: string, error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error(
    `${provider} sign-in failed:`,
    cause instanceof Error ? cause.message || cause.name : "unknown error",
  );
}

export async function GET(request: Request, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const provider = oauthProviderSchema.safeParse((await ctx.params).provider);
  if (!provider.success) {
    return new Response(null, { status: 404 });
  }
  const pending = await takePendingOAuth();
  const lang = pending?.lang ?? DEFAULT_LOCALE;
  const query = callbackSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  let failure: OAuthError | null = null;
  if (!query.success) {
    failure = "oauthFailed";
  } else if ("error" in query.data) {
    failure = query.data.error === "access_denied" ? "oauthCancelled" : "oauthFailed";
  } else if (
    !pending ||
    pending.provider !== provider.data ||
    !sameState(pending.state, query.data.state)
  ) {
    failure = "oauthFailed";
  } else {
    try {
      const profile = await fetchProfile(provider.data, {
        code: query.data.code,
        verifier: pending.verifier,
        redirectUri: callbackUrl(provider.data, request.url),
      });
      const user = await findOrCreateOAuthUser(provider.data, profile);
      await createSession(user.id);
    } catch (error) {
      logFailure(provider.data, error);
      failure = "oauthFailed";
    }
  }

  redirect(
    failure ? `${localePath(lang, "/login")}?error=${failure}` : localePath(lang, "/"),
  );
}
