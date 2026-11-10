/**
 * Seeds the passage corpus from db/seed/passages.json (built by
 * `bun run texts:build`). Running it again updates rows instead of
 * duplicating them, and deletes passages the build no longer produces.
 *
 * With `--demo`, also creates demo accounts with a race history (see
 * db/seed/demo.ts). Never on the production server: their password is public.
 */
import { loadEnvConfig } from "@next/env";
import { notInArray, sql } from "drizzle-orm";
import * as z from "zod";
import { localeSchema } from "@/lib/i18n/config";
import { COMPLEXITIES } from "@/lib/rooms/settings";
import passagesJson from "./seed/passages.json";

loadEnvConfig(process.cwd());

const passageSchema = z.object({
  language: localeSchema,
  content: z.string().min(1),
  wordCount: z.int().positive(),
  complexity: z.enum(COMPLEXITIES),
  hasDigits: z.boolean(),
  sourceTitle: z.string().min(1),
  sourceAuthor: z.string().min(1),
  sourceRef: z.string().min(1),
});

const BATCH_SIZE = 100;

async function seedTexts(): Promise<void> {
  // Imported after loadEnvConfig so DATABASE_URL is set when it connects.
  const { getDb } = await import("./index");
  const { texts } = await import("./schema");
  const passages = z.array(passageSchema).parse(passagesJson);
  const db = getDb();

  for (let start = 0; start < passages.length; start += BATCH_SIZE) {
    await db
      .insert(texts)
      .values(passages.slice(start, start + BATCH_SIZE))
      .onConflictDoUpdate({
        target: texts.sourceRef,
        set: {
          content: sql`excluded.content`,
          wordCount: sql`excluded.word_count`,
          complexity: sql`excluded.complexity`,
          hasDigits: sql`excluded.has_digits`,
          sourceTitle: sql`excluded.source_title`,
          sourceAuthor: sql`excluded.source_author`,
        },
      });
  }
  const removed = await db
    .delete(texts)
    .where(
      notInArray(
        texts.sourceRef,
        passages.map((passage) => passage.sourceRef),
      ),
    )
    .returning({ id: texts.id });
  console.log(`texts: ${passages.length} passages, ${removed.length} removed`);
}

await seedTexts();
if (process.argv.includes("--demo")) {
  const { seedDemoHistory } = await import("./seed/demo");
  await seedDemoHistory();
}
process.exit(0);
