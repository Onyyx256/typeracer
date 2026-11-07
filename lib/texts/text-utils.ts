/** Splits on any run of whitespace; spaces are the only separators in a race text. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/** "l'homme," → "lhomme": only the letters, for measuring and comparing words. */
export function lettersOf(word: string): string {
  return word.replace(/[^\p{L}]/gu, "");
}

/** "Été" → "Ete". Ç becomes C, the same way a keyboard without accents would type it. */
export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

export function hasAccent(text: string): boolean {
  return stripAccents(text) !== text;
}

export function hasDigit(text: string): boolean {
  return /\d/.test(text);
}
