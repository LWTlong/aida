# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

系统性能不取决于最强环节，而取决于各部分的协同效率；


本项目中必须严格遵守：

-   禁止任何形式的臆想，不清楚必须询问

-   禁止随意生成文档，如需生成文档，必须询问用户是否需要

-   生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽

-   修改的时候，必须确保协同的 skill 读写的字段和 json 数据结构字段对的上


## Project Overview

**AIDA** (AI Development Analytics) is an open-source AI Development Observability Platform. It tracks the full lifecycle of AI-assisted development: PRD ingestion, requirement analysis, task decomposition, code generation, deviations, bug fixes, self-review, and timeline — then visualizes it all in a dashboard.

## Tech Stack

- Node.js + TypeScript (zero runtime dependencies)
- React 19 + ECharts + Tailwind CSS 4 (dashboard)
- JSON files (data storage, no database)
- MCP (Model Context Protocol) over stdio

## Architecture

```
AI Tool → MCP Server (9 tools) → run.json ← CLI (aida log)
                                     ↓
                              Dashboard (React)
```

Key modules: `src/cli/`, `src/mcp/`, `src/schemas/`, `src/utils/`, `dashboard/`

## CLI Commands

```bash
aida init          # Initialize project
aida start         # Create new development run
aida mcp           # Start MCP server (stdio)
aida log <sub>     # Write structured data to run.json
aida dashboard     # Launch visualization dashboard
aida status        # Show current run status
aida update        # Update skills to latest version
aida rules <sub>   # Manage rules registry
aida reindex       # Rebuild project-level index
aida report        # Generate performance report
aida migrate       # Migrate old schema
```

## Naming Convention

- npm package: `ai-dev-analytics`
- CLI command: `aida`
- MCP tool prefix: `aida_` (e.g. `aida_task_start`)
- Data directory: `.aidevos/` (unchanged for backwards compatibility)
- Brand: AIDA

## AIDA Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽


## AIDA

本项目使用 AIDA 进行开发数据采集与规则沉淀，开发过程中必须遵循 `.aidevos/aida-guide.md` 中的数据采集和规则沉淀规范。如果存在 `.aidevos/rules/_all.md`，请在开始开发前读取该文件了解已沉淀的项目规则。


## AIDevOS Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
