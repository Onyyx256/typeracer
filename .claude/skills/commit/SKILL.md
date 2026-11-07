---
name: commit
description: Create a small, meaningful git commit in this project's style. Use whenever a self-contained piece of work is finished (one feature step, one fix, one doc update) and it is time to commit, or when the user asks to commit.
argument-hint: "[optional note about what to commit]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(bun run lint:*), Bash(bunx tsc:*)
---

# Commit

The course grades the commit history: it must be regular and meaningful, and a repository delivered in a few huge commits is penalized. Each commit is one logical change that a reader understands from its message.

## Steps

1. **Look at what changed.** Run `git status` and `git diff` (and `git diff --staged`). If the changes cover several unrelated topics, split them into several commits, staging files (or hunks) per topic. Never use `git add -A` or `git add .` blindly: check that no secret (`.env`, keys), build output or scratch file is included (TECH-10).
2. **Check the code.** If any `.ts`/`.tsx` file changed, run `bun run lint` and `bunx tsc --noEmit`. If either fails, fix the problem or stop and tell the user. Do not commit broken code to make the history look regular.
3. **Write the message** in the style of the existing history (`git log -5` to see it):
   - Subject: `type: summary` in English, lowercase type, imperative or descriptive, max ~70 characters, no final period. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`.
   - Body (skip only for trivial changes): what changed and why, wrapped at ~72 columns. Use `- path: explanation` bullets when several files matter. Mention the requirement IDs covered, in parentheses, like `(AUTH-01, TECH-07)`.
   - Mention anything left unfinished, so the history stays honest.
   - No `Co-Authored-By` or other attribution trailer.
4. **Commit** with a heredoc so line breaks survive:
   ```bash
   git commit -m "$(cat <<'EOF'
   feat: summary here

   Body here (REQ-ID).
   EOF
   )"
   ```
5. **Report** the commit hash and subject in one line each.

## Rules

- Never push, amend a pushed commit, rebase or force anything unless the user asks in this conversation.
- Never commit on behalf of the user if they said not to commit yet.
- If `docs/EXIGENCES.md` should change because of this work and it hasn't, say so (the `/exigences` skill updates it).
- If `AGENTS.md` shows changes made by `next dev`, it is fine to include them in a `chore:` commit.
