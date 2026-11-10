export const NAME_ERRORS = ["nameLength", "nameChars", "nameTaken"] as const;
export type NameError = (typeof NAME_ERRORS)[number];

export function isNameError(value: string | null): value is NameError {
  return NAME_ERRORS.some((code) => code === value);
}
