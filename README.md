<div align="center">

# AIDA

### AI Development Observability Platform

**Vibe coding with receipts.**

AI writes more and more of your code — but what did it actually do?<br>
How many tasks did it complete? How many bugs did it introduce? How often did it deviate from your architecture?

AIDA gives you the answers.

[![npm version](https://img.shields.io/npm/v/ai-dev-analytics?color=%230066ff&label=npm)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-os?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-82%20passed-brightgreen)](#testing)

[Quick Start](#quick-start) · [MCP Server](#mcp-server) · [How It Works](#how-it-works) · [Dashboard](#dashboard) · [Skills](#skills) · [CLI Reference](#cli-reference)

</div>

---

## The Problem

You're using Claude Code or Cursor to build features. The AI generates hundreds of lines of code. But at the end of the day:

- **You can't tell** how many of those lines were right the first time
- **You can't track** which architectural rules the AI keeps violating
- **You can't measure** whether the AI is actually saving you time
- **You can't prove** your AI-assisted productivity in reviews or reports
- **You can't compare** how different models perform on your codebase

All that development process data? **Gone.** Every single session.

## The Solution

AIDA works in **two modes** — pick the one that fits your workflow:

| Mode | What you get | Setup effort |
|------|-------------|--------------|
| **Data Collection Only** (via MCP) | Full observability with zero workflow changes | Add one JSON config block |
| **Full Workflow** (MCP + Skills + Commands) | Observability + structured AI SOPs + self-improving rules | `npm install` + `aida init` |

**Most teams start with data collection.** Your AI tool calls MCP tools automatically as it works — you change nothing about how you code. When you're ready for structured workflows, upgrade to full mode.

## Quick Start

### Path A: Data Collection Only (Recommended)

Add the MCP server config to your AI tool and start working. That's it.

**Claude Code** — add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "aida": {
      "command": "npx",
      "args": ["-y", "ai-dev-analytics", "mcp"]
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aida": {
      "command": "npx",
      "args": ["-y", "ai-dev-analytics", "mcp"]
    }
  }
}
```

**VS Code Copilot** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "aida": {
      "command": "npx",
      "args": ["-y", "ai-dev-analytics", "mcp"]
    }
  }
}
```

**Windsurf** — add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "aida": {
      "command": "npx",
      "args": ["-y", "ai-dev-analytics", "mcp"]
    }
  }
}
```

No `aida init` or `aida start` needed. The MCP server uses **lazy init** — it auto-creates `.aidevos/` and `run.json` on the first tool call.

Then view your data:

```bash
npx ai-dev-analytics dashboard
```

Open `http://localhost:2375` — real-time dashboard with live updates.

### Path B: Full Workflow

```bash
# Install globally
npm install -g ai-dev-analytics

# Initialize in your project (interactive setup)
cd your-project
aida init
```

`aida init` now offers **mode selection**:

1. **Data collection only** — sets up MCP config for your chosen AI tool(s)
2. **Full workflow** — MCP config + 14 AI Skills + slash commands + project rules

Multi-tool support: select one or more AI tools (Claude Code, Cursor, VS Code Copilot, Windsurf) and AIDA writes the correct MCP config for each.

Then start building:

```bash
# Create a new development run
aida start

# Place your PRD, then let AI take over
/workflow
```

The AI will execute: **Requirement Analysis** -> *User Confirmation* -> **Task Decomposition** -> **Code Generation** -> **Self-Review** -> loop until done.

## MCP Server

The MCP server is the primary data collection mechanism. Your AI tool calls these tools automatically as part of its normal workflow — no extra prompts or commands required.

### 9 MCP Tools

| Tool | Description |
|------|-------------|
| `aidevos_task_start` | Mark a task as in-progress |
| `aidevos_task_done` | Mark a task as completed |
| `aidevos_log_bug` | Record a bug found during development |
| `aidevos_bug_fix` | Record a bug fix |
| `aidevos_log_review` | Log a self-review result (pass/fail) |
| `aidevos_log_deviation` | Record when AI output deviates from expectations |
| `aidevos_log_files` | Track file changes (added, modified, deleted) |
| `aidevos_highlight` | Capture notable achievements or milestones |
| `aidevos_status` | Return current run status as structured data |

### MCP Prompts

The server exposes an `aidevos-guide` prompt that teaches your AI tool when and how to call each tool. AI tools that support MCP prompts will automatically understand the observability protocol.

### Lazy Init

No manual setup required for data collection. On the first MCP tool call, the server will:

1. Create `.aidevos/` if it doesn't exist
2. Create `run.json` for the current branch and developer
3. Start recording immediately

### Token Auto-Collection

For **Claude Code** users, AIDA automatically reads Claude session files to collect token usage data:

- Token usage per task and per bug fix
- Breakdown: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
- Aggregated totals at the run level

