<div align="center">

# AIDA

### AI 工具资产治理层 — 规则、技能、决策记忆、插件

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

[![npm version](https://img.shields.io/badge/npm-v3.0.0-0066ff)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-analytics?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](#验证)
[![ai-dev-analytics MCP server](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics/badges/score.svg)](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics)

</div>

---

## 三大能力

### 1. 规则治理

扫描 `.claude/rules/`、`.cursor/rules/` 等目录，找出重复、矛盾、失效的规则，用 `aida_apply_governance` MCP 工具一键删行/批注。

**核心 skill：** `/aida:analyze` → `/aida:cleanup`

### 2. 分层决策记忆

用 MADR 格式把 "为什么这段代码这么写" 记录到 `.claude/rules/decisions/`。Claude Code 通过 `paths` 前置元数据在相关文件打开时自动加载，无需背景说明。

**核心 skill：** `/aida:remember`（单条）、`/aida:remember-branch`（从 diff 批量提取）

### 3. AI 资产总览

本地 Dashboard（`aida dashboard`）提供 package.json 风格的资产清单：规则/技能/决策/MCP 配置/插件，一屏看完，支持搜索和 Plugin 打包导出。

**核心 skill：** `/aida:ui`

---

## 30 秒上手

### 1. 安装 MCP

在项目根目录 `.mcp.json` 中加入：

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

或全局安装后把 `command` 改为 `"aida"`：

```bash
npm install -g ai-dev-analytics --registry=https://registry.npmjs.org
```

### 2. 初始化项目

```bash
aida init
```

### 3. 分析规则（AI 会话内）

```
/aida:analyze
```

AI 扫描资产、找出问题，等待确认后执行 `/aida:cleanup`。

### 4. 打开治理 Dashboard

```bash
aida dashboard
```

---

## MCP 工具清单

| 工具 | 作用 |
|------|------|
| `aida_bootstrap` | 初始化 / 状态检查 |
| `aida_scan_assets` | 扫描所有 AI 资产 |
| `aida_list_assets` / `aida_get_asset` | 浏览资产 |
| `aida_write_analysis` | 写分析报告（aida-analyze 使用） |
| `aida_apply_governance` | 执行规则治理动作 |
| `aida_remember` / `aida_recall` | 读写决策记忆 |
| `aida_undo` | 撤销上一次治理操作 |
| `aida_build_plugin` | 打包项目资产为 Claude Plugin |
| `aida_build_self_plugin` | 打包 AIDA 内置技能为 Plugin |
| `aida_parse_plugin` / `aida_audit_plugin_risk` | 解析/审计外部 Plugin |

---

## 项目结构（关键路径）

```text
.claude/
  rules/
    decisions/          # MADR 决策记忆（Claude Code 自动加载）
    aida/               # AIDA 自身的项目规则

.aida/
  cache/
    assets-index.json   # 最近一次扫描结果
    undo-journal.jsonl  # 可撤销的治理操作日志
  plugins/              # 本地打包的 Claude Plugin
```

---

## 验证

```bash
npm test
npm run build
```
