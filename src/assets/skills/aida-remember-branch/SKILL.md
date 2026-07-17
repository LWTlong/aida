---
name: aida-remember-branch
description: Use at PR time or after a feature branch is merged to extract and persist all decisions from the branch diff. The main memory command — triggered at PR/test time to batch-record what was learned during a feature.
---

# AIDA Remember Branch

## Goal
At the end of a feature branch, read the git diff and extract the important decisions that were made. Record each as a separate MADR decision so future Claude sessions know WHY the code is written this way.

## Steps

### Phase 1 — Read the Diff
Run `git log <base>..<branch> --oneline` and `git diff <base>..<branch>` to understand what changed.
Use `git rev-parse --abbrev-ref HEAD` if you don't know the branch name, and `git merge-base HEAD origin/main` (or `origin/master`) to find the right base if `main` isn't clear.

Focus on:
- Non-obvious choices (why this algorithm, this data shape, this approach)
- Workarounds (what bug, external API constraint, or deadline forced a suboptimal solution)
- Constraints discovered (e.g. "this API doesn't support pagination", "this table has no index on X")
- Things intentionally NOT done (and why)

### Phase 2 — Identify Decisions
For each potential decision, ask:
- Is this obvious from the code name or structure alone? → skip
- Would a developer unfamiliar with this PR be confused or make the wrong choice? → record it
- Is it scoped to specific files, or does it affect the whole project?

### Phase 3 — Record Each Decision
For each non-obvious decision, call the **`aida_remember` MCP tool** directly with:
- `title`: "Use X for Y" or "Don't do X in this module" (active voice, specific)
- `context`: the constraint, bug, or requirement that forced this choice
- `decision`: what was chosen and why
- `consequences`: what breaks if you undo it, what improves
- `paths`: file glob patterns scoping this decision (e.g. `["src/auth/**"]`) — if global, omit

### Phase 4 — Summary
After recording all decisions, report:

> ✓ **Branch memory saved**: N decisions recorded
>
> | Decision | Paths |
> |----------|-------|
> | Use JWT refresh rotation | `src/auth/**` |
> | Skip ORM for bulk inserts | `src/ingestion/**` |
> | ... | ... |
>
> Run `/aida:recall` to review all decisions, or `/aida:undo` to reverse the last write.

## Rules
- Quality over quantity: 3 sharp decisions > 20 vague ones
- Do not record decisions that are clear from the code name or structure
- Do not invent decisions — only record facts from the diff
- If there's nothing non-obvious in the diff, say so and record nothing
- Keep each decision atomic: one title, one context, one path scope
