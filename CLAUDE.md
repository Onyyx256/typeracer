@AGENTS.md

# Typeracer — Web V term project

Real-time multiplayer typing race (Next.js 16, TypeScript, Tailwind, PostgreSQL with Drizzle, Bun). Individual course project; the requirements have IDs (TECH-xx, COURSE-xx...) summarized in `.claude/skills/exigences/requirements.md` and tracked in `docs/EXIGENCES.md`.

## Commits: small and often

The commit history is graded: it must be regular and meaningful, and a few huge commits are penalized.

- Commit after every finished, self-contained step (one migration, one server action, one component, one test file, one doc update), using the `/commit` skill. Do not wait for a whole feature to be done.
- One topic per commit. If a change mixes topics, split it into several commits.
- Lint and type check must pass before each commit.
- Subagents don't commit; they report back and the main session commits their work.
- Never push or deploy without the user's explicit approval.

## Workflow

- `/feature <IDs>` builds a feature step by step with the project's subagents (`.claude/agents/`).
- `/exigences` keeps the traceability matrix honest: never mark a requirement `complet` unless it fully is.
- `/ai-journal` logs every AI mistake that gets caught, for `docs/IA.md`.
- `/migration` is the only way to change the database schema (versioned Drizzle migrations, seed kept in sync).
- `/livrables checkpoint|final` checks the deliverables before a deadline.

## Hard rules

- TECH-02: only `.ts`/`.tsx`, no explicit `any`, no `@ts-ignore` without a justifying comment.
- TECH-07: every server-side input (server actions, API routes, real-time messages) is validated with Zod.
- DES-01, DES-02: the site name and logo are made by the student without AI. Never generate or change them.
