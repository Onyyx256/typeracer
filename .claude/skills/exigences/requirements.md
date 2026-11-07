# Requirement IDs (short summary)

One-line summaries of the requirements in the course spec, *Web V — Travail de session*. The full spec PDF is the reference when a summary is not precise enough; ask the user for it rather than guessing.

## TECH — Technical constraints
- TECH-01 — Next.js (App Router, current stable) with React.
- TECH-02 — 100% TypeScript: no .js/.jsx files, `strict: true`, no explicit `any` (ESLint rule as error), no `@ts-ignore`/`@ts-expect-error` without a justifying comment.
- TECH-03 — Tailwind CSS for styling.
- TECH-04 — PostgreSQL with an ORM; migrations versioned in the repo; seed script creating demo data (text corpus, users, history).
- TECH-05 — Deployed on a VPS, public over HTTPS, working in production at checkpoint 1 and final delivery.
- TECH-06 — Real-time visualization of participants' progress (technology free).
- TECH-07 — Every server-side input validated by a schema (Zod or equivalent): server actions, API routes, real-time messages.
- TECH-08 — Costs: only the server may cost money; other services on free tiers; grading must cost the teacher nothing.
- TECH-09 — GitHub Actions CI: every push runs lint, `tsc --noEmit` and unit tests.
- TECH-10 — `.env.example` documents every environment variable; no secret committed.

## DES — Visual identity and design
- DES-01 — Site name found by the student, without AI; original; process documented in `docs/DEMARCHE-CREATIVE.md`.
- DES-02 — Logo designed by the student, without AI; sketches attached; used in the app and as favicon.
- DES-03 — Art direction documented before development: moodboard (3–5 references), color palette, typography.
- DES-04 — Unique design, not "default generated" (no stock shadcn/ui, generic purple hero gradient, emoji icons, SaaS landing layout). The progress track is a signature design element.
- DES-05 — Light and dark themes: switcher, system preference by default, no flash of the wrong theme.
- DES-06 — Responsive from 360 px wide; on mobile the race is replaced by a message recommending a physical keyboard.

## AUTH — Accounts and profile
- AUTH-01 — OAuth with both Discord and GitHub; username/password login also allowed (used for e2e tests).
- AUTH-02 — A guest picks a nickname (3–20 characters) before joining a room; session kept in a signed cookie.
- AUTH-03 — A guest cannot create a room; no persistent history, no profile photo (generated avatar instead).
- AUTH-04 — Signed-in user can upload a profile photo: JPEG/PNG/WebP, max 2 MB validated server-side, resized before display.
- AUTH-05 — Signed-in user can change their display name.
- AUTH-06 — Profile page with stats: best WPM, average WPM, average accuracy, number of races, wins, WPM-over-time chart.

## SALLE — Rooms and visibility
- SALLE-01 — Signed-in user creates a room and becomes host; host chooses participant or spectator.
- SALLE-02 — Unique 6-character alphanumeric room code without ambiguous characters (0/O, 1/I/L).
- SALLE-03 — Visibility: public (listed, join directly or by code), code-only (not listed, code or invite link), private (invite link only).
- SALLE-04 — Invite links: one per guest, list/copy/status in the UI; token ≥ 128 bits of entropy; single use, bound to the first user's IP; reusable by that person; revoked on kick; all invalid when the room closes; code alone never enough for a private room.
- SALLE-05 — Host sets max capacity (2–30 participants); spectators don't count.
- SALLE-06 — One room per person at a time, enforced server-side by a DB constraint; offer to leave the current room; a second tab doesn't create a duplicate.
- SALLE-07 — Host can kick a participant or spectator; they can't rejoin that room.
- SALLE-08 — If the host leaves, host passes to the longest-present connected human; if none, the room closes.
- SALLE-09 — Joining only while waiting or on the results screen, never during a race.
- SALLE-10 — Room code brute-force protection: rate limit per IP (e.g. 10/minute).

## JOIN — Joining a race
- JOIN-01 — Join-by-code field available from the home page.
- JOIN-02 — Room browser: public rooms with participants/capacity, text language, complexity, host and state; filters by language and complexity; updates without manual reload.
- JOIN-03 — "Quick race" button: picks the joinable, non-full public room closest to capacity (tie: oldest). If none: signed-in user is offered to create a public room with default config; guest sees an empty state.

## CONF — Race configuration (host, editable between races)
- CONF-01 — Time limit: none, or 30 s to 10 min.
- CONF-02 — Text language: French or English (independent from UI language).
- CONF-03 — Text type: coherent (real passages from a DB corpus) or random (dictionary words).
- CONF-04 — Text length in words.
- CONF-05 — Complexity easy/medium/hard with measurable, documented criteria.
- CONF-06 — Toggles: punctuation, numbers, capitals, accents (French).
- CONF-07 — Characters to include/exclude (random text); in coherent mode either disabled or only compatible passages; documented.
- CONF-08 — Error mode: mandatory correction, or free (error counted).
- CONF-09 — Catch-up bonuses on/off.
- CONF-10 — Add/remove bots, each with a level.
- CONF-11 — Visibility and capacity (see SALLE-03, SALLE-05).
- CONF-12 — Everyone in the room sees the configuration in real time.

