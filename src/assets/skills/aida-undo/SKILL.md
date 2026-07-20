---
name: aida-undo
description: Use when the user wants to undo the last AIDA write operation (or a specific one). Wraps aida_undo tool.
---

# AIDA Undo

## Goal
Reverse the most recent AIDA write operation, or a specific one by id.

## Steps

1. Call `aida_undo` with `action: "list"` to show recent operations.
2. Confirm which entry to undo with the user (or proceed immediately if they said "undo last").
3. Call `aida_undo` with `action: "undo"` and optional `id`.
4. Report what was reversed.

## Rules
- Only AIDA-instrumented operations are undoable (aida_memory, aida_write_analysis, aida_apply_governance).
- Undo is permanent — after it runs, the entry is removed from the journal.
- If the user wants to undo multiple steps, run undo once per step (each call reverses one entry).

## Output

> Undone: **`<description>`** (was applied at `<time>`)
> Files restored: N
