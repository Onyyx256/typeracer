import { sql } from "drizzle-orm";
import {
  check,
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
