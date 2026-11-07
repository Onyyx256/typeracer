---
name: ai-journal
description: Log a situation where the AI (Claude or a subagent) got something wrong or produced inadequate code, how it was noticed and how it was fixed. Use when the user corrects a mistake made by the AI, when a review or test catches an AI-written bug, or when the user asks to note something for docs/IA.md.
argument-hint: "[short description of what went wrong]"
---

# AI journal

`docs/IA.md` (final delivery) must describe **3 situations where the AI was wrong or produced inadequate code**, how the student detected it and how they fixed it, plus the agents and tools used. These are easy to forget by the end of the term, so log them as they happen in `docs/IA-JOURNAL.md`.

## Steps

1. If `docs/IA-JOURNAL.md` does not exist, create it with the title `# Journal IA` and one sentence explaining it collects raw notes for `docs/IA.md`.
2. Append one entry at the end, in French (the course language), using this template:

   ```markdown
   ## AAAA-MM-JJ — <titre court>

   - **Outil / agent :** <Claude Code, quel agent ou skill>
   - **Ce que l'IA a fait :** <le code ou le choix inadéquat, avec fichier si utile>
   - **Comment je l'ai détecté :** <test qui échoue, revue, essai dans le navigateur, lecture de la spec…>
   - **Correction :** <ce qui a été changé, commit si connu>
   - **Leçon :** <une phrase : ce que je ferai différemment avec les agents>
   ```

3. Use today's date. Write only what actually happened in this conversation or what the user tells you; never invent or embellish a situation. If a detail is unknown (for example the fix isn't done yet), write `à compléter`.
4. Keep the entry short (5–8 lines). Tell the user the entry was added, in one line.

## Notes

- Mistakes count even when they were caught quickly: wrong Next.js API from an older version, a missing server-side check, a requirement misread, an invented library option, a test that passed for the wrong reason.
- Do not commit the journal by itself for every entry; it can go with the next related commit.
