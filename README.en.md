<div align="center">

# AIDA

### JSON truth-source management for AI tool assets.

AIDA 2.0 keeps only the assets that matter over time:
**rules, skills, memories, and summaries.**

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

[Chinese README](./README.md) · [Command Reference](./COMMANDS.md) · [Docs](./docs/INDEX.md)

</div>

---

## What 2.0 Is

AIDA 2.0 is not an analytics dashboard or a runtime ledger.

It is a clean asset manager for:

- project rules
- project skills
- module memories
- demand summaries

All durable data lives in `.aida/*.json`. Tool directories such as `.cursor`, `.claude`, `.codex`, and `.lingma` are generated projections.

## Truth Sources

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
```

2.0 intentionally drops the old 1.x runtime noise:

- `run.json`
- persistent task ledgers
- timeline / workflow / events
- `.aida/runs/**`
- `.aida/index.json`
- `.aida/tool-configs.json`

## Main Commands

```bash
aida init
aida sync
aida doctor
aida rules
aida skills
aida memory
aida mcp
```

- `init`: initialize 2.0 truth sources
- `sync`: refresh memories, summaries, and generated tool artifacts
- `doctor`: inspect and normalize project state

## Quick Start

Add AIDA to your project MCP config:

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

Then:

```bash
aida init
aida sync
```
