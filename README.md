<div align="center">

# AIDA

### 管理 AI 工具资产的 JSON 真源。

AIDA 2.0 只关注长期有价值的项目资产：
**rules、skills、memories、summary。**

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

[![npm version](https://img.shields.io/badge/npm-v2.0.0-0066ff)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-analytics?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](#验证)
[![ai-dev-analytics MCP server](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics/badges/score.svg)](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics)

[30 秒上手](#30-秒上手) · [真源模型](#20-真源模型) · [命令模型](#命令模型) · [命令文档](./COMMANDS.md) · [文档导航](./docs/INDEX.md) · [English](./README.en.md)

</div>

---

## 为什么是 2.0

2.0 不再围绕 task 流水账、运行态 timeline 或 dashboard。

它只保留真正需要长期沉淀的内容：

- 项目规则 `rules`
- 项目技能 `skills`
- 模块记忆 `memories`
- 需求摘要 `summary`

这些 JSON 真源统一存放在 `.aida/` 下，再按需分发到 `.cursor`、`.claude`、`.codex`、`.lingma` 等工具目录。工具目录只是 projection，不是主数据。

---

## 2.0 真源模型

```text
.aida/
  config.json
  rules.json
  skills.json
  summary.json
  aida-guide.md
  memories/
    index.json
    modules/*.json
```

- `rules.json`：项目级技术规范真源
- `skills.json`：项目级技能真源
- `summary.json`：需求级摘要
- `memories/index.json`：低成本检索索引
- `memories/modules/*.json`：模块级上下文与约束

2.0 会主动清理这些 1.x 噪音：

- `run.json`
- task 持久化流水账
- `timeline / workflow / events`
- `.aida/runs/**`
- `.aida/index.json`
- `.aida/tool-configs.json`

---

## 30 秒上手

### 1. 安装 MCP

在项目根目录 `.mcp.json` 中加入：

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["--registry=https://registry.npmjs.org/", "-y", "ai-dev-analytics", "mcp"] } } }
```

如果你更喜欢全局命令：

```bash
npm install -g ai-dev-analytics
```

然后把 `command` 改为 `"aida"`。

### 2. 初始化项目

```bash
aida init
```

### 3. 重建投影

```bash
aida sync
```

---

## 命令模型

当前主命令只保留这几类：

```bash
aida init
aida sync
aida doctor
aida rules
aida skills
aida memory
aida mcp
```

心智很简单：

- `init`：初始化 2.0 真源和工具接入
- `sync`：日常收口，刷新 memory/summary/工具投影
- `doctor`：检查并清洗项目状态
- `rules / skills / memory`：直接管理资产本身

详细行为见 [COMMANDS.md](./COMMANDS.md)。

---

如果你的项目已经是 2.0 结构，日常只需要：

```bash
aida sync
```

---

## 验证

本仓库当前通过：

```bash
npm test
npm run build
```
