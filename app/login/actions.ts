"use server";

import { hashPassword } from "@/lib/auth/password";
import { createUser } from "@/lib/auth/users";
import {
  signupSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/auth/validation";

export type SignupResult =
  { ok: true } | { ok: false; errors: FieldErrors; message?: string };

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
  } catch (error) {
    // Drizzle's own message embeds the query parameters, hash included, so
    // log the driver's underlying cause instead.
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    console.error(
      "signup failed:",
      cause instanceof Error ? cause.message || cause.name : "unknown error",
    );
    return {
      ok: false,
      errors: {},
      message: "inscription impossible pour le moment, réessaie plus tard",
    };
  }

  return { ok: true };
}
