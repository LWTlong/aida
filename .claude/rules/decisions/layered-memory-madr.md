---
name: layered-memory-madr
title: Use MADR format in .claude/rules/decisions/ for layered project memory
status: accepted
date: 2026-07-16
tags: [architecture, 3.0, memory]
---

## Context

AIDA 2.x stored module memories as JSON in `.aida/memories/modules/`. These were opaque to Claude Code — the model had no automatic mechanism to load them at the right time.

Claude Code has a `paths` frontmatter field on rules files: if a file lists `paths`, it is only injected into the context when one of those file globs matches the current open file. This is the right mechanism for scoped background knowledge.

## Decision

Decision records are stored as MADR-format Markdown at `.claude/rules/decisions/<slug>.md`. Each file has a `paths` frontmatter field listing the file patterns where the decision is relevant. Claude Code auto-loads these files when matched.

The format is minimal: `context`, `decision`, `consequences` sections. No heavyweight ADR tooling required.

## Consequences

- Decisions are plain Markdown, diff-friendly, reviewable in PRs.
- Claude Code loads them automatically — no `aida_recall` call needed at session start for scoped decisions.
- `/aida:remember` and `/aida:remember-branch` skills write to this directory via `aida_remember` MCP tool.
- Old `.aida/memories/modules/` JSON files are still scanned but not the primary store.
