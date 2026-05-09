# Current Progress

This file captures the current implementation state of AIDA 2.0 so work can continue on another machine without relying on local chat history.

Last updated: 2026-05-09

## Current Release Target

- package version in this branch: `2.0.0`
- branch: `design-aida-2.0`
- status: release preparation

## 2.0 Core Truth Sources

These are the only long-lived project truth sources in AIDA 2.0:

- `.aida/config.json`
- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/summary.json`
- `.aida/memories/index.json`
- `.aida/memories/modules/*.json`

2.0 explicitly discards the 1.x runtime ledger model:

- `.aida/runs/**`
- `.aida/index.json`
- `.aida/tool-configs.json`
- `run.json`
- task persistence
- timeline / events / workflow history

## Generated Artifacts

`aida build` and `aida sync` generate or refresh:

- AI tool rule bundles under `.claude`, `.cursor`, `.codex`, `.lingma`, etc.
- AI tool skill bundles from `.aida/skills.json`
- MCP config files for enabled tools
- `.aida/rules/*.md`
- `.aida/memories/modules/*.md`
- root instruction files such as `CLAUDE.md` or `AGENTS.md` for enabled tools only

Generated artifacts are projections. They are not the source of truth.

## What 2.0 Migration Does

`aida migrate-legacy` is now a cleaning migration, not a structural carry-over.

It performs:

1. legacy `.aidevos -> .aida` normalization
2. legacy rules / skills import into 2.0 registries
3. module memory extraction and cleanup
4. requirement / branch summary extraction into `.aida/summary.json`
5. removal of 1.x runtime noise and obsolete directories
6. rebuild of 2.0 generated artifacts

The migration keeps only data that still matters in 2.0:

- rules
- project skills
- module business memory
- demand / branch summaries

It discards:

- task ledgers
- workflow stage history
- event / timeline noise
- old runtime-derived indexes

## Runtime and Retrieval Model

The runtime contract in 2.0 is:

1. read rules
2. search module memory index
3. read `summary.json`
4. only read matched `memories/modules/*.json`
5. implement
6. write back only final useful memory / summary / rule changes

This keeps token usage low and avoids replaying noisy process history.

## Commands That Matter in 2.0

Primary commands:

- `aida init`
- `aida sync`
- `aida build`
- `aida doctor`
- `aida migrate-legacy`

Legacy commands may still exist for compatibility, but they are not the main product path.

## Validation Status

Validated in this branch:

- full test suite passing
- 2.0 guide generation passing
- 2.0 merge / doctor / sync flow passing
- real migrated project verification completed on:
  - `/Users/longwentao/project/frontend-msg-admin`

The verified real-project expectations were:

- 1.x runtime directories removed after cleanup
- 2.0 truth sources preserved
- guide text switched to 2.0 semantics
- no default bundled workflow skills

## Phase 2 Candidates

These are intentionally out of the 2.0.0 release scope:

- reverse sync from hand-edited tool markdown back into JSON
- richer dashboard refresh based on 2.0 summary-only model
- stronger semantic retrieval / embeddings
- automatic detection of external tool-side skill changes

## Recommended Starting Point For The Next Session

If continuing work from another machine, start with:

1. `README.md`
2. `COMMANDS.md`
3. `docs/AIDA-2.0-DESIGN.md`
4. `docs/CURRENT-PROGRESS.md`

Treat the older run/workflow documents in `docs/` as historical reference only.
