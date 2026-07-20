<div align="center">

# AIDA

### AI 工具资产治理层 — 规则、技能、决策记忆、插件

[![version](https://img.shields.io/badge/version-3.0.1-0066ff)](./package.json)
[![license](https://img.shields.io/github/license/LWTlong/aida?color=%23333)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](#验证)

</div>

---

## 三大能力

### 1. 资产治理

扫描 `.claude/rules/`、`.cursor/rules/`、`.codex/`、`.aida/` 等目录，找出重复、矛盾、失效的规则和技能。所有写操作走 `aida_apply_governance` MCP 工具，每批 journal 一次，可通过 `aida_undo` 一键回滚。

**核心 skill：** `/aida-govern`（一站式）、`/aida-clean-rules`、`/aida-rules-to-skills`

### 2. 分层决策记忆

用 MADR 格式把 "为什么这段代码这么写" 记录到 `.claude/rules/decisions/`。Claude Code 通过 `paths` 前置元数据在相关文件打开时自动加载，无需手动召回。

**核心 skill：** `/aida-remember`、`/aida-remember-branch`

### 3. AI 资产总览

本地 Dashboard（`aida dashboard`）提供 package.json 风格的资产清单：规则/技能/决策/MCP 配置/插件，一屏看完。

**核心 skill：** `/aida-audit`

---

## 30 秒上手（Claude Code Plugin）

```
/plugin marketplace add LWTlong/aida
/plugin install aida@aida
```

重启 Claude Code。16 个 `aida-*` skill 会立刻可用。

**升级：**

```
/plugin update aida
```

### Cursor / Codex / VS Code（可选，走 MCP）

在项目根 `.mcp.json` 加入：

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["-y", "aida", "mcp"] } } }
```

或用一键脚本：

```bash
npx aida init
```

---

## Skill 一览

| 类别 | Skill | 用途 |
|---|---|---|
| **治理** | `/aida-govern` | 一站式：扫描 → 分析 → 确认 → 一次落盘（含 2.x 遗留物清理） |
|  | `/aida-clean-rules` | 合并重复规则、拆分过长规则、解决冲突 |
|  | `/aida-rules-to-skills` | 将任务型规则提取为可复用 skill |
|  | `/aida-audit-docs` | 审计并清理 AI 生成的文档冗余 |
|  | `/aida-resolve` | 处理 AI 资产文件的 git 合并冲突 |
|  | `/aida-sync` | 同步 Claude、Cursor、Codex 中的规则配置 |
|  | `/aida-import` | 安全导入外部 Claude Plugin |
|  | `/aida-cleanup` | 底层清理（按行/文件粒度） |
| **只读** | `/aida-audit` | 扫描并梳理项目所有 AI 资产 |
|  | `/aida-analyze` | 沉淀功能/分支分析到项目记忆 |
|  | `/aida-recall` | 检索项目记忆 |
| **记忆** | `/aida-remember` | 沉淀项目决策为 MADR 记录 |
|  | `/aida-remember-branch` | 沉淀当前分支相关的决策 |
|  | `/aida-undo` | 回滚最近的 AIDA 写操作 |
| **分享** | `/aida-pkg` | 打包资产为 Claude Plugin |
|  | `/aida-help` | 显示 skill 参考卡片 |

---

## MCP 工具清单

| 工具 | 作用 |
|------|------|
| `aida_bootstrap` | 初始化 / 状态检查 / 工具授权清单 |
| `aida_scan_assets` | 扫描所有 AI 资产 |
| `aida_list_assets` / `aida_get_asset` | 浏览资产 |
| `aida_apply_governance` | 执行治理动作（create/modify/delete/remove-lines），全部 journaled |
| `aida_undo` | 撤销上一次治理操作 |
| `aida_write_analysis` | 写分析报告 |
| `aida_memory` / `aida_remember` / `aida_recall` | 读写决策记忆 |
| `aida_build_plugin` | 打包项目资产为 Claude Plugin |
| `aida_build_self_plugin` | 打包 AIDA 自身为 Plugin |
| `aida_parse_plugin` / `aida_audit_plugin_risk` | 解析/审计外部 Plugin |

---

## 项目结构

```text
.claude-plugin/
  plugin.json           # Claude Plugin 清单（本仓库本身就是 plugin）
  marketplace.json      # Marketplace 清单
src/
  assets/skills/        # 16 个 aida-* skill 源（plugin skills 字段指过来）
  core/                 # 扫描、治理、undo、memory、plugin builder
  mcp/server.ts         # MCP server
  cli/                  # aida CLI
  dashboard/            # Dashboard 前端产物
.claude/
  rules/decisions/      # MADR 决策记忆（Claude Code 自动加载）
.aida/
  cache/                # 扫描结果 + undo journal
```

---

## 验证

```bash
npm test
npm run build
```
