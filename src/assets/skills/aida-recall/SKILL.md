---
name: aida-recall
description: Use when the user asks "what do we know about X", "why did we do Y", "what decisions were made for this module", or wants to browse project decisions.
---

# AIDA Recall

## Goal
Surface relevant project decisions from `.claude/rules/decisions/`. Help the user understand why the code is written the way it is.

## Steps

1. Call `aida_recall` with `action: "list"` to get all decisions.
2. Filter by relevance to the user's question (by paths, tags, title keywords).
3. For the top matches, call `aida_recall` with `action: "get"` to show full detail.
4. Present findings clearly.

## Output Format

If the user asked about a specific area (e.g. "what do we know about auth"):

> ### Decisions for `src/auth/**`
>
> **Use JWT refresh rotation** _(2026-06-14)_
> _Context_: The previous long-lived refresh tokens couldn't be revoked without a DB hit on every request...
> _Decision_: Rotate refresh tokens on every use. Old token invalidated immediately...
> _Consequences_: Race condition on parallel requests mitigated by 5s grace window...

If no relevant decisions:
> No recorded decisions match this area. Consider running `/aida-remember-branch` after your next feature.

## Tips
- Decisions auto-load per file based on `paths` frontmatter — the user may already have relevant ones in context
- `aida_recall list` returns all decisions sorted by date — useful for a quick "what did we decide recently?"
