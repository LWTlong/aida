# AGENTS.md

## AIDA

**⚠️ 严禁跳过：开始任何开发任务前，必须先读取 `.aida/aida-guide.md`，并严格执行其中的数据采集与规则沉淀规范。**
**开始编码前，必须先检查 AIDA MCP 是否可用：先调用 `aida_bootstrap`，传入 `action="status"`；如果不可用，先提示用户检查并启用/批准 AIDA MCP；如果可用，再调用 `aida_bootstrap`，传入 `action="manifest"` 读取需要集中授权的工具清单，并向用户说明“提前授权是为了避免后续开发过程中被 AIDA 中断”；用户决定后，再调用 `aida_bootstrap`，传入 `action="complete"` 记录本地 bootstrap 状态。**
**开始编码前，优先读取 `.codex/rules/aida/_all.md`；若不存在，则读取 `.aida/rules/_all.md`（如果存在）以获取当前项目规则。**
**开始编码前，先调用 `aida_memory`，传入 `action="search"` 检索当前功能模块；命中后优先调用 `aida_memory`，传入 `action="get"` 恢复模块上下文。**
**当用户直接要求沉淀规则，或你识别到需要沉淀项目级技术规范时，优先调用 `aida_record`，传入 `action="rule"`；若当前会话未配置 AIDA MCP，则使用 CLI `aida rules add` 写入 `.aida/rules.json`。**

## Project Overview

This repository is **AIDA / ai-dev-analytics**.

- Purpose: manage project rules, skills, module memories, and demand summaries as JSON truth sources across AI tools.
- Core capabilities: MCP server, CLI, rules/skills registries, memory/summary truth-source management, migration and build flow.
- Main stack: Node.js + TypeScript, React 19, Tailwind CSS 4, MCP over stdio.

## Mandatory Startup Context

Before starting any development task in this repository:

1. Read `.aida/aida-guide.md`
2. Read `.aida/rules/_all.md` if it exists
3. Follow the AIDA 2.0 memory / summary / rule sedimentation flow for each actual implementation task

Do not skip those steps.

## AIDA 2.0 Repository Rules

Only enter the AIDA sedimentation flow after you start making actual repository changes. Do not record pure investigation, solution discussion, read-only analysis, ordinary chat, local environment operations, or experiments that do not land in the repository as AIDA truth-source changes.

For each real coding task that produces actual repository changes, the product model in this repository is:

1. restore relevant rules and memory context
2. implement the change
3. update the 2.0 truth sources when needed:
   - `.aida/rules.json`
   - `.aida/skills.json`
   - `.aida/memories/index.json`
   - `.aida/memories/modules/*.json`
   - `.aida/summary.json`
4. rebuild generated artifacts with `aida sync` or `aida build`

During development:

- do not persist task ledgers, runtime history, timeline, workflow, or event logs as part of the 2.0 product model
- only sediment final useful memory, summary, and project-level rules
- if a rule is missing and belongs to a long-lived project convention, ask the user before sedimenting it

Repository-local AIDA bookkeeping during implementation is still allowed for this repo's own maintenance flow, but it must not leak back into the public 2.0 product semantics or generated guide text.

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

Project-specific skills have been migrated into `~/.codex/skills/`. Use only the ones that still match the 2.0 architecture work in this repository:

- `audit`
- `rules-evolver`
- `bug-fixer`
