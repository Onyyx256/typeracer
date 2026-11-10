"use server";

import { getSessionUserId } from "@/lib/auth/session";
import { practiceConfigSchema, practiceRaceConfig } from "@/lib/practice/settings";
import { findCurrentRoom } from "@/lib/rooms/rooms";
import { generateText, textConfigProblem } from "@/lib/texts/generate";

export type PracticeTextError = "invalid" | "noWords" | "inRoom" | "unavailable";

export type PracticeTextResult =
  | { ok: true; text: string; source: { title: string; author: string } | null }
  | {
      ok: false;
      error: PracticeTextError;
      currentCode?: string;
    };

/** Logs only the driver's message: Drizzle's own embeds the query parameters. */
function logFailure(error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error("practiceText failed:", cause instanceof Error ? cause.message : "unknown error");
}

/** Someone in a room belongs to that room's races and can't practice. */
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
    const userId = await getSessionUserId();
    const current = userId ? await findCurrentRoom(userId) : null;
    if (current) {
      return { ok: false, error: "inRoom", currentCode: current.code };
    }
    const { content, source } = await generateText(config);
    return {
      ok: true,
      text: content,
      source: source && { title: source.title, author: source.author },
    };
  } catch (error) {
    logFailure(error);
    return { ok: false, error: "unavailable" };
  }
}
