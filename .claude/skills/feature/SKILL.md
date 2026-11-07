---
name: feature
description: Build a feature of the typing-race project end to end, from requirement IDs to reviewed, tested, committed code, delegating to the project's subagents. Use when the user asks to build or implement a feature or a requirement ID.
argument-hint: "<requirement IDs or feature description>"
disable-model-invocation: true
---

# Build a feature

You (the main session) coordinate. Subagents do focused work and report back; they cannot start other subagents, so every hand-off goes through you. Feature to build: $ARGUMENTS

## 1. Understand

- Look up the requirement IDs in [../exigences/requirements.md](../exigences/requirements.md). If the user gave a description instead of IDs, find the matching IDs and confirm them with the user.
- Read the current code that the feature touches and `docs/ARCHITECTURE.md`.
- If a requirement is ambiguous, propose a reasonable choice to the user; it will be documented in `docs/EXIGENCES.md`.

## 2. Plan in small steps

Split the feature into steps that are each **one commit**: one schema/migration, one server action, one component, one test file... Aim for steps that take minutes, not hours. Show the plan to the user in a few lines before starting if the feature is larger than 2–3 steps.

## 3. For each step

1. **Build** with the right agent:
   - `websocket-engineer`: real-time server, rooms over WebSocket, progress messages, reconnection, bots running in the race loop.
   - `nextjs-typescript`: pages, components, server actions, API routes, Zod schemas, Drizzle queries.
   - `deployment-engineer`: CI, VPS, HTTPS, environment variables.
   Give the agent the requirement IDs, the files involved and what "done" means for this step only.
2. **Test** with `test-automator` when the step contains logic (formulas, ranking, state machine, bonuses, bot engine) or a user flow worth an e2e test. Tests can be their own commit.
3. **Review** with `surgeon-reviewer` on the uncommitted diff. Fix every WILL BREAK finding before committing; mention WILL COST/WILL ROT findings to the user.
4. **Commit** with the `/commit` skill. Do not batch several steps into one commit.

If an agent made a mistake that you or the user caught (wrong API, missing check, misread requirement), log it with `/ai-journal`.

## 4. Finish

- Run `/exigences` with the feature's IDs so the matrix reflects what is really done, and commit that update.
- For UI features, consider asking `a11y-perf-auditor` to check the new pages.
- Report to the user: what works now, which requirement IDs are complete or partial, what is left, and the list of commits made.

## Rules

- Never push or deploy without the user's explicit approval.
- Never create or edit the site name or logo (DES-01, DES-02 must be made by the student without AI).
