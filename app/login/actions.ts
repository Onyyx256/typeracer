"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { createUser, findCredentials } from "@/lib/auth/users";
import {
  loginSchema,
  signupSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/auth/validation";

export type SignupResult =
  { ok: true } | { ok: false; errors: FieldErrors; message?: string };

export type LoginResult = { ok: true } | { ok: false; message: string };

// One message for every failure, so the form never confirms that a username exists.
const BAD_CREDENTIALS = "nom d'utilisateur ou mot de passe incorrect";

/** Logs only the driver's message: Drizzle's own embeds the query parameters. */
function logFailure(action: string, error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error(
    `${action} failed:`,
    cause instanceof Error ? cause.message || cause.name : "unknown error",
  );
}

export async function signup(input: unknown): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: toFieldErrors(parsed.error) };
  }
  const { username, password } = parsed.data;

  try {
    const created = await createUser(username, await hashPassword(password));
    if (!created) {
      return { ok: false, errors: { username: "Ce nom est déjà pris." } };
    }
    await createSession(created.id);
  } catch (error) {
    logFailure("signup", error);
    return {
      ok: false,
      errors: {},
      message: "inscription impossible pour le moment, réessaie plus tard",
    };
  }

  return { ok: true };
}

export async function login(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: BAD_CREDENTIALS };
  }
  const { username, password } = parsed.data;

  try {
    const user = await findCredentials(username);
    const valid = await verifyPassword(user?.passwordHash ?? null, password);
    if (!user || !valid) {
      return { ok: false, message: BAD_CREDENTIALS };
    }
    await createSession(user.id);
  } catch (error) {
    logFailure("login", error);
    return {
      ok: false,
      message: "connexion impossible pour le moment, réessaie plus tard",
    };
  }

  return { ok: true };
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
