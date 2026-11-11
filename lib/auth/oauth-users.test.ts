import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createTestAccount, deleteTestUsers, trackTestUser, uniqueName } from "@/test/db";
import { findOrCreateOAuthUser } from "./users";

afterAll(deleteTestUsers);

function providerId(): string {
  return randomUUID();
}

async function signIn(...args: Parameters<typeof findOrCreateOAuthUser>) {
  const user = await findOrCreateOAuthUser(...args);
  trackTestUser(user.id);
  return user;
}

async function row(id: string) {
  const [found] = await getDb().select().from(users).where(eq(users.id, id));
  return found;
}

describe("findOrCreateOAuthUser (AUTH-01)", () => {
  test("creates an account named after the login, with no password", async () => {
    const login = uniqueName("gh");
    const user = await signIn("github", { id: providerId(), login, name: "Zoë Martin" });
    const created = await row(user.id);
    expect(created.username).toBe(login);
    expect(created.displayName).toBe("Zoë Martin");
    expect(created.isGuest).toBe(false);
    expect(created.passwordHash).toBeNull();
  });

  test("the same identity finds the same user, even after a new login", async () => {
    const id = providerId();
    const first = await signIn("discord", { id, login: uniqueName("dc"), name: null });
    const again = await signIn("discord", { id, login: uniqueName("renamed"), name: null });
    expect(again.id).toBe(first.id);
  });

  test("the same id on another provider is another user", async () => {
    const id = providerId();
    const github = await signIn("github", { id, login: uniqueName("gh"), name: null });
    const discord = await signIn("discord", { id, login: uniqueName("dc"), name: null });
    expect(discord.id).not.toBe(github.id);
  });

  test("never takes over a password account with the same name", async () => {
    const existing = await createTestAccount();
    const user = await signIn("github", {
      id: providerId(),
      login: existing.username.toUpperCase(),
      name: null,
    });
    expect(user.id).not.toBe(existing.id);
    expect((await row(user.id)).username).toMatch(/_\d{4}$/);
  });

  test("two simultaneous first sign-ins end up with one user", async () => {
    const profile = { id: providerId(), login: uniqueName("gh"), name: null };
    const [a, b] = await Promise.all([signIn("github", profile), signIn("github", profile)]);
    expect(a.id).toBe(b.id);
  });
});
