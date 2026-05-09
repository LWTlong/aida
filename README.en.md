<div align="center">

# AIDA

### Make project rules, skills, and module memory the real source of truth.

AIDA 2.0 is no longer centered on task ledgers or run timelines. It keeps the assets that actually matter over time:
**rules, skills, module memory, and branch-level demand summaries.**

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

[![npm version](https://img.shields.io/badge/npm-v2.0.0-0066ff)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-analytics?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](#testing)

[Chinese README](./README.md) · [Command Reference](./COMMANDS.md) · [Docs](./docs/INDEX.md)

</div>

---

## What AIDA 2.0 Keeps

The durable truth sources are:

```text
.aida/
  config.json
  rules.json
  skills.json
  summary.json
  aida-guide.md
  memories/
    index.json
    modules/*.json
  rules/*.md
```

- `rules.json`: project-level technical rules
- `skills.json`: project-level skills registry
- `memories/index.json`: low-cost memory lookup index
- `memories/modules/*.json`: module-level business memory
- `summary.json`: branch / demand summaries

## What AIDA 2.0 Discards

2.0 intentionally removes the heavy 1.x runtime ledger model:

- `run.json`
- persistent task ledgers
- timeline / events / workflow history
- `.aida/runs/**`
- `.aida/index.json`
- `.aida/tool-configs.json`

Migration is a cleaning rebuild, not a full carry-over.

## Command Model

The main 2.0 commands are:

```bash
aida init
aida sync
aida build
aida doctor
aida migrate-legacy
```

- `init`: create the 2.0 truth-source layout
- `sync`: refresh memories, summaries, and generated tool artifacts
- `build`: rebuild generated artifacts from JSON truth sources
- `doctor`: inspect and normalize project state
- `migrate-legacy`: migrate 1.x / legacy projects into the 2.0 structure

## Context Recovery

Memory recovery is intentionally layered:

1. read `memories/index.json`
2. read `summary.json`
3. only read matched `memories/modules/*.json`

This keeps token usage low and prevents loading the full memory corpus every time.

## Notes

- MCP is an optional structured execution channel, not the system foundation.
- CLI and MCP should operate on the same JSON truth sources.
- Built-in bundled workflow skills are no longer seeded by default in 2.0.

For full product explanation, migration behavior, and Chinese examples, use:

- [README.md](./README.md)
- [COMMANDS.md](./COMMANDS.md)
- [docs/AIDA-2.0-DESIGN.md](./docs/AIDA-2.0-DESIGN.md)
