# Current Progress

This file captures the current implementation state of AIDA so work can continue on another machine without relying on local chat history.

Last updated: 2026-04-15

## Current Released Version

- npm: `ai-dev-analytics@1.1.2`
- git commit already pushed before this note: `f3bf5e3`

## What Is Done

### JSON source of truth

These are now the authoritative project assets:

- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/config.json`
- `.aida/tool-configs.json`
- `.aida/memories/index.json`
- `.aida/memories/modules/*.json`
- `.aida/runs/*/context.json`

### Generated views and tool artifacts

`aida build` now generates:

- AI tool rules / skills / MCP config under `.claude`, `.cursor`, `.codex`, `.lingma`, etc.
- `.aida/memories/modules/*.md`
- `.aida/runs/*/context.md`
- `.aida/runs/*/memory.md`

Generated local artifacts are added to `.gitignore`.

### Legacy migration

`aida migrate-legacy` now performs:

1. `.aidevos -> .aida`
2. baseline rules / skills import
3. tool config snapshot import
4. run schema migration
5. legacy memory migration from:
   - `run.json`
   - `requirement.json`
   - `analysis.md`
6. rebuild of generated artifacts

### Memory runtime

Added CLI:

- `aida memory rebuild`
- `aida memory migrate-legacy`
- `aida memory build`
- `aida memory search`
- `aida memory show`
- `aida memory context`
- `aida memory pack`
- `aida memory upsert`
- `aida memory context-update`

Added MCP tools:

- `aida_memory_search`
- `aida_memory_get`
- `aida_memory_upsert`
- `aida_memory_pack`
- `aida_context_get`
- `aida_context_update`
- `aida_context_rebuild`

### Runtime ergonomics already implemented

- branch-level aggregated memory pack exists
- MCP write operations trigger best-effort branch memory refresh
- guide text now instructs AI to search memory before coding
- if context is missing, runtime can rebuild it

## What Is Not Done Yet

These are still open and should be considered phase 2+ work.

### Heavier orchestration / agent runtime

- automatic module inference from user request without explicit search query
- runtime context packing with stronger token budgeting and ranking
- automatic decision of which module memories to include
- automatic post-task memory summarization instead of only refresh / rebuild
- evaluator / reviewer style orchestration on top of MCP runtime

### Better retrieval quality

- stronger semantic retrieval
- optional embeddings / reranking
- better path-aware retrieval when module naming is weak or inconsistent

### Import / migration refinement

- more selective import UX for non-bundled skills and custom MCP configs
- stronger normalization for unusual historical project structures
- explicit migration from old report outputs if a team stored extra derived report docs outside standard branch data

## Recommended Next Steps

If continuing implementation, do work in this order:

1. Add smarter `memory search -> pack` recommendation flow
2. Add task-end memory suggestion / summary generation
3. Improve retrieval quality and ranking
4. Decide whether to evolve into a fuller agent orchestration layer

## Recommended Real Project Test Cases

### Legacy project upgrade

```bash
aida migrate-legacy
aida memory search "模块名"
aida memory pack
aida build
```

Verify:

- old `.aidevos` content becomes `.aida`
- rules / skills / tool configs are preserved
- `context.json` and module memory JSON are created
- generated tool artifacts are rebuilt

### Already migrated project

```bash
aida memory rebuild
aida memory pack
aida build
```

Verify:

- branch context reflects latest `run.json` / `requirement.json` / `analysis.md`
- `memory.md` aggregates relevant modules
- tool artifacts remain in sync

### MCP runtime behavior

Verify during real coding:

- AI calls `aida_memory_search` before coding
- AI prefers `aida_memory_pack` for restoration
- after task / bug / review / rule operations, branch memory refreshes without manual rebuild

## Key Design References

- `docs/PRD-MEMORY-RUNTIME.md`
- `docs/TECH-DESIGN-MEMORY-RUNTIME.md`

## Notes For Next Session

- current architecture is stable enough for real project testing
- this is not the final agent runtime yet
- if continuing from another machine, start by reading:
  1. `docs/CURRENT-PROGRESS.md`
  2. `docs/PRD-MEMORY-RUNTIME.md`
  3. `docs/TECH-DESIGN-MEMORY-RUNTIME.md`
