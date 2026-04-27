# AGENTS.md

## AIDA

**⚠️ 严禁跳过：开始任何开发任务前，必须先读取 `.aida/aida-guide.md`，并严格执行其中的数据采集与规则沉淀规范。**
**开始编码前，必须先检查 AIDA MCP 是否可用：先调用 `aida_bootstrap`，传入 `action="status"`；如果不可用，先提示用户检查并启用/批准 AIDA MCP；如果可用，再调用 `aida_bootstrap`，传入 `action="manifest"` 读取需要集中授权的工具清单，并向用户说明“提前授权是为了避免后续开发过程中被 AIDA 中断”；用户决定后，再调用 `aida_bootstrap`，传入 `action="complete"` 记录本地 bootstrap 状态。**
**开始编码前，优先读取 `.codex/rules/aida/_all.md`；若不存在，则读取 `.aida/rules/_all.md`（如果存在）以获取当前项目规则。**
**开始编码前，先调用 `aida_memory`，传入 `action="search"` 检索当前功能模块；命中后优先调用 `aida_memory`，传入 `action="pack"`，或继续调用 `action="get"` / `action="context-get"` 恢复上下文。若当前分支上下文不存在，先调用 `aida_memory`，传入 `action="context-rebuild"`。**
**当用户直接要求沉淀规则，或你识别到需要沉淀项目级技术规范时，优先调用 `aida_record`，传入 `action="rule"`；若当前会话未配置 AIDA MCP，则使用 CLI `aida rules add` 写入 `.aida/rules.json`。**

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

Only enter the AIDA task flow after you start making actual repository changes. Do not record pure investigation, solution discussion, read-only analysis, ordinary chat, local environment operations, or experiments that do not land in the repository as AIDA tasks.

For each real coding task that produces actual repository changes, follow this order:

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
3. Do not record chats, investigations, proposals, local package installs, registry/token troubleshooting, `npm link/unlink`, Volta or other machine-local environment operations as AIDA tasks or branch/module memory unless they result in actual repository changes.
4. If a rule needs to be sedimented but does not require repository code changes, sediment the rule normally and do not create an AIDA task just for that rule-only action.

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
