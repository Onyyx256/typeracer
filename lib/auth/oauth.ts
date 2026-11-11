import "server-only";
import { createHash, randomBytes } from "node:crypto";
import * as z from "zod";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@/db/schema";

export { OAUTH_PROVIDERS, type OAuthProvider };

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);

/** What the app keeps from a provider's profile. */
export type OAuthProfile = {
  id: string;
  login: string;
  name: string | null;
};

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
  parseProfile: (data: unknown) => OAuthProfile;
};

const githubUserSchema = z.object({
  id: z.number().int(),
  login: z.string().min(1),
  name: z.string().nullable().optional(),
});

const discordUserSchema = z.object({
  id: z.string().regex(/^\d+$/),
  username: z.string().min(1),
  global_name: z.string().nullable().optional(),
});

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    scope: "read:user",
    parseProfile: (data) => {
      const user = githubUserSchema.parse(data);
      return { id: String(user.id), login: user.login, name: user.name ?? null };
    },
  },
  discord: {
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    profileUrl: "https://discord.com/api/users/@me",
    scope: "identify",
    parseProfile: (data) => {
      const user = discordUserSchema.parse(data);
      return { id: user.id, login: user.username, name: user.global_name ?? null };
    },
  },
};

const ENV_PREFIX: Record<OAuthProvider, string> = {
  github: "GITHUB",
  discord: "DISCORD",
};

/** Null when the provider's id or secret is missing, so the app still runs without them. */
export function providerCredentials(
  provider: OAuthProvider,
): { clientId: string; clientSecret: string } | null {
  const prefix = ENV_PREFIX[provider];
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * Behind the production reverse proxy the request's own URL says http and
 * the internal port, so the public address has to come from APP_URL.
 */
export function callbackUrl(provider: OAuthProvider, requestUrl: string): string {
  const base = process.env.APP_URL ?? new URL(requestUrl).origin;
  return new URL(`/api/auth/${provider}/callback`, base).toString();
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** A random state against forged callbacks and a PKCE verifier against stolen codes. */
export function createAuthorization(
  provider: OAuthProvider,
  clientId: string,
  redirectUri: string,
): { url: string; state: string; verifier: string } {
  const state = randomToken();
  const verifier = randomToken();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const config = PROVIDERS[provider];
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), state, verifier };
}

const tokenSchema = z.object({ access_token: z.string().min(1) });

const TIMEOUT_MS = 10_000;

export async function fetchProfile(
  provider: OAuthProvider,
  input: { code: string; verifier: string; redirectUri: string },
): Promise<OAuthProfile> {
  const credentials = providerCredentials(provider);
  if (!credentials) {
    throw new Error(`${provider} OAuth is not configured.`);
  }
  const config = PROVIDERS[provider];

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.verifier,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // GitHub answers a bad code with 200 and an error body, which the schema rejects.
  if (!tokenResponse.ok) {
    throw new Error(`${provider} token request failed with ${tokenResponse.status}.`);
  }
  const { access_token } = tokenSchema.parse(await tokenResponse.json());

  const profileResponse = await fetch(config.profileUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${access_token}`,
      // GitHub refuses API requests without one.
      "User-Agent": "nelumbotype",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!profileResponse.ok) {
    throw new Error(`${provider} profile request failed with ${profileResponse.status}.`);
  }
  return config.parseProfile(await profileResponse.json());
}
