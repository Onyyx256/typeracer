import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  HostRole,
  RaceConfig,
  RoomState,
  Visibility,
} from "@/lib/rooms/settings";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Login identifier. Unique regardless of case, see the index below. Null
     * for guests, who never log in (AUTH-02).
     */
    username: text("username"),
    /**
     * A guest only has a nickname (display name) and the session cookie that
     * points at this row: no password, no history (AUTH-02, AUTH-03).
     */
    isGuest: boolean("is_guest").notNull().default(false),
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
    // Accounts always have a username, guests never do.
    check(
      "users_guest_has_no_username",
      sql`${table.isGuest} = (${table.username} is null)`,
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

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SALLE-02: 6 characters, without 0/O and 1/I/L. */
    code: text("code").notNull(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibility: text("visibility").$type<Visibility>().notNull(),
    capacity: integer("capacity").notNull(),
    state: text("state").$type<RoomState>().notNull().default("waiting"),
    /** Everything else the host configures (CONF-01 to CONF-09). */
    config: jsonb("config").$type<RaceConfig>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("rooms_code_idx").on(table.code),
    // The room browser lists public rooms that aren't closed (JOIN-02).
    index("rooms_visibility_state_idx").on(table.visibility, table.state),
    check("rooms_code_format", sql`${table.code} ~ '^[A-HJKMNP-Z2-9]{6}$'`),
    check(
      "rooms_visibility",
      sql`${table.visibility} in ('public', 'code', 'private')`,
    ),
    check("rooms_capacity", sql`${table.capacity} between 2 and 30`),
    check(
      "rooms_state",
      sql`${table.state} in ('waiting', 'countdown', 'racing', 'results', 'closed')`,
    ),
  ],
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export const roomMembers = pgTable(
  "room_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<HostRole>().notNull(),
    /**
     * The name shown in this room, chosen on entry (it defaults to the
     * user's display name). Unique within the room, see the index below.
     */
    name: text("name").notNull(),
    /** The longest-present member becomes host when the host leaves (SALLE-08). */
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // SALLE-06: one room per person at a time, whatever the interface does.
    uniqueIndex("room_members_user_idx").on(table.userId),
    index("room_members_room_idx").on(table.roomId, table.joinedAt),
    // Two members of a room never share a name, whatever its case.
    uniqueIndex("room_members_room_name_idx").on(table.roomId, sql`lower(${table.name})`),
    check("room_members_name_length", sql`char_length(${table.name}) between 3 and 20`),
    check("room_members_role", sql`${table.role} in ('participant', 'spectator')`),
  ],
);

export type RoomMember = typeof roomMembers.$inferSelect;
export type NewRoomMember = typeof roomMembers.$inferInsert;
