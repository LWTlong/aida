<div align="center">

# AIDevOS

### AI Development Observability Platform

**Vibe coding with receipts.**

AI writes more and more of your code — but what did it actually do?<br>
How many tasks did it complete? How many bugs did it introduce? How often did it deviate from your architecture?

AIDevOS gives you the answers.

[![npm version](https://img.shields.io/npm/v/aidevos?color=%230066ff&label=npm)](https://www.npmjs.com/package/aidevos)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-os?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/aidevos?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-71%20passed-brightgreen)](#testing)

[Quick Start](#quick-start) · [How It Works](#how-it-works) · [Dashboard](#dashboard) · [Skills](#skills) · [CLI Reference](#cli-reference)

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

AIDevOS injects standardized **Skills** (structured SOPs) into your AI coding tool, turning chaotic AI-assisted development into a **trackable, measurable, self-improving process**.

```
PRD → Analysis → Tasks → Code → Review → Ship
         ↑                          |
         └── Rules ← Deviations ←──┘
```

Every step is recorded. Every deviation becomes a rule. Every rule makes the next run better.

## Quick Start

```bash
# Install globally
npm install -g aidevos

# Initialize in your project (interactive setup)
cd your-project
aidevos init
```

Choose your AI tool (Claude Code or Cursor). AIDevOS will:

1. Create `.aidevos/` with 14 AI Skills
2. Register slash commands (`/workflow`, `/audit`, `/deviation`...)
3. Seed project rules with iron laws

Then start building:

```bash
# Create a new development run
aidevos start

# Place your PRD, then let AI take over
/workflow
```

The AI will execute: **Requirement Analysis** → *User Confirmation* → **Task Decomposition** → **Code Generation** → **Self-Review** → loop until done.

```bash
# See what happened
aidevos dashboard
```

Open `http://localhost:2375` — real-time dashboard with live updates.

## How It Works

AIDevOS is **not** an AI coding agent. It's an **observability layer** that standardizes how your existing AI tools work.

```
┌─────────────────────────────────────────────────┐
│  Your IDE (Claude Code / Cursor)                │
│                                                 │
│  ┌──────────┐  reads   ┌──────────────────┐    │
│  │ AI Agent ├─────────→│ .aidevos/skills/ │    │
│  │          │          │ (14 SOPs)        │    │
│  │          │  writes  ┌──────────────────┐    │
│  │          ├─────────→│ aidevos log ...  │    │
│  └──────────┘          │ (structured CLI) │    │
│                        └────────┬─────────┘    │
└─────────────────────────┬───────┘──────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  run.json   │ ← Single source of truth
                   └──────┬──────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌─────────┐
        │Dashboard │ │Reports │ │Analysis │
        │ (React)  │ │ (.md)  │ │ (JSON)  │
        └──────────┘ └────────┘ └─────────┘
```

### Three-Layer Data Model

| Layer | File | Scope | Purpose |
|-------|------|-------|---------|
| **L0** | `run.json` | Per developer | Every task, bug, deviation, review, rule |
| **L1** | `requirement.json` | Per branch | Aggregated developer stats, module assignments |
| **L2** | `index.json` | Per project | Cross-branch overview for team leads |

### The Self-Improving Loop

This is what makes AIDevOS different. It's not just tracking — it's **learning**.

```
   AI generates code
         │
         ▼
   Self-review catches issues
         │
         ├── Pass → next task
         │
         └── Fail → fix → record deviation
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

- KPI cards: task completion, deviation rate, bug count, review pass rate, ROI
- Task timeline with stage breakdown
- Node time distribution (where did the AI spend time?)
- Bug severity distribution
- Review issue categories
- File change heatmap

**Project Overview** — team lead perspective across all branches:

- Requirement status ring chart
- Developer efficiency comparison
- Cross-branch totals and highlights

```bash
aidevos dashboard              # Default port 2375
aidevos dashboard --port 3000  # Custom port
```

Dashboard updates in real-time via SSE — no refresh needed.

## Skills

AIDevOS ships with **14 AI Skills** — structured SOPs that tell your AI tool exactly what to do and how to record it.

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

AIDevOS uses a **Registry + Generated Views** pattern for project rules:

```
.aidevos/rules.json     ← Source of truth (committed to git)
.aidevos/rules/*.md     ← Auto-generated views (gitignored)
```

- **Fingerprint dedup**: SHA256 hash prevents duplicate rules across parallel branches
- **Auto-merge**: `aidevos rules merge` resolves git conflicts by taking the union
- **Similarity detection**: `aidevos rules dedupe` finds near-duplicate rules via Jaccard similarity
- **Category system**: `component`, `api`, `style`, `i18n`, `architecture`, `state-management`, `routing`, `testing`, `process`, `general`

Rules are automatically rebuilt on every `aidevos start` and every rule sedimentation.

## CLI Reference

| Command | Description |
|---------|-------------|
| `aidevos init` | Interactive project setup (choose AI tool, select optional skills) |
| `aidevos start` | Create a new development run for current branch |
| `aidevos status` | Show current run status in terminal |
| `aidevos log <sub>` | Write structured data to run.json (12 subcommands) |
| `aidevos dashboard` | Launch real-time visualization dashboard |
| `aidevos rules <sub>` | Manage rules registry (`build`, `dedupe`, `merge`, `list`) |
| `aidevos reindex` | Rebuild project-level index from all runs |
| `aidevos report` | Generate markdown performance report (`--scope me/team`) |
| `aidevos update` | Update all skills to latest version |
| `aidevos migrate` | Migrate old run.json format to current schema |

### `aidevos log` Subcommands

```bash
aidevos log task --title "Create API layer" --stage "Infrastructure" --prd-phase "PRD1"
aidevos log task-start --id TASK-01
aidevos log task-done --id TASK-01
aidevos log bug --title "Type mismatch" --severity high --source self-review
aidevos log bug-fix --id BUG-01 --fix "Fixed response type"
aidevos log deviation --title "Wrong component" --root-cause rule-missing --category component-usage
aidevos log review --task-id TASK-01 --result pass --scope "src/api/"
aidevos log rule --content "Use Drawer for detail views" --category component
aidevos log file --path "src/api/user.ts" --change-type modified --lines-added 50
aidevos log cost --tokens 125000 --stage "requirement-analysis"
aidevos log highlight --content "FCP reduced from 3.2s to 0.8s"
```

All writes are validated against the schema. Invalid enum values or missing required fields are rejected with clear error messages.

## Project Structure

```
your-project/
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

71 tests across 4 test suites:

- **`rules.test`** — Fingerprint dedup, registry CRUD, view generation, merge, similarity detection
- **`cli-log.test`** — All 12 log subcommands, enum validation, metrics calculation, requirement.json sync
- **`cli-start.test`** — run.json structure integrity, schema alignment, gitignore management
- **`reindex.test`** — Index aggregation, status inference, edge cases

## Tech Stack

- **CLI**: Node.js + TypeScript (zero runtime dependencies)
- **Dashboard**: React 19 + ECharts + Tailwind CSS 4
- **Data**: JSON files (no database required)
- **Real-time**: Server-Sent Events (SSE)
- **Tests**: Node.js built-in test runner

## Philosophy

> The performance of a system is not determined by its strongest component, but by the synergy between all parts.

AIDevOS is built on three iron laws:

1. **No hallucination** — When uncertain, ask. Never guess.
2. **No unauthorized docs** — Don't generate documents without explicit permission.
3. **Clean workspace** — Test scripts must be deleted after passing. Keep the project lean.

These laws are enforced in every AI Skill and injected into your project's global rules.

## Contributing

Issues and PRs welcome.

## License

[MIT](./LICENSE)