This enables accurate **ROI calculation** — you can see exactly how many tokens each task or bug fix consumed and correlate cost with output.

## How It Works

AIDA is **not** an AI coding agent. It's an **observability layer** that standardizes how your existing AI tools work.

```
┌──────────────────────────────────────────────────────┐
│  Your IDE (Claude Code / Cursor / VS Code / Windsurf)│
│                                                      │
│  ┌──────────┐  MCP calls  ┌────────────────────┐    │
│  │ AI Agent ├────────────→│ AIDA MCP Server │    │
│  │          │             │ (9 tools)          │    │
│  │          │  reads      ┌──────────────────┐  │    │
│  │          ├────────────→│ .aidevos/skills/ │  │    │
│  │          │             │ (14 SOPs)        │  │    │
│  └──────────┘             └───────┬──────────┘  │    │
└───────────────────────────┬───────┘──────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  run.json   │ <- Single source of truth
                     └──────┬──────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
          ┌──────────┐ ┌────────┐ ┌─────────┐
          │Dashboard │ │Reports │ │Analysis │
          │ (React)  │ │ (.md)  │ │ (JSON)  │
          └──────────┘ └────────┘ └─────────┘
```

The **MCP path** (top arrow) is the primary data collection mechanism. Skills are optional and used only in full workflow mode.

### Three-Layer Data Model

| Layer | File | Scope | Purpose |
|-------|------|-------|---------|
| **L0** | `run.json` | Per developer | Every task, bug, deviation, review, rule |
| **L1** | `requirement.json` | Per branch | Aggregated developer stats, module assignments |
| **L2** | `index.json` | Per project | Cross-branch overview for team leads |

### The Self-Improving Loop

This is what makes AIDA different. It's not just tracking — it's **learning**.

```
   AI generates code
         │
         ▼
   Self-review catches issues
         │
         ├── Pass -> next task
         │
         └── Fail -> fix -> record deviation
                              │
                              ▼
                    Is it a missing rule?
                              │
                     Yes ─────┤
                              ▼
                    Sediment as project rule
                              │
                              ▼
                    AI reads rules next time
                              │
                              ▼
                    Same mistake never happens again
```

Over time, your `.aidevos/rules/` grows into a **project-specific AI knowledge base** that makes every subsequent development run more accurate.

## Dashboard

Real-time visualization powered by React + ECharts with dark theme.

**Branch Detail View** — deep dive into a single development run:

- KPI cards: task completion, deviation rate, bug count, review pass rate, token consumption, ROI
- Token consumption with detail breakdown (input/output/cache tokens)
- Node time distribution with token overlay
- Per-stage task completion with duration and token stats
- Task time ranking TOP 10
- Bug severity distribution
- Review issue categories and first-pass rate trend
- File change heatmap
- Deviation root cause analysis and category distribution

**Project Overview** — team lead perspective across all branches:

- Requirement status ring chart
- Developer efficiency comparison
- Cross-branch totals and highlights

```bash
aida dashboard              # Default port 2375
aida dashboard --port 3000  # Custom port
```

Dashboard updates in real-time via SSE — no refresh needed.

## Skills

AIDA ships with **14 AI Skills** — structured SOPs that tell your AI tool exactly what to do and how to record it. Skills are used in **full workflow mode** and are optional for data-collection-only setups.

### Workflow Skills (auto-orchestrated)

| Skill | Role | What it does |
|-------|------|-------------|
| `workflow-orchestrator` | Project Manager | Orchestrates the full loop, handles interruption recovery |
| `requirement-analyzer` | Architect | Analyzes PRD, generates `analysis.md`, waits for user confirmation |
| `task-splitter` | Tech Lead | Decomposes analysis into atomic, testable tasks |
| `code-generator` | Senior Engineer | Writes code strictly following tasks and project rules |
| `self-reviewer` | QA Lead | Reviews code against all project rules, pass or fail |
| `bug-fixer` | Debug Expert | Fixes bugs found during self-review |

### Manual Skills (user-triggered)

| Skill | Command | When to use |
|-------|---------|-------------|
| `audit` | `/audit` | Scan your codebase to auto-generate project rules |
| `deviation-recorder` | `/deviation` | Record when AI output doesn't match expectations |
| `rules-evolver` | `/rules-evolver` | Evolve and maintain project rules from PR feedback |

### Utility Skills

| Skill | Purpose |
|-------|---------|
| `dashboard-generator` | Generate dashboard configuration |
| `commit-code` | Git commit assistant |
| `docx-to-markdown` | Convert DOCX PRD files to Markdown |
| `mcp-reviewer` | External MCP-based code review |
| `dev-flower` | Development flow visualization |

## Rules System

AIDA uses a **Registry + Generated Views** pattern for project rules:

```
.aidevos/rules.json     <- Source of truth (committed to git)
.aidevos/rules/*.md     <- Auto-generated views (gitignored)
```

