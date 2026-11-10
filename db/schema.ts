import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { BonusKind } from "@/lib/race/bonuses";
import type { ResultStatus, WpmPoint } from "@/lib/race/types";
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
    /** Null for guests. Unique regardless of case, see the index below. */
    username: text("username"),
    isGuest: boolean("is_guest").notNull().default(false),
    displayName: text("display_name").notNull(),
    /** Null for accounts that only sign in through OAuth. */
    passwordHash: text("password_hash"),
    /**
     * Ids from lib/profile/cosmetics.ts. No check constraint, so the palette can
     * grow without a migration; an unknown id is shown as the default.
     */
    stemColor: text("stem_color").notNull().default("classic"),
    petalColor: text("petal_color").notNull().default("classic"),
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

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/** In its own table so reading a user never loads the image. */
export const userAvatars = pgTable(
  "user_avatars",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    image: bytea("image").notNull(),
    /** Part of the photo's URL, so a new photo is never served from cache. */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The upload is resized to 256 px, a few dozen KB at most.
    check("user_avatars_size", sql`octet_length(${table.image}) <= 512 * 1024`),
  ],
);

export type UserAvatar = typeof userAvatars.$inferSelect;

export const texts = pgTable(
  "texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    language: text("language").notNull(),
    content: text("content").notNull(),
    wordCount: integer("word_count").notNull(),
    complexity: text("complexity").notNull(),
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
    code: text("code").notNull(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibility: text("visibility").$type<Visibility>().notNull(),
    capacity: integer("capacity").notNull(),
    state: text("state").$type<RoomState>().notNull().default("waiting"),
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
    /** Defaults to the user's display name. Unique within the room, see the index below. */
    name: text("name").notNull(),
    /** The longest-present member becomes host when the host leaves. */
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One room per person at a time, whatever the interface does.
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

export const roomBans = pgTable(
  "room_bans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Also the index joinRoom looks the ban up with.
    uniqueIndex("room_bans_room_user_idx").on(table.roomId, table.userId),
  ],
);

export type RoomBan = typeof roomBans.$inferSelect;
export type NewRoomBan = typeof roomBans.$inferInsert;

export const races = pgTable(
  "races",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kept if the room goes away, so the participants' history stays. */
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    textId: uuid("text_id").references(() => texts.id, { onDelete: "set null" }),
    /** The exact text typed, so the results can be shown again. */
    content: text("content").notNull(),
    config: jsonb("config").$type<RaceConfig>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("races_room_ended_idx").on(table.roomId, table.endedAt),
    check("races_ended_after_start", sql`${table.endedAt} >= ${table.startedAt}`),
  ],
);

export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;

/**
 * Guests get a row too, so the full table can be shown again, but without
 * `user_id`: it never becomes their history.
 */
export const raceResults = pgTable(
  "race_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raceId: uuid("race_id")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    /** Null for a guest, or for an account deleted since. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    isGuest: boolean("is_guest").notNull(),
    rank: integer("rank").notNull(),
    status: text("status").$type<ResultStatus>().notNull(),
    wpm: real("wpm").notNull(),
    rawWpm: real("raw_wpm").notNull(),
    /** Null when they gave up: a partial run's accuracy doesn't count. */
    accuracy: real("accuracy"),
    errors: integer("errors").notNull(),
    progress: real("progress").notNull(),
    durationMs: integer("duration_ms").notNull(),
    wpmSeries: jsonb("wpm_series").$type<WpmPoint[]>().notNull(),
    missedKeys: jsonb("missed_keys").$type<Record<string, number>>().notNull(),
    bonuses: jsonb("bonuses").$type<BonusKind[]>().notNull().default([]),
  },
  (table) => [
    uniqueIndex("race_results_race_rank_idx").on(table.raceId, table.rank),
    // One row per account per race; guests (null) aren't constrained.
    uniqueIndex("race_results_race_user_idx").on(table.raceId, table.userId),
    index("race_results_user_idx").on(table.userId),
    check("race_results_rank", sql`${table.rank} >= 1`),
    check(
      "race_results_status",
      sql`${table.status} in ('finished', 'timeUp', 'abandoned')`,
    ),
    check("race_results_progress", sql`${table.progress} between 0 and 1`),
    check("race_results_accuracy", sql`${table.accuracy} between 0 and 100`),
    check(
      "race_results_abandoned_no_accuracy",
      sql`(${table.status} = 'abandoned') = (${table.accuracy} is null)`,
    ),
    check("race_results_guest_has_no_user", sql`not (${table.isGuest} and ${table.userId} is not null)`),
  ],
);

export type RaceResult = typeof raceResults.$inferSelect;
export type NewRaceResult = typeof raceResults.$inferInsert;
