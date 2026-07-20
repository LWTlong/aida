---
name: drop-canonical-store
title: Drop the canonical JSON store — .claude/ is source of truth
status: accepted
date: 2026-07-16
tags: [architecture, 3.0, rules]
---

## Context

AIDA 2.x maintained a canonical JSON store (`.aida/rules.json`, `.aida/skills.json`) that was synced out to `.claude/`, `.cursor/`, etc. This meant every change had to go through `aida sync`, and the projection files were not authoritative.

In practice, developers edited `.claude/rules/` directly and the JSON store drifted. The `aida sync` command became a source of confusion: "sync which direction?"

## Decision

Drop the canonical store. `.claude/rules/` (and equivalent tool directories) are the source of truth. AIDA 3.0 reads from these directories directly via the scanner. There is no sync step.

## Consequences

- Simpler mental model: edit files, AIDA reads them.
- `aida sync` command removed.
- Scanner must cover `.claude/`, `.cursor/`, `.aida/` and similar directories.
- Existing 2.x `.aida/rules.json` files are ignored by the scanner (not deleted — user may clean up manually).
