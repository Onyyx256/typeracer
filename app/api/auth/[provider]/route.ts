import { redirect } from "next/navigation";
import {
  callbackUrl,
  createAuthorization,
  oauthProviderSchema,
  providerCredentials,
} from "@/lib/auth/oauth";
import { savePendingOAuth } from "@/lib/auth/oauth-state";
import { DEFAULT_LOCALE, localePath, localeSchema } from "@/lib/i18n/config";

export async function GET(request: Request, ctx: RouteContext<"/api/auth/[provider]">) {
  const provider = oauthProviderSchema.safeParse((await ctx.params).provider);
  if (!provider.success) {
    return new Response(null, { status: 404 });
  }
  const lang = localeSchema
    .catch(DEFAULT_LOCALE)
    .parse(new URL(request.url).searchParams.get("lang"));

  const credentials = providerCredentials(provider.data);
  if (!credentials) {
    redirect(`${localePath(lang, "/login")}?error=oauthUnavailable`);
  }

  const { url, state, verifier } = createAuthorization(
    provider.data,
    credentials.clientId,
    callbackUrl(provider.data, request.url),
  );
  await savePendingOAuth({ provider: provider.data, state, verifier, lang });
  redirect(url);
}
