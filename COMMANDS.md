# AIDA Commands

## Overview

AIDA has two layers of capability:

1. Development observability
- collect task / bug / deviation / review / file / token data through MCP
- aggregate project progress into dashboard and reports

2. AI asset management
- manage project rules, skills, and AI tool config from one source
- build those assets into Claude / Cursor / Codex and other tool-specific local files

Source of truth:

- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/config.json`

Generated artifacts:

- `.aida/rules/*.md`
- `.aida/skills/*/SKILL.md`
- `.aida/tool-configs.json`
- `.mcp.json`
- `.cursor/**`
- `.claude/commands/*.md`
- `.aida/codex/config.toml`
- `~/.codex/config.toml` when building `codex`

## Main Workflow

### New project

```bash
aida init
```

### Legacy project

```bash
aida migrate-legacy
```

Or step by step when you want to choose the baseline tool explicitly:

```bash
aida migrate-dir
aida import cursor
aida migrate
```

### Team collaboration

```bash
git pull
aida merge
aida build
```

## Top-Level Commands

### `aida init`

Initialize AIDA in the current project.

Behavior:
- creates `.aida`
- writes config, rules, skills sources
- injects AIDA guide references into supported AI tools
- if an existing tool already has local rules / skills / config, lets user choose one baseline tool and import it into AIDA JSON

### `aida import`

Reverse-read existing project assets into AIDA JSON, then rebuild.

Imports:
- existing `.aida/rules/*.md` or `.aida/rules/_all.md`
- existing `.aida/skills/*/SKILL.md`
- tool-specific config snapshots

Examples:

```bash
aida import
aida import cursor
```

Behavior:
- no arg: import existing AIDA sources and discovered tool config snapshots
- with baseline tool arg: import that tool's rules / skills first, then fold everything into `.aida/*.json`
- rebuilds tool artifacts after import

### `aida build`

Build rules, skills, MCP config, and tool-specific local artifacts from `.aida` sources.

Examples:

```bash
aida build
aida build all
aida build claude-code
aida build cursor codex
```

Behavior:
- no args: interactive multi-select target selection
- with args: build selected targets only
- updates `.gitignore`
- `codex` build also syncs `~/.codex/config.toml`
- non-TTY environments fall back to comma-separated number input

### `aida merge`

Resolve merge conflicts in both:
- `.aida/rules.json`
- `.aida/skills.json`

Equivalent high-level command for:

```bash
aida rules merge
aida skills merge
```

### `aida migrate`

Migrate old `run.json` schema data to the current schema.

### `aida migrate-dir`

Rename legacy `.aidevos` project directories to `.aida` and rewrite common path references.

Examples:

```bash
aida migrate-dir
```

Behavior:
- renames `.aidevos` to `.aida`
- rewrites common path references in `.aida`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`
- no-op if project already uses `.aida`
- aborts if both `.aidevos` and `.aida` exist

### `aida migrate-legacy`

One-shot migration for legacy `.aidevos` projects.

Examples:

```bash
aida migrate-legacy
aida migrate-legacy cursor
```

Behavior:
- renames `.aidevos` to `.aida`
- rewrites old path references, including guide paths
- imports one baseline tool's local rules / skills into `.aida/*.json`
- snapshots all discovered tool configs
- rebuilds generated AIDA artifacts and updates `.gitignore`
- runs `aida migrate` to upgrade historical run data schema
- if multiple baseline tools are detectable, prompts with interactive single-select

### `aida start`

Create a new development run.

### `aida status`

Show current run status.

### `aida dashboard`

Start the local dashboard server.

### `aida report`

Generate report data from recorded runs.

### `aida reindex`

Rebuild the project-level index from all runs.

### `aida mcp`

Start the MCP server over stdio.

## Rules Commands

### `aida rules add`

Add one rule into `.aida/rules.json`.

Examples:

```bash
aida rules add "禁止直接修改生成产物文件"
aida rules add "API 请求必须走统一封装" --category api
```

Behavior:
- auto-generates rule ID
- default category is `general`
- rebuilds rule views after add

### `aida rules list`

List rules.

Examples:

```bash
aida rules list
aida rules list --json
```

### `aida rules delete`

Deprecate one rule by ID.

Example:

```bash
aida rules delete RULE-001
```

Behavior:
- does not hard delete
- marks the rule `deprecated`
- rebuilds rule views

### `aida rules build`

Rebuild `.aida/rules/*.md` from `.aida/rules.json`.

### `aida rules merge`

Resolve git conflict content in `.aida/rules.json` only.

### `aida rules dedupe`

Find similar or potentially duplicate rules.

## Skills Commands

### `aida skills list`

List skills.

Examples:

```bash
aida skills list
aida skills list --json
```

### `aida skills edit`

Edit one skill and save it back into `.aida/skills.json`.

Examples:

```bash
aida skills edit workflow-orchestrator
aida skills edit workflow-orchestrator --apply
aida skills edit workflow-orchestrator --from-file ./workflow.md
```

Behavior:
- uses whole-document editing
- if `EDITOR` exists, opens an edit buffer
- otherwise user edits buffer manually and runs `--apply`
- after save, auto-builds project artifacts

### `aida skills build`

Rebuild `.aida/skills/*/SKILL.md` from `.aida/skills.json`.

### `aida skills merge`

Resolve git conflict content in `.aida/skills.json` only.

Conflict handling:
- parses both sides into skill arrays
- merges by fingerprint
- reassigns IDs for new merged entries
- handles edge cases like `{} vs array`, empty content, single object, array fragments

## Supported AI Tools

- `claude-code`
- `cursor`
- `vscode-copilot`
- `lingma`
- `codex`
- `windsurf`

## Tool Build / Import Coverage

### Claude Code

Build:
- `.mcp.json`
- `.claude/commands/*.md`
- guide reference injection

Import baseline:
- `CLAUDE.md`
- `.claude/commands/*.md`
- `.mcp.json`

### Cursor

Build:
- `.cursor/mcp.json`
- `.cursor/skills/*/SKILL.md`
- generated rule references under `.cursor/rules/`

Import baseline:
- `.cursor/rules/**/*.md`
- `.cursor/skills/*/SKILL.md`
- `.cursor/mcp.json`

### Codex

Build:
- `.aida/codex/config.toml`
- sync `~/.codex/config.toml`
- `AGENTS.md` AIDA guide reference

Import baseline:
- `AGENTS.md`
- codex config snapshot

### Lingma / VS Code Copilot

Build:
- tool MCP config
- guide/rule references where supported

Import:
- config snapshot
- Lingma rule import partially supported

## Rule Sedimentation

When the model detects a project-level technical convention that should become a rule, or the user directly states a long-term technical rule:

- do not only edit local tool rule files
- use AIDA MCP `aida_log_rule`
- persist the rule into `.aida/rules.json`
- then rebuild generated views and tool artifacts

This behavior is instructed through AIDA guide injection for supported AI tools, but final execution still depends on the model following those instructions.

## Current Boundaries

- `rules edit` is not implemented yet
- `skills` editing is whole-document, not line-level structured editing
- there is no local web editor yet
- some tool imports are still config-first rather than full semantic import
