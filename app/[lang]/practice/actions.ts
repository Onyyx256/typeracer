"use server";

import { practiceConfigSchema, practiceRaceConfig } from "@/lib/practice/settings";
import { generateText, textConfigProblem } from "@/lib/texts/generate";

export type PracticeTextError = "invalid" | "noWords" | "unavailable";

export type PracticeTextResult =
  | { ok: true; text: string; source: { title: string; author: string } | null }
  | { ok: false; error: PracticeTextError };

/**
 * The text of a practice race. Open to everyone, signed in or not: it
 * only reads the corpus. The config is checked like a room's (TECH-07).
 */
export async function practiceTextAction(input: unknown): Promise<PracticeTextResult> {
  const parsed = practiceConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }
  const config = practiceRaceConfig(parsed.data);
  if (textConfigProblem(config)) {
    return { ok: false, error: "noWords" };
  }
  try {
    const { content, source } = await generateText(config);
    return {
      ok: true,
      text: content,
      source: source && { title: source.title, author: source.author },
    };
  } catch (error) {
    // Only the message: the driver's error can embed query parameters.
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    console.error("practiceText failed:", cause instanceof Error ? cause.message : "unknown error");
    return { ok: false, error: "unavailable" };
  }
}
