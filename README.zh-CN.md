<div align="center">

# AIDA

### AI 开发数据分析平台

**AI 开发的黑匣子。**

你的 AI 每天都在写代码 —— 但你根本不知道它到底做了什么。<br>
AIDA 记录一切，展示数据，让你的 AI 越用越好。

[![npm version](https://img.shields.io/npm/v/ai-dev-analytics?color=%230066ff&label=npm)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-analytics?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-82%20passed-brightgreen)](#测试)

[快速开始](#快速开始) · [数据看板](#数据看板) · [工作原理](#工作原理) · [完整工作流](#完整工作流模式) · [CLI 命令](#cli-命令) · [English](./README.md)

</div>

---

## 为什么需要 AIDA？

你用 Claude Code、Cursor 或 Copilot 开发功能。AI 生成了几百行代码。然后呢？

- 完成了多少任务？**不知道。**
- 引入了多少 Bug？**没有记录。**
- 违反了哪些架构规范？**无从追溯。**
- AI 到底有没有帮你省时间？**无法证明。**

每一次 AI 开发会话都是一个**黑盒**。关掉 IDE 的那一刻，所有过程数据就消失了。

**AIDA 就是飞行记录仪。** 它静默采集 AI 的工作数据 —— 任务、Bug、偏差、审查、文件变更、Token 消耗 —— 把这些变成可分析、可可视化、可行动的结构化数据。

## 两种模式

| 模式 | 做什么 | 接入成本 |
|------|--------|---------|
| **纯数据采集** | 静默记录，零工作流改动 —— AI 开发的黑匣子 | 加一段 JSON 配置 |
| **完整工作流** | 数据采集 + AI 开发 SOP + 规则自进化 | `aida init` |

**建议从数据采集开始。** 它是无侵入的 —— AI 工具在正常工作时自动调用 MCP 工具采集数据，你的开发方式完全不用变。当你看到数据的价值后，再升级到完整工作流，形成闭环。

## 快速开始

在你的 AI 工具中加入 MCP 配置。搞定 —— AIDA 开始自动记录。

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
<summary>Cursor / VS Code Copilot / Windsurf 配置</summary>

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

不需要任何初始化。MCP 服务使用 **懒加载初始化** —— 首次工具调用时自动创建数据目录并开始记录。

随时查看数据：

```bash
npx ai-dev-analytics dashboard
```

打开 `http://localhost:2375` —— 实时数据看板，SSE 自动刷新。

## 数据看板

基于 React + ECharts 的实时数据可视化。

**分支详情视图：**

- KPI 总览：任务完成数、偏差率、Bug 数、自检通过率、Token 消耗、ROI
- Token 消耗明细：每任务的 input / output / cache token 分布
- 节点耗时分布（叠加 Token 消耗）
- 各阶段任务完成情况（含耗时和 Token 统计）
- 任务耗时 TOP 10 排行
- Bug 严重等级分布
- 自检问题分类及首次通过率趋势
- 文件变更热力图
- 偏差根因分析和分类分布

**项目总览视图（给 TL 看的）：**

- 需求状态环形图
- 开发者效率对比
- 跨分支汇总统计和亮点

```bash
aida dashboard              # 默认端口 2375
aida dashboard --port 3000  # 自定义端口
```

## 工作原理

AIDA **不是** AI 编码 Agent。它是现有 AI 工具的**数据观测层**。

```
你的 IDE (Claude Code / Cursor / VS Code / Windsurf)
    │
    │  AI 正常工作
    │
    ├──→ MCP Server (9 个工具) ──→  run.json  ──→  Dashboard
    │    静默数据采集              结构化数据      实时可视化
    │
    └──→ Skills (14 个 SOP)   ──→  run.json  ──→  Rules
         工作流编排（可选）        同一数据源     自进化 AI 知识库
```

### 数据采集（MCP）—— 黑匣子

9 个 MCP 工具，AI 自动调用：

| 工具 | 记录什么 |
|------|---------|
| `aida_task_start` / `aida_task_done` | 任务生命周期和耗时 |
| `aida_log_bug` / `aida_bug_fix` | Bug 发现和修复 |
| `aida_log_review` | 代码审查结果（通过/不通过） |
| `aida_log_deviation` | AI 产出与预期的偏差 |
| `aida_log_files` | 文件变更（自动扫描 git diff） |
| `aida_highlight` | 值得关注的亮点 |
| `aida_status` | 当前运行状态 |

**Claude Code** 用户还能自动采集 Token 用量 —— 每个任务的 input/output/cache token 明细。

**光是这些，你就已经拥有了一份完整的 AI 开发飞行记录。** 不需要改变工作流，不需要额外命令，零摩擦。

### 三层数据模型

| 层级 | 文件 | 范围 |
|------|------|------|
| **L0** | `run.json` | 每个开发者 —— 任务、Bug、偏差、审查的完整记录 |
| **L1** | `requirement.json` | 每个分支 —— 聚合统计、模块分工 |
| **L2** | `index.json` | 整个项目 —— 跨分支总览 |

## 完整工作流模式

当数据采集不够用，你想要 **AI 每次都比上次写得更好** 时，开启完整工作流。

```bash
npm install -g ai-dev-analytics
cd your-project
aida init    # 选择 "Full workflow"
aida start   # 创建开发运行
/workflow    # AI 接管
```

### 开发循环

```
需求文档 (PRD)
    │
    ▼
需求分析 ──→ 用户确认理解
    │
    ▼
任务拆分 ──→ 原子化、可测试的工单
    │
    ▼
┌─→ 代码生成 ──→ 质量自检
│       │            │
│       │      通过 ─┤── 不通过
│       │            │
│       │      下一  └─→ Bug 修复 ─→ 重新自检
│       │      任务
└───────┘
    │
    ▼
全部任务完成 → 工作流闭环
```

每个步骤都写入 `run.json`。中断后恢复，从断点处无缝续拍。

### 自进化循环 —— 这才是核心

这是完整工作流和"直接用 AI 工具"的根本区别：

```
AI 生成代码
     ↓
质量自检发现问题
     ↓
记录为偏差 ← "AI 用了错误的组件"
     ↓
是不是普遍性问题？ → 沉淀为项目规则
     ↓
下次 AI 读取规则
     ↓
同样的错误不再发生
```

你的 `.aidevos/rules/` 目录会逐渐长成一个**项目专属的 AI 知识库**。每一次偏差、每一个 Bug、每一次自检失败都是数据点。随着规则进化，AI 的产出质量可度量地提升。

**纯数据采集是黑匣子。完整工作流把闭环跑通。**

两种模式可以分开用，也可以一起用：
- 只用数据采集 → 掌握 AI 开发的真实数据，知道钱花在哪里
- 只用工作流 → 让 AI 按 SOP 开发，减少低级错误
- **两者一起用 → 数据驱动规则沉淀，AI 代码越写越好**

### 14 个 AI Skills

| 类型 | Skills |
|------|--------|
| **工作流** | `workflow-orchestrator`（编排器）、`requirement-analyzer`（需求分析）、`task-splitter`（任务拆分）、`code-generator`（代码生成）、`self-reviewer`（质量自检）、`bug-fixer`（Bug 修复） |
| **手动触发** | `/audit`（扫描代码生成规则）、`/deviation`（记录 AI 偏差）、`/rules-evolver`（根据 PR 反馈进化规则） |
| **工具类** | `dashboard-generator`、`commit-code`、`docx-to-markdown`、`mcp-reviewer`、`dev-flower` |

### 规则系统

```
.aidevos/rules.json     ← 唯一真相源（提交到 git）
.aidevos/rules/*.md     ← 自动生成的分类视图（gitignored）
```

- **指纹去重**：SHA256 防止并行分支产生重复规则
- **自动合并**：`aida rules merge` 通过取并集解决 git 冲突
- **相似检测**：`aida rules dedupe` 基于 Jaccard 相似度发现近似规则

## CLI 命令

| 命令 | 说明 |
|------|------|
| `aida init` | 交互式初始化（选择模式和 AI 工具） |
| `aida start` | 创建新的开发运行 |
| `aida status` | 查看当前运行状态 |
| `aida log <sub>` | 写入结构化数据（12 个子命令） |
| `aida dashboard` | 启动数据看板 |
| `aida mcp` | 启动 MCP 服务（供 AI 工具配置使用） |
| `aida rules <sub>` | 管理规则（`build`、`dedupe`、`merge`、`list`） |
| `aida reindex` | 重建项目级索引 |
| `aida report` | 生成效能报告 |
| `aida update` | 更新 Skills 到最新版本 |
| `aida migrate` | 迁移旧版数据到当前 schema |

## 测试

```bash
npm test    # 82 个测试，5 个测试套件
```

## 技术栈

- **零运行时依赖** —— Node.js + TypeScript
- **MCP Server** —— Model Context Protocol over stdio
- **Dashboard** —— React 19 + ECharts + Tailwind CSS 4
- **数据存储** —— JSON 文件，不需要数据库
- **实时推送** —— Server-Sent Events (SSE)

## 参与贡献

欢迎提 Issue 和 PR：[github.com/LWTlong/ai-dev-analytics](https://github.com/LWTlong/ai-dev-analytics)

## 许可证

[MIT](./LICENSE)
