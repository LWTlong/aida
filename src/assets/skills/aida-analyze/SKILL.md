---
name: aida-analyze
description: Use when the user wants to analyze the current branch/feature — what changed, why, and what to remember. Produces a structured analysis and persists it via aida_write_analysis.
---

# AIDA Analyze

## Goal
Produce a concise, structured analysis of the current feature branch: what changed, the key decisions made, constraints discovered, and what the next developer should know. Then persist it so future sessions can recall it.

## Steps

1. **Gather context**
   - Run `git rev-parse --abbrev-ref HEAD` to confirm the current branch name.
   - Run `git log $(git merge-base HEAD origin/main)..HEAD --oneline` and `git diff $(git merge-base HEAD origin/main)..HEAD --stat` to scope the changes. Fall back to `main` → `master` → ask the user if `origin/main` is not found.
   - Read any relevant source files if the user provides specific paths.

2. **Identify the module** — Determine the primary module key (e.g. `auth/login`, `billing/checkout`). Use kebab-case path format matching the source directory structure.

3. **Extract the key facts**:
   - What was the requirement or ticket?
   - What was the core technical approach?
   - What constraints or gotchas were discovered?
   - What decisions were made, and why?
   - Which files are entry points or hotspots?

4. **Call `aida_write_analysis`** with the structured data (see Output Format below).

5. **Report** what was saved.

## Output Format

After saving, report:

### Analysis Saved
**Module**: `<moduleKey>`
**Ticket**: `<ticket or "none">`

**Summary**: one sentence describing what this branch does.

**Key decisions** (up to 5):
- ...

**Constraints** (up to 3):
- ...

**Entry files** (up to 5):
- ...

## Rules
- If git is unavailable, ask the user to describe what changed.
- Keep summary under 120 chars.
- Decisions should explain WHY, not just WHAT.
- Constraints are non-obvious limits: performance ceilings, data shape assumptions, external API quirks, etc.
- Do NOT invent data — only record facts from the diff or source files.
