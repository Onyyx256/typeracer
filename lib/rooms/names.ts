/**
 * Errors about the name someone picked for a room; they fix them by typing
 * another name. Shared by the actions and the forms.
 */
export const NAME_ERRORS = ["nameLength", "nameChars", "nameTaken"] as const;
export type NameError = (typeof NAME_ERRORS)[number];

export function isNameError(value: string | null): value is NameError {
  return NAME_ERRORS.some((code) => code === value);
}
