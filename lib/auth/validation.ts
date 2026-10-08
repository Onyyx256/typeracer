import * as z from "zod";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
// Hashing cost grows with input size, so an unbounded password is a cheap way to tie up the server.
export const PASSWORD_MAX = 128;

export type FieldErrors = {
  username?: string;
  password?: string;
  confirm?: string;
};

const usernameLength = `Entre ${USERNAME_MIN} à ${USERNAME_MAX} caractères.`;

export const signupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(USERNAME_MIN, { error: usernameLength })
      .max(USERNAME_MAX, { error: usernameLength })
      // ASCII only: the username is a login identifier, the display name carries the personality.
      .regex(/^[A-Za-z0-9._-]+$/, {
        error: "Lettres, chiffres, . _ - seulement.",
      }),
    password: z
      .string()
      .min(1, { error: "Requis." })
      .min(PASSWORD_MIN, { error: `Au moins ${PASSWORD_MIN} caractères.` })
      .max(PASSWORD_MAX, { error: `Au plus ${PASSWORD_MAX} caractères.` }),
    confirm: z.string(),
  })
  .refine((data) => data.confirm === data.password, {
    path: ["confirm"],
    error: "Ne correspond pas.",
  });

// Deliberately loose: login only needs enough to look the account up, and
// stricter rules here would lock out accounts created under older ones.
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(USERNAME_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export type SignupInput = z.infer<typeof signupSchema>;

/** Keeps the first message of each field, which is all the form has room for. */
export function toFieldErrors(error: z.ZodError<SignupInput>): FieldErrors {
  const { fieldErrors } = z.flattenError(error);
  return {
    username: fieldErrors.username?.[0],
    password: fieldErrors.password?.[0],
    confirm: fieldErrors.confirm?.[0],
  };
}
