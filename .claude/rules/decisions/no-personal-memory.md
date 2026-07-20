---
name: no-personal-memory
title: AIDA stores project memory only, not personal/user memory
status: accepted
date: 2026-07-16
tags: [architecture, 3.0, memory, scope]
---

## Context

Early AIDA designs considered a "personal memory" layer — preferences and facts about the developer stored across projects. Claude Code already has a user-level memory system (`~/.claude/` settings, CLAUDE.md). Duplicating this in AIDA would create two competing stores.

## Decision

AIDA memory is strictly project-scoped. Everything written by `aida_remember` goes into the current project's `.claude/rules/decisions/`. There is no cross-project or user-level store in AIDA.

Personal preferences, coding style preferences, and user identity belong in the user's `~/.claude/CLAUDE.md` — outside AIDA's scope.

## Consequences

- Clear boundary: AIDA = project AI assets, not personal AI assistant config.
- No privacy concerns about AIDA writing user data to project repositories.
- Teams can share the `.claude/rules/decisions/` directory via git without personal data leaking.
