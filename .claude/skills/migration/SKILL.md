---
name: migration
description: Change the database schema safely with Drizzle - edit db/schema.ts, generate and review a versioned migration, apply it locally, and keep the seed script in sync. Use whenever a table, column, index or constraint is added, changed or removed.
argument-hint: "<what changes in the database>"
---

# Database migration

TECH-04 requires PostgreSQL with versioned migrations in the repo and a seed script that creates demo data (text corpus, users, race history). Every schema change goes through these steps; never edit the database by hand or with `drizzle-kit push`.

Change to make: $ARGUMENTS

## Setup in this project

- Schema: `db/schema.ts` (Drizzle `pgTable` definitions, with comments that cite requirement IDs).
- Migrations: `db/migrations/` with readable names (`0000_create_users.sql`) and Drizzle's `meta/` folder. Both are committed.
- Local database: `bun run db:up` (Docker Compose, PostgreSQL 17). `DATABASE_URL` comes from `.env.local`, as in `.env.example`.
- Scripts: `bun run db:generate`, `bun run db:migrate`, `bun run db:studio`.

## Steps

1. **Design the change.** Read `db/schema.ts` and `docs/ARCHITECTURE.md` (data model diagram). Put rules in the database when the spec says the server must guarantee them, for example:
   - one room per person at a time, enforced by a unique constraint (SALLE-06);
   - unique 6-character room codes (SALLE-02);
   - capacity between 2 and 30 (SALLE-05), nickname length 3–20 (AUTH-02): `check` constraints;
   - foreign keys with an explicit `onDelete`;
   - indexes for columns that are filtered or sorted on (room browser, history pagination).
   Use `timestamp(..., { withTimezone: true })`, `uuid` ids like the `users` table, and export `$inferSelect` / `$inferInsert` types.
2. **Edit `db/schema.ts`.** Comment non-obvious columns and constraints with the requirement ID they serve.
3. **Generate the migration** with a descriptive snake_case name:
   ```bash
   bun run db:generate --name create_rooms
   ```
4. **Read the generated SQL.** Check that it does only what you meant. Watch for a dropped and recreated column (data loss) when you meant a rename, a `NOT NULL` column added to a table that already has rows without a default, and missing indexes or constraints. If it's wrong, delete the new migration file and its snapshot/journal entry, fix the schema, and generate again. Never edit a migration that has already been committed.
5. **Apply it locally:** `bun run db:up` if needed, then `bun run db:migrate`. If it fails, fix the cause; don't skip the migration.
6. **Update the seed script** so demo data still fits the new schema (TECH-04: text corpus, users, history). If no seed script exists yet, say so and offer to create one; don't create it without asking.
7. **Update the docs:** the data model diagram in `docs/ARCHITECTURE.md` when tables or relations change.
8. **Check:** `bun run lint` and `bunx tsc --noEmit`, so code using the changed tables still compiles.
9. **Commit** with `/commit`: the schema, the migration SQL and the `meta/` files go in the same commit (for example `feat: rooms table with unique code (SALLE-02)`). Seed and docs updates can be their own commits.

## Rules

- Never run a migration against the production database, and never drop tables or data, without the user's explicit approval in this conversation.
- No secrets in the seed script: demo passwords are hashed with the same Argon2id helper as signup (SEC-03), and the demo account's credentials go in the README.
