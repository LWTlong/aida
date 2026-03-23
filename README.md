<div align="center">

# AIDA

### AI Development Analytics

**The black box recorder for AI-assisted development.**

Your AI writes code every day — but you have no idea what actually happened.<br>
AIDA records everything, shows you the data, and makes your AI get better over time.

[![npm version](https://img.shields.io/npm/v/ai-dev-analytics?color=%230066ff&label=npm)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-analytics?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-82%20passed-brightgreen)](#testing)

[Quick Start](#quick-start) · [Dashboard](#dashboard) · [How It Works](#how-it-works) · [Full Workflow](#full-workflow-mode) · [CLI Reference](#cli-reference) · [中文文档](./README.zh-CN.md)

</div>

---

## Why AIDA?

You use Claude Code, Cursor, or Copilot to build features. The AI generates hundreds of lines of code. Then:

- How many tasks did it complete? **No idea.**
- How many bugs did it introduce? **No record.**
- Which architectural rules did it violate? **Lost forever.**
- Is the AI actually saving you time? **Can't prove it.**

Every AI development session is a **black box**. The process data disappears the moment you close your IDE.

**AIDA is the flight recorder.** It silently captures what your AI does — tasks, bugs, deviations, reviews, file changes, token consumption — and turns it into structured data you can analyze, visualize, and act on.

## Two Modes

| Mode | What it does | Setup |
|------|-------------|-------|
| **Data Collection** | Silent recording, zero workflow changes — your AI development black box | One JSON config |
| **Full Workflow** | Data collection + structured AI SOPs + self-improving rules | `aida init` |

**Start with data collection.** It's non-invasive — your AI tool calls MCP tools automatically as it works, you change nothing about how you code. When you see the value in the data, upgrade to full workflow to close the loop.

## Quick Start

Add the MCP config to your AI tool. Done — AIDA starts recording automatically.

**Claude Code** `.mcp.json`:
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

<details>
<summary>Cursor / VS Code Copilot / Windsurf</summary>

**Cursor** `.cursor/mcp.json`:
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

**VS Code Copilot** `.vscode/mcp.json`:
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

**Windsurf** `~/.codeium/windsurf/mcp_config.json`:
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
</details>

No initialization needed. The MCP server uses **lazy init** — it auto-creates data directories and starts recording on the first tool call.

View your data anytime:

```bash
npx ai-dev-analytics dashboard
```

Open `http://localhost:2375` — real-time dashboard with live updates via SSE.

## Dashboard

Real-time visualization powered by React + ECharts.

**What you see per branch:**

- KPI overview: tasks completed, deviation rate, bug count, review pass rate, token consumption, ROI
- Token breakdown: input / output / cache tokens per task
- Node time distribution with token overlay
- Per-stage task completion with duration and token stats
- Task time ranking TOP 10
- Bug severity distribution
- Review issue categories and first-pass rate trend
- File change heatmap
- Deviation root cause analysis

**Project overview for team leads:**

- Requirement status across all branches
- Developer efficiency comparison
- Cross-branch totals and highlights

```bash
aida dashboard              # Default port 2375
aida dashboard --port 3000  # Custom port
```

## How It Works

AIDA is **not** an AI coding agent. It's an **observability layer** for your existing AI tools.

```
Your IDE (Claude Code / Cursor / VS Code / Windsurf)
    │
    │  AI works normally
    │
    ├──→ MCP Server (9 tools)  ──→  run.json  ──→  Dashboard
    │    silent data collection      structured     real-time
    │                                data           visualization
    │
    └──→ Skills (14 SOPs)      ──→  run.json  ──→  Rules
         workflow orchestration      same data      self-improving
         (optional)                  source         AI knowledge base
```

### Data Collection (MCP) — The Black Box

9 MCP tools that your AI calls automatically:

| Tool | What it records |
|------|----------------|
| `aida_task_start` / `aida_task_done` | Task lifecycle and duration |
| `aida_log_bug` / `aida_bug_fix` | Bugs found and fixed |
| `aida_log_review` | Code review results (pass/fail) |
| `aida_log_deviation` | AI output vs. your expectations |
| `aida_log_files` | File changes (auto-scans git diff) |
| `aida_highlight` | Notable achievements |
| `aida_status` | Current run status |

For **Claude Code** users, AIDA also auto-collects token usage from session files — input, output, cache tokens per task.

**This alone gives you a complete development flight record.** No workflow changes, no extra commands, no friction.

### Three-Layer Data Model

| Layer | File | Scope |
|-------|------|-------|
| **L0** | `run.json` | Per developer — every task, bug, deviation, review |
| **L1** | `requirement.json` | Per branch — aggregated stats, module assignments |
| **L2** | `index.json` | Per project — cross-branch overview |

## Full Workflow Mode

When data collection alone isn't enough and you want **AI that gets better with every run**, enable full workflow mode.

```bash
npm install -g ai-dev-analytics
cd your-project
aida init    # Select "Full workflow"
aida start   # Create a development run
/workflow    # Let AI take over
```

### The Development Loop

```
PRD Document
    │
    ▼
Requirement Analysis ──→ User confirms understanding
    │
    ▼
Task Decomposition ──→ Atomic, testable tasks
    │
    ▼
┌─→ Code Generation ──→ Self-Review
│       │                    │
│       │              Pass ─┤── Fail
│       │                    │
│       │              Next  └─→ Bug Fix ─→ Re-review
│       │              task
└───────┘
    │
    ▼
All tasks done → Workflow complete
```

Each step records structured data to `run.json`. If interrupted, the workflow resumes exactly where it left off.

### The Self-Improving Loop — Why This Matters

This is what makes full workflow mode fundamentally different from just using an AI tool:

```
AI generates code
       ↓
Self-review catches issues
       ↓
Record as deviation ← "AI used wrong component"
       ↓
Is it a pattern? → Sediment as project rule
       ↓
AI reads rules next time
       ↓
Same mistake never happens again
```

Your `.aidevos/rules/` directory grows into a **project-specific AI knowledge base**. Every deviation, every bug, every review failure is a data point. Over time, the rules evolve, and your AI's output quality improves measurably.

**Data collection is the black box. Full workflow closes the loop.**

### 14 AI Skills

| Category | Skills |
|----------|--------|
| **Workflow** | `workflow-orchestrator`, `requirement-analyzer`, `task-splitter`, `code-generator`, `self-reviewer`, `bug-fixer` |
| **Manual** | `/audit` (generate project rules), `/deviation` (record AI deviations), `/rules-evolver` (evolve rules from PR feedback) |
| **Utility** | `dashboard-generator`, `commit-code`, `docx-to-markdown`, `mcp-reviewer`, `dev-flower` |

### Rules System

```
.aidevos/rules.json     ← Source of truth (committed to git)
.aidevos/rules/*.md     ← Auto-generated views (gitignored)
```

- **Fingerprint dedup**: SHA256 prevents duplicate rules across parallel branches
- **Auto-merge**: `aida rules merge` resolves git conflicts by union
- **Similarity detection**: `aida rules dedupe` finds near-duplicates via Jaccard similarity

## CLI Reference

| Command | Description |
|---------|-------------|
| `aida init` | Interactive setup (mode + AI tool selection) |
| `aida start` | Create a new development run |
| `aida status` | Show current run status |
| `aida log <sub>` | Write structured data (12 subcommands) |
| `aida dashboard` | Launch visualization dashboard |
| `aida mcp` | Start MCP server (for AI tool config) |
| `aida rules <sub>` | Manage rules (`build`, `dedupe`, `merge`, `list`) |
| `aida reindex` | Rebuild project-level index |
| `aida report` | Generate performance report |
| `aida update` | Update skills to latest version |
| `aida migrate` | Migrate old data to current schema |

## Testing

```bash
npm test    # 82 tests across 5 suites
```

## Tech Stack

- **Zero runtime dependencies** — Node.js + TypeScript
- **MCP Server** — Model Context Protocol over stdio
- **Dashboard** — React 19 + ECharts + Tailwind CSS 4
- **Data** — JSON files, no database required
- **Real-time** — Server-Sent Events (SSE)

## Contributing

Issues and PRs welcome at [github.com/LWTlong/ai-dev-analytics](https://github.com/LWTlong/ai-dev-analytics).

## License

[MIT](./LICENSE)
