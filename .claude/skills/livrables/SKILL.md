---
name: livrables
description: Check the project against the course deliverables before a deadline - checkpoint 1 (week 7) or the final delivery (week 11) - and report what is done, missing or at risk. Read-only. Use when the user asks if they are ready for the checkpoint or the final delivery, or what is left to hand in.
argument-hint: "checkpoint | final"
disable-model-invocation: true
---

# Deliverables check

Which deadline: $ARGUMENTS (if empty, ask: `checkpoint` or `final`).

This is a **read-only** check. Do not fix anything during the check: report, then let the user choose what to do next. For each item, look at the actual files, code, commands or URLs. Never mark something done from memory or from what a doc claims. Requirement summaries are in [../exigences/requirements.md](../exigences/requirements.md).

## Checkpoint 1 (section 7, 15% of the final grade)

Grading: requirements doc 20, creative process 20, architecture 20, production deployment 20, room by code in real time 10, CI + language/theme + code quality + matrix 10.

1. **`docs/DEMARCHE-CREATIVE.md`** (DES-01 to DES-03): names considered and why the final one was chosen; sketches and logo (images present in `docs/` and linked); moodboard with 3–5 references; palette; typography. Name and logo are final at this checkpoint. **Do not write or suggest names or logo content** (they must come from the student without AI): only report what is missing.
2. **`docs/ARCHITECTURE.md`**, initial version: data model diagram; race state machine (COURSE-01: EN_ATTENTE → DÉCOMPTE → EN_COURSE → RÉSULTATS → EN_ATTENTE | FERMÉE); ADR on the real-time technology; planned approach for bots.
3. **Production deployment** on a VPS (TECH-05), public over HTTPS, with:
   - working authentication (AUTH-01);
   - database and migrations (TECH-04);
   - room creation and join by code, with the list of people present updating in real time (SALLE-01, SALLE-02, JOIN-01);
   - working language and theme switchers on existing pages (I18N-02, DES-05);
   - visual identity applied: logo, palette, typography.
   Ask the user for the production URL if you don't know it, and check what you can reach (HTTPS, pages load). Say clearly what you could not verify.
4. **CI** (TECH-09): `.github/workflows/` runs lint, `tsc --noEmit` and unit tests on every push, and at least a few unit tests exist.
5. **`docs/EXIGENCES.md`**, initial version: every requirement listed with its current status.

## Final delivery (section 8, 30% of the final grade)

Grading: requirements doc 10, main features 25, configuration/bots/bonuses 10, design 10, code quality 15, tests and CI 10, performance and accessibility 10, documentation 10. Penalties: app not deployed or not working in production; JavaScript or `any` present; false statements in the matrix.

1. **GitHub repository** shared with the teacher. **Commit history** regular and meaningful: run `git log --format='%ad %s' --date=short` and flag long gaps, huge commits (`git log --shortstat`) and vague messages.
2. **Production URL** working.
3. **`README.md`**: presentation and screenshots; technologies; local install with PostgreSQL via Docker Compose; environment variables; commands to run the tests; demo account username and password. Flag leftover create-next-app text.
4. **`docs/ARCHITECTURE.md`**, final: data model diagram; race state machine; real-time message flow; ADRs on the real-time technology **and** on bot handling.
5. **`docs/EXIGENCES.md`**: traceability matrix (ID | status | main files | tests | notes) covering every ID. Spot-check rows marked `complet` against the code; flag any that look overstated (`/exigences all` can do a full pass).
6. **`docs/DEMARCHE-CREATIVE.md`**: name, logo and art direction, with images.
7. **`docs/IA.md`** (1–2 pages): agents and tools used; agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.claude/agents/`, `.claude/skills/`) committed; 3 situations where the AI was wrong, how it was detected and fixed (`docs/IA-JOURNAL.md` has the raw notes); a short reflection on working with agents.
8. **Hard constraints:** no `.js`/`.jsx` files in the repo (`git ls-files '*.js' '*.jsx' '*.mjs' '*.cjs'`, ignoring generated config only if justified); `strict: true`; ESLint `no-explicit-any` as error; no unjustified `@ts-ignore`/`@ts-expect-error`; `.env.example` complete and no secret committed (TECH-10); a seed script exists (TECH-04); Playwright e2e tests exist (TEST-02).

## Report

1. A table: deliverable | status (`ok`, `partiel`, `manquant`, `non vérifié`) | what is missing, worst first.
2. The 3 items that would cost the most points if left as they are, given the grading weights above.
3. What you could not check and why (no production URL, no server running, no access to GitHub settings...).