## COURSE — Race flow
- COURSE-01 — Explicit documented state machine: EN_ATTENTE → DÉCOMPTE → EN_COURSE → RÉSULTATS → (EN_ATTENTE | FERMÉE).
- COURSE-02 — Host can start only with ≥ 2 participants including ≥ 1 human (bots count, spectators don't).
- COURSE-03 — Synchronized 3-2-1 countdown; text revealed only when the countdown starts.
- COURSE-04 — Typing area: immediate feedback (correct, incorrect, cursor), live WPM and accuracy, paste disabled.
- COURSE-05 — Real-time track: each participant with avatar, name, position, current WPM; smooth (interpolation, ~4+ perceived updates/s); local player highlighted; spectators see the track without typing area.
- COURSE-06 — Authoritative server for start/end time, progress, ranking and bonuses; rejects impossible progress (jumps, unrealistic speed).
- COURSE-07 — Player can abandon, with confirmation.
- COURSE-08 — Reload/disconnect: resumes where they were if back within 30 s; after that, counted as abandoned.
- COURSE-09 — Race ends when everyone finished or abandoned, or the time limit is reached.
- COURSE-10 — Final ranking: finishers by finish time, then unfinished by progress, then abandoned by progress at abandon time.
- COURSE-11 — On results, host can restart with the same participants (config editable) or close the room; others can stay or leave.

## BOT — Bots
- BOT-01 — Five levels (Noob 10–20 WPM ~12% errors, Débutant 20–35 ~8%, Intermédiaire 35–60 ~5%, Expert 70–100 ~2%, Impossible 140+ ~0.5%); adjustable but documented.
- BOT-02 — Speed varies during the race (bursts, hesitations, slower on hard words); constant speed not accepted.
- BOT-03 — Bots make errors that slow them (correction time) and respect the error mode.
- BOT-04 — Bots clearly identified in the UI; subject to bonuses and penalties like humans.
- BOT-05 — Bot engine deterministic from a seed, unit-testable.

## BONUS — Catch-up bonuses
- BONUS-01 — When on, a trailing player (last, or > 25% progress behind the leader) gets a bonus at checkpoints (leader passes 25%, 50%, 75%); max 3 per player per race; exact rule documented.
- BONUS-02 — At least 3 bonus types, at least one helping the trailing player and one slowing the leader (e.g. +3 words for leader, −3 words for trailer, fog on the leader's next words).
- BONUS-03 — Bonus activation shown visually on the track and to the targeted player.
- BONUS-04 — Progress and WPM stay consistent when a bonus lengthens or shortens the text.

## RES — Results and statistics
- RES-01 — Top-3 podium.
- RES-02 — Full table: rank, participant, WPM, raw WPM, accuracy, errors, time, status (finished / time up / abandoned), bonuses received.
- RES-03 — At least 2 charts, including WPM over time for all participants on one chart, and the player's most-missed keys (e.g. keyboard heatmap).
- RES-04 — Personal-best indicator.
- RES-05 — Results of every signed-in human persisted, including the WPM time series.

## HIST — History
- HIST-01 — Each finished race appears in the signed-in user's history, paginated.
- HIST-02 — Clicking a history entry shows its full results page again.

## I18N — Internationalization
- I18N-01 — All UI text in French and English (labels, errors, empty states, page metadata); no hard-coded strings.
- I18N-02 — Language switcher on every page; choice kept (cookie or profile); browser language by default.
- I18N-03 — Dates and numbers formatted for the chosen language.

## TEST — Tests
- TEST-01 — Unit tests on the logic.
- TEST-02 — End-to-end tests with Playwright.
- TEST-03 — E2E tests use username/password login, not OAuth.

## PERF — Performance
- PERF-01 — Lighthouse ≥ 90 in every category on the home page.
- PERF-02 — Progress updates batched or throttled (e.g. ≤ 10 messages/s per player); no DB write per keystroke.
- PERF-03 — Track stays smooth at max capacity.

## A11Y — Accessibility
- A11Y-01 — WCAG AA text contrast in both themes.
- A11Y-02 — Correct tags: `<button>` for actions, `<a>` for navigation, logical `<h1>`–`<h6>`, `<header>`/`<nav>`/`<main>`/`<footer>`, `<table>` for tabular data.
- A11Y-03 — Images have alt text; form fields have labels.
- A11Y-04 — Keyboard navigable with a visible focus indicator.

## SEC — Security
- SEC-01 — All host-only actions (start, configure, generate links, kick, close) authorized server-side.
- SEC-02 — Uploads validated server-side: real file type and size.
- SEC-03 — Passwords hashed with Argon2, bcrypt or scrypt; never stored or logged in clear.

## Annex A — Formulas
- WPM (net) = (correctly typed characters ÷ 5) ÷ elapsed minutes
- Raw WPM = (all typed characters ÷ 5) ÷ elapsed minutes
- Accuracy = correct keystrokes ÷ total keystrokes × 100
- Progress = validated characters ÷ total text length (counting words added or removed by bonuses)
- Spaces count as characters.

## Final matrix format (section 8)
Columns: ID | Status (complet / partiel / non fait) | Main files | Associated tests | Notes and choices.
A requirement declared complete that is not is penalized more than one honestly declared partial or not done.
