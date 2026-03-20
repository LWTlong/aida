# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

系统性能不取决于最强环节，而取决于各部分的协同效率；


本项目中必须严格遵守：

-   禁止任何形式的臆想，不清楚必须询问

-   禁止随意生成文档，如需生成文档，必须询问用户是否需要

-   生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽

-   修改的时候，必须确保协同的 skill 读写的字段和 json 数据结构字段对的上


## Project Overview

**ai-dev-os** (AIDevOS) is an open-source AI Development Observability Platform. It tracks the full lifecycle of AI-assisted development: PRD ingestion, requirement analysis, task decomposition, code generation, deviations, bug fixes, self-review, and timeline — then visualizes it all in a dashboard.

The project is in early planning stage with PRD and technical design docs but no source code yet.

## Planned Tech Stack

- Node.js + TypeScript
- React (dashboard)
- SQLite (data storage)

## Planned Architecture

```
CLI → structured markdown → data collector → SQLite → dashboard server
```

Planned modules: `core/`, `tracker/`, `rules/`, `workflow/`, `dashboard/`

## Planned CLI Commands

```bash
npx aidevos init          # Initialize project
aidevos start FEATURE-001 # Create new requirement
aidevos analyze           # Run analysis
aidevos tasks             # Generate tasks
aidevos dashboard         # Launch dashboard
```

## Key Design Documents

- `docs/PRD.md` — Full product requirements (bilingual CN/EN)
- `docs/Technical.md` — Technical architecture spec


## AIDevOS Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
