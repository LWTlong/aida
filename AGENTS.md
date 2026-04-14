# AGENTS.md

## Project Overview

This repository is **AIDA / ai-dev-analytics**.

- Purpose: collect structured data from AI-assisted development sessions, sediment project rules, and visualize the full process in a dashboard.
- Core capabilities: MCP server, CLI, rules registry/build flow, run data collection, dashboard.
- Main stack: Node.js + TypeScript, React 19, Tailwind CSS 4, MCP over stdio.

## Mandatory Startup Context

Before starting any development task in this repository:

1. Read `.aida/aida-guide.md`
2. Read `.aida/rules/_all.md` if it exists
3. Follow the AIDA data collection flow for each actual implementation task

Do not skip those steps.

## AIDA Workflow Rules

For each real coding task, follow this order:

1. `aida_task_start`
2. implement the change
3. `aida_log_files`
4. `aida_log_review`
5. `aida_task_done`

During development:

- Log bugs with `aida_log_bug`
- Mark bug fixes with `aida_bug_fix`
- Log deviations with `aida_log_deviation`
- Log notable improvements with `aida_highlight`

If a deviation has `rootCause = rule-missing` and the fix is a project-level technical convention rather than business logic, ask the user whether to sediment it as a rule before calling `aida_log_rule`.

## Iron Rules

1. Do not hallucinate. If something is unclear, ask or verify.
2. Do not generate extra documentation unless the user asks for it.
3. If you create temporary test scripts for verification, remove them after verification.

## Active Project Rules

1. After each code change delivery, explicitly state:
   - impacted files/modules
   - whether any data structure changed
   - whether existing data remains backward compatible
   - whether migration or reindex is required
2. During task splitting, do not pre-register all tasks with `aida_task_start`. Only call `aida_task_start` immediately before starting real implementation work for that task.

## MCP

This project uses the `aida` MCP server. In Codex, the MCP config should live in `~/.codex/config.toml`.

## Skills

Project-specific skills have been migrated into `~/.codex/skills/`. Prefer the AIDA skills there when the task matches:

- `workflow-orchestrator`
- `requirement-analyzer`
- `task-splitter`
- `code-generator`
- `self-reviewer`
- `bug-fixer`
- `deviation-recorder`
- `rules-evolver`
- `mcp-reviewer`
- `audit`
