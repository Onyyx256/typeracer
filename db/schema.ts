import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Login identifier. Unique regardless of case, see the index below. */
    username: text("username").notNull(),
    /** Name shown in rooms and on the profile; the user can change it (AUTH-05). */
    displayName: text("display_name").notNull(),
    /**
     * Argon2id hash, never the password itself. Null for accounts that only
     * sign in through OAuth.
     */
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
    check(
      "users_username_length",
      sql`char_length(${table.username}) between 3 and 20`,
    ),
    check(
      "users_display_name_length",
      sql`char_length(${table.displayName}) between 3 and 20`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Passages for coherent texts (CONF-03), from public-domain books. A race
 * takes a run of whole sentences out of one passage; see lib/texts/.
 */
export const texts = pgTable(
  "texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    language: text("language").notNull(),
    content: text("content").notNull(),
    wordCount: integer("word_count").notNull(),
    /** From the passage's score (CONF-05), see lib/texts/complexity.ts. */
    complexity: text("complexity").notNull(),
    /** Passages with digits are skipped when numbers are off (CONF-06). */
    hasDigits: boolean("has_digits").notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceAuthor: text("source_author").notNull(),
    /** "gutenberg:<book id>:<passage index>", so the seed can run twice. */
    sourceRef: text("source_ref").notNull(),
  },
  (table) => [
    uniqueIndex("texts_source_ref_idx").on(table.sourceRef),
    index("texts_language_complexity_idx").on(table.language, table.complexity),
    check("texts_language", sql`${table.language} in ('fr', 'en')`),
    check(
      "texts_complexity",
      sql`${table.complexity} in ('easy', 'medium', 'hard')`,
    ),
  ],
);

export type Text = typeof texts.$inferSelect;
export type NewText = typeof texts.$inferInsert;
