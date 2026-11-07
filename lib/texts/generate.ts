import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { texts } from "@/db/schema";
import type { RaceConfig } from "@/lib/rooms/settings";
import { choosePassageExcerpt, shapePassage } from "./passage-text";
import { generateRandomText } from "./random-text";
import { createRng } from "./rng";
import { buildWordPool, commonWords } from "./word-pool";

/** How many passages are read to look for a good excerpt. */
const CANDIDATES = 25;

export type GeneratedText = {
  content: string;
  /** The passage it comes from, for coherent texts (shown with the results). */
  source: { textId: string; title: string; author: string } | null;
};

/** Error code when a config can't produce any text, or null when it can. */
export function textConfigProblem(config: RaceConfig): "noWords" | null {
  if (config.textType === "random" && buildWordPool(config).length === 0) {
    return "noWords";
  }
  return null;
}

async function passageCandidates(config: RaceConfig, withComplexity: boolean) {
  const filters = [eq(texts.language, config.language)];
  if (withComplexity) {
    filters.push(eq(texts.complexity, config.complexity));
  }
  // Prose rarely has digits, so "numbers" can't add them; turned off, it
  // skips the passages that have some.
  if (!config.numbers) {
    filters.push(eq(texts.hasDigits, false));
  }
  return getDb()
    .select({
      id: texts.id,
      content: texts.content,
      title: texts.sourceTitle,
      author: texts.sourceAuthor,
    })
    .from(texts)
    .where(and(...filters))
    .orderBy(sql`random()`)
    .limit(CANDIDATES);
}

/**
 * The text of the next race. Called when the countdown starts, so nobody
 * sees it earlier (COURSE-03). Throws if the config leaves nothing to type,
 * which textConfigProblem() prevents when the room is created or edited.
 */
export async function generateText(
  config: RaceConfig,
  seed: number = randomInt(2 ** 31),
): Promise<GeneratedText> {
  const rng = createRng(seed);

  if (config.textType === "random") {
    const content = generateRandomText(config, rng);
    if (content === null) {
      throw new Error("No word matches this room's character filters.");
    }
    return { content, source: null };
  }

  let candidates = await passageCandidates(config, true);
  if (candidates.length === 0) {
    candidates = await passageCandidates(config, false);
  }
  const common = commonWords(config.language);
  const excerpt = choosePassageExcerpt(candidates, config, common, rng);
  if (!excerpt) {
    throw new Error(`No passage in ${config.language}; run bun run db:seed.`);
  }
  return {
    content: shapePassage(excerpt.text, config),
    source: {
      textId: excerpt.passage.id,
      title: excerpt.passage.title,
      author: excerpt.passage.author,
    },
  };
}
