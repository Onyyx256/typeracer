---
name: exigences
description: Update docs/EXIGENCES.md, the requirements traceability matrix, after work that changes the status of one or more requirement IDs (TECH-xx, AUTH-xx, COURSE-xx...). Use after finishing or partly finishing a feature, adding tests for one, or making a choice about an ambiguous requirement, or when the user asks to update or check the matrix.
argument-hint: "[requirement IDs, or 'all' to audit the whole matrix]"
---

# Requirements matrix

`docs/EXIGENCES.md` is graded. The final version is a traceability matrix with one row per requirement ID. **A requirement declared complete when it isn't is penalized more than one honestly declared partial or not done.** When in doubt, mark it partial and say what is missing.

The list of every ID with a one-line summary is in [requirements.md](requirements.md). Read it to know what each requirement asks.

## Target format

The matrix is in French, like the rest of the course docs:

```markdown
| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| AUTH-01 | partiel | `lib/auth/session.ts`, `app/login/` | `e2e/login.spec.ts` | Connexion par mot de passe faite; OAuth Discord/GitHub pas encore. |
```

- **Statut** is exactly one of `complet`, `partiel`, `non fait`.
- **Fichiers principaux**: the 1–3 files where the requirement mainly lives, as relative paths.
- **Tests associés**: test files that cover it, or `—`.
- **Notes et choix**: what is missing if partial, and any reasonable choice made for an ambiguous requirement (spec section 2.2 says documented choices are not penalized).
- Group rows by section (TECH, DES, AUTH, SALLE, JOIN, CONF, COURSE, BOT, BONUS, RES, HIST, I18N, TEST, PERF, A11Y, SEC), with a `##` heading per section.

If the file still uses the old per-section format, convert it to this format (keep its intro sentence and keep the existing explanations by moving them into the Notes column of the matching rows). Every ID from `requirements.md` must appear, including those not started (`non fait`).

## Steps

1. Read `docs/EXIGENCES.md` and the requirement summaries for the IDs involved (or all of them for `all`).
2. For each ID, **check the code, don't trust memory**: find the files that implement it (Grep/Glob), check whether every part of the requirement is covered, and look for tests that exercise it.
3. Update the rows. Never upgrade a status to `complet` unless every bullet of that requirement is implemented and works. Deployment requirements (TECH-05) are complete only if production actually matches.
4. Show the user a short list of the rows you changed (ID: old status → new status, one reason each). Ask before marking anything `complet` that you could not verify by reading code or running tests.
