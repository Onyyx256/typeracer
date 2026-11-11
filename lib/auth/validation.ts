import * as z from "zod";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
// Hashing cost grows with input size, so an unbounded password is a cheap way to tie up the server.
export const PASSWORD_MAX = 128;

export const AUTH_LIMITS = {
  usernameMin: USERNAME_MIN,
  usernameMax: USERNAME_MAX,
  passwordMin: PASSWORD_MIN,
  passwordMax: PASSWORD_MAX,
};

// Errors travel as codes, not sentences: the same schema runs on the server
// and in the browser, and the form turns each code into text in the visitor's
// language (keys of `auth.errors` in the dictionaries).
export const AUTH_ERRORS = [
  "usernameLength",
  "usernameChars",
  "nicknameChars",
  "required",
  "passwordMin",
  "passwordMax",
  "confirmMismatch",
  "usernameTaken",
  "badCredentials",
  "signupUnavailable",
  "loginUnavailable",
  "oauthCancelled",
  "oauthFailed",
  "oauthUnavailable",
] as const;
export type AuthError = (typeof AUTH_ERRORS)[number];

export const OAUTH_ERRORS = ["oauthCancelled", "oauthFailed", "oauthUnavailable"] as const;
export type OAuthError = (typeof OAUTH_ERRORS)[number];

function isAuthError(value: string | undefined): value is AuthError {
  return AUTH_ERRORS.some((code) => code === value);
}

export type FieldErrors = {
  username?: AuthError;
  password?: AuthError;
  confirm?: AuthError;
};

const usernameLength = { error: "usernameLength" } satisfies { error: AuthError };

export const signupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(USERNAME_MIN, usernameLength)
      .max(USERNAME_MAX, usernameLength)
      // ASCII only: the username is a login identifier, the display name carries the personality.
      .regex(/^[A-Za-z0-9._-]+$/, { error: "usernameChars" }),
    password: z
      .string()
      .min(1, { error: "required" })
      .min(PASSWORD_MIN, { error: "passwordMin" })
      .max(PASSWORD_MAX, { error: "passwordMax" }),
    confirm: z.string(),
  })
  .refine((data) => data.confirm === data.password, {
    path: ["confirm"],
    error: "confirmMismatch",
  });

/** Inner runs of spaces count as one. */
export const nicknameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(USERNAME_MIN, usernameLength)
      .max(USERNAME_MAX, usernameLength)
      .regex(/^[\p{L}\p{N} ._'-]+$/u, { error: "nicknameChars" }),
  );

// Deliberately loose: login only needs enough to look the account up, and
// stricter rules here would lock out accounts created under older ones.
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(USERNAME_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export type SignupInput = z.infer<typeof signupSchema>;

export function toFieldErrors(error: z.ZodError<SignupInput>): FieldErrors {
  const { fieldErrors } = z.flattenError(error);
  const first = (messages: string[] | undefined) => {
    const code = messages?.[0];
    return isAuthError(code) ? code : undefined;
  };
  return {
    username: first(fieldErrors.username),
    password: first(fieldErrors.password),
    confirm: first(fieldErrors.confirm),
  };
}
