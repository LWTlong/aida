# CLAUDE.md

## AIDA

**⚠️ 严禁跳过：开始任何开发任务前，必须通过 Read 工具读取 `.aidevos/aida-guide.md` 的完整内容，并严格按照其中的规范执行。不得以任何理由跳过。**

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

## AIDevOS Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
