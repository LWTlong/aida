---
name: aida-remember
description: Use when the user says "remember this decision", "record why we did X", or wants to save a single project-level technical decision for future Claude sessions to load.
---

# AIDA Remember

## Goal
Persist one project decision as a MADR-format file in `.claude/rules/decisions/` so future Claude sessions can load it automatically via `paths` frontmatter.

## Steps

1. **Understand the decision** — Ask the user (or infer from context):
   - **Title**: short phrase naming the decision, e.g. "Use optimistic locking for cart updates"
   - **Context**: why was this decision needed? What problem, constraints, alternatives were considered?
   - **Decision**: what was decided and why?
   - **Consequences** (optional): trade-offs, things that changed
   - **Paths** (optional): file globs this decision applies to, e.g. `["src/cart/**", "src/orders/**"]`

2. **Call `aida_remember`** with the structured data.

3. **Confirm** to the user:

> ✓ Decision saved: **`<title>`**
> File: `.claude/rules/decisions/<slug>.md`
> Paths scope: `<paths or "global">`
>
> This decision will be auto-loaded by Claude Code when you edit files matching the paths pattern.

## Tips for Good Decisions
- Title: "Use X for Y" or "Don't use X because Y" — active voice, specific
- Context: include what you tried, what failed, what constraints forced the choice
- Paths: if the decision only applies to one module, scope it — this prevents context bloat in unrelated sessions
- Consequences: be honest about trade-offs — future developers need to know the ceiling, not just the choice
