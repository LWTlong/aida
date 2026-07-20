---
name: aida-cleanup
description: Use when the user wants to clean up AI assets — remove duplicate rules, archive stale skills, consolidate redundant docs, or fix structural issues in .claude/ or .cursor/ rules. Drives the cleanup via aida_apply_governance.
---

# AIDA Cleanup

## Goal
Reduce noise in AI assets without losing real signal. Target: rules governance first (most common pain point), then skills and docs.

## Steps

### Phase 1 — Survey
1. Call `aida_scan_assets` (or `aida_list_assets` if index is fresh).
2. Check `signals.duplicateContentGroups` — identical content in multiple files.
3. Look at assets with `confidence: "medium"` or `"low"` — these may be misclassified.
4. Count rules per file: files with 200+ rules are likely bloated auto-generated views, not source files.

### Phase 2 — Identify Actions
Produce a cleanup plan. Each operation must use one of the `aida_apply_governance` op types below:

| op | When to use |
|----|-------------|
| `remove-lines` | Delete specific rule lines by 1-based line numbers (provide `lines` array) |
| `modify-file` | Rewrite a file's entire content with a cleaned version |
| `create-file` | Create a new canonical file to replace N messy ones |
| `delete-file` | Delete a generated/temp file that has no unique original content |

Show the plan to the user and **wait for confirmation** before applying.

### Phase 3 — Apply
Call `aida_apply_governance` with `description` (human-readable summary, e.g. "remove 12 duplicate rule lines") and the `operations` array. The tool journals every write so `aida_undo` can reverse the entire batch.

### Phase 4 — Verify
Call `aida_scan_assets` again and confirm asset counts changed as expected.

## Rules
- Never delete a file that is the ONLY copy of unique content — use `modify-file` to clean it instead.
- Auto-generated combined files like `_all.md` are safe to delete.
- Rules with IDs (e.g. `[RULE-001]`) are intentional — only remove with explicit user permission.
- Do not remove rules just because they seem obvious; obvious rules often document past bugs.
- Keep cleanup batches small (≤20 ops) to keep undo manageable.

## Output Format

### Cleanup Plan
**Assets before**: N | **Estimated after**: M | **Ops**: K

| op | Target | Reason |
|-----|--------|--------|
| `remove-lines` | `.claude/rules/aida/general.md` L[45,67] | Exact duplicates of L23,44 |
| `delete-file` | `.claude/rules/aida/_all.md` | Auto-generated combined view |
| ... | ... | ... |

_(After user confirms)_

### Cleanup Result
Applied N ops. **Undoable**: Yes — run `/aida:undo` to reverse the entire batch.