- **Fingerprint dedup**: SHA256 hash prevents duplicate rules across parallel branches
- **Auto-merge**: `aida rules merge` resolves git conflicts by taking the union
- **Similarity detection**: `aida rules dedupe` finds near-duplicate rules via Jaccard similarity
- **Category system**: `component`, `api`, `style`, `i18n`, `architecture`, `state-management`, `routing`, `testing`, `process`, `general`

Rules are automatically rebuilt on every `aida start` and every rule sedimentation.

## CLI Reference

| Command | Description |
|---------|-------------|
| `aida init` | Interactive project setup: mode selection (data collection / full workflow), multi-tool support |
| `aida start` | Create a new development run for current branch |
| `aida status` | Show current run status in terminal |
| `aida log <sub>` | Write structured data to run.json (12 subcommands) |
| `aida dashboard` | Launch real-time visualization dashboard |
| `aida mcp` | Start the MCP server (used in MCP config, not called directly) |
| `aida rules <sub>` | Manage rules registry (`build`, `dedupe`, `merge`, `list`) |
| `aida reindex` | Rebuild project-level index from all runs |
| `aida report` | Generate markdown performance report (`--scope me/team`) |
| `aida update` | Update all skills to latest version |
| `aida migrate` | Migrate old run.json format to current schema |

### `aida log` Subcommands

```bash
aida log task --title "Create API layer" --stage "Infrastructure" --prd-phase "PRD1"
aida log task-start --id TASK-01
aida log task-done --id TASK-01
aida log bug --title "Type mismatch" --severity high --source self-review
aida log bug-fix --id BUG-01 --fix "Fixed response type"
aida log deviation --title "Wrong component" --root-cause rule-missing --category component-usage
aida log review --task-id TASK-01 --result pass --scope "src/api/"
aida log rule --content "Use Drawer for detail views" --category component
aida log file --path "src/api/user.ts" --change-type modified --lines-added 50
aida log cost --tokens 125000 --stage "requirement-analysis"
aida log highlight --content "FCP reduced from 3.2s to 0.8s"
```

All writes are validated against the schema. Invalid enum values or missing required fields are rejected with clear error messages.

### Data Migration

Upgrading from an older version? `aida migrate` handles schema evolution automatically:

```bash
cd your-project
aida migrate
```

- Detects old `run.json` files and migrates to schema 2.0
- Remaps renamed fields, normalizes enum values
- Auto-generates timeline from task/bug/deviation timestamps
- Recalculates all metrics
- Backs up originals as `*.backup.json`

## Project Structure

```
your-project/
├── .mcp.json                       # MCP server config (Claude Code)
├── .cursor/mcp.json                # MCP server config (Cursor)
├── .vscode/mcp.json                # MCP server config (VS Code Copilot)
├── .aidevos/
│   ├── config.json              # Project configuration
│   ├── rules.json               # Rules registry (source of truth)
│   ├── rules/                   # Auto-generated rule views (gitignored)
│   ├── index.json               # Project-level aggregation
│   ├── skills/                  # 14 AI Skill SOPs
│   └── runs/
│       └── [branch]/
│           ├── prd.md               # PRD document (shared)
│           ├── analysis.md          # Requirement analysis (shared)
│           ├── requirement.json     # Branch-level aggregation (shared)
│           └── [developer]/
│               └── run.json         # All structured dev data (personal)
├── .claude/commands/            # Slash commands (Claude Code)
└── CLAUDE.md                    # Project rules + iron laws
```

## Testing

```bash
npm test
```

82 tests across 5 test suites:

- **`mcp-server.test`** — MCP protocol, all 9 tools, prompts, lazy init, end-to-end data verification
- **`rules.test`** — Fingerprint dedup, registry CRUD, view generation, merge, similarity detection
- **`cli-log.test`** — All 12 log subcommands, enum validation, metrics calculation, requirement.json sync
- **`cli-start.test`** — run.json structure integrity, schema alignment, gitignore management
- **`reindex.test`** — Index aggregation, status inference, edge cases

## Tech Stack

- **CLI**: Node.js + TypeScript (zero runtime dependencies)
- **MCP Server**: Model Context Protocol over stdio
- **Dashboard**: React 19 + ECharts + Tailwind CSS 4
- **Data**: JSON files (no database required)
- **Real-time**: Server-Sent Events (SSE)
- **Tests**: Node.js built-in test runner

## Philosophy

> The performance of a system is not determined by its strongest component, but by the synergy between all parts.

AIDA is built on three iron laws:

1. **No hallucination** — When uncertain, ask. Never guess.
2. **No unauthorized docs** — Don't generate documents without explicit permission.
3. **Clean workspace** — Test scripts must be deleted after passing. Keep the project lean.

These laws are enforced in every AI Skill and injected into your project's global rules.

## Contributing

Issues and PRs welcome.

## License

[MIT](./LICENSE)
