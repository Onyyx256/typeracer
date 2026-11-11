import "server-only";
import { TransactionRollbackError, and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, users, type OAuthProvider } from "@/db/schema";
import { displayNameFor, usernameCandidate } from "./oauth-names";
import type { OAuthProfile } from "./oauth";

/** Returns null when the username is already taken, whatever its case. */
export async function createUser(
  username: string,
  passwordHash: string,
): Promise<{ id: string } | null> {
  // Let the unique index decide rather than checking first, so two
  // simultaneous signups cannot both get the same name.
  const [created] = await getDb()
    .insert(users)
    .values({ username, displayName: username, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id });
  return created ?? null;
}

export async function createGuest(nickname: string): Promise<{ id: string }> {
  const [created] = await getDb()
    .insert(users)
    .values({ displayName: nickname, isGuest: true })
    .returning({ id: users.id });
  return created;
}

export async function setGuestNickname(id: string, nickname: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ displayName: nickname })
    .where(and(eq(users.id, id), eq(users.isGuest, true)));
}

export async function findCredentials(
  username: string,
): Promise<{ id: string; passwordHash: string | null } | null> {
  const [found] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.toLowerCase()))
    .limit(1);
  return found ?? null;
}

/** Never the password hash. */
export async function findProfile(
  id: string,
): Promise<{ id: string; displayName: string; isGuest: boolean } | null> {
  const [found] = await getDb()
    .select({ id: users.id, displayName: users.displayName, isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return found ?? null;
}

async function findOAuthUser(
  provider: OAuthProvider,
  providerAccountId: string,
): Promise<{ id: string } | null> {
  const [found] = await getDb()
    .select({ id: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
    .limit(1);
  return found ?? null;
}

const USERNAME_ATTEMPTS = 5;

/**
 * The user linked to this identity, or a new account for it. Never matched
 * by email or login: an existing password account with the same name is
 * someone else as far as the app can tell.
 */
export async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  profile: OAuthProfile,
): Promise<{ id: string }> {
  const existing = await findOAuthUser(provider, profile.id);
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
    const username = usernameCandidate(profile.login, attempt, Math.random);
    try {
      const created = await getDb().transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ username, displayName: displayNameFor(profile.name, username) })
          .onConflictDoNothing()
          .returning({ id: users.id });
        if (!user) {
          return null;
        }
        const [account] = await tx
          .insert(accounts)
          .values({ userId: user.id, provider, providerAccountId: profile.id })
          .onConflictDoNothing()
          .returning({ id: accounts.id });
        if (!account) {
          tx.rollback();
        }
        return user;
      });
      if (created) {
        return created;
      }
    } catch (error) {
      // A second callback for the same identity linked it first: use that user.
      if (error instanceof TransactionRollbackError) {
        const linked = await findOAuthUser(provider, profile.id);
        if (linked) {
          return linked;
        }
      }
      throw error;
    }
  }
  throw new Error("No free username found for the OAuth account.");
}
