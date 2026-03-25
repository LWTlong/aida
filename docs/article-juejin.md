# 我给 Vibe Coding 装了个黑匣子，AI 终于不再重复犯错了

## 前言

用 Claude Code / Cursor 写代码的人越来越多了，但有个问题大家一定遇到过：

> AI 写的代码，80% 能用，但总有那 20% 是"差点意思"的 —— 组件用错了、布局跟项目规范不一样、API 调用方式不对。你纠正一次，下次它又犯。

为什么？因为 **AI 没有记忆**。每次对话都是全新的开始，上次犯的错、你纠正的内容，它一概不知。

我做了一个工具来解决这个问题 —— **AIDA**（AI Development Analytics）。

一句话概括：**给 Vibe Coding 过程装个黑匣子，自动采集数据，把 AI 的错误模式沉淀成规则，让 AI 越用越懂你的项目。**

已过 Glama.ai 三 A 认证（安全 A / 许可 A / 质量 A），开源 MIT，一行接入。

![Glama 3A](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics/badges/card.svg)

## 一行接入，零改动

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["-y", "ai-dev-analytics", "mcp"] } } }
```

把这行加到 `.mcp.json`，完事。不需要改代码，不需要学新工具，不需要任何配置。你照常 vibe coding，AIDA 在后台静默采集数据。

支持 Claude Code、Cursor、VS Code Copilot、Windsurf。

## 它到底采集了什么？

AIDA 通过 MCP 协议提供 10 个工具，AI 在开发过程中自动调用：

| 采集维度 | 说明 |
|---------|------|
| 任务生命周期 | 每个任务的开始、完成、耗时 |
| Bug 记录 | 严重度、来源、修复方案 |
| 代码自检 | 通过/不通过、问题列表 |
| 偏差记录 | AI 输出 vs 你的预期，根因分析 |
| 文件变更 | 自动扫描 git diff |
| 规则沉淀 | 从偏差中提取项目规范 |

关键是：**这些都是 AI 自动调用的，你不需要手动操作。**

## 核心价值：数据驱动的规则反哺

采集数据不是目的，**让 AI 从错误中学习才是。**

真实项目数据：

| 运行 | 偏差情况 | 发生了什么 | 沉淀的规则 |
|------|---------|-----------|-----------|
| 第 1 轮 | 47 个任务产生 23 个偏差 | 组件用错、布局写反、API 模式不对 | 沉淀 6 条项目专属规则 |
| 第 2 轮 | **零重复偏差** | AI 读了规则，相同模式的错误归零 | — |

这就是 AIDA 的闭环：

```
Vibe Coding → AIDA 采集数据 → 看板展示规律
    → 发现偏差模式 → 沉淀为规则 → AI 下次读取规则
    → 同样的错误被消除 → 循环往复
```

**每一轮，AI 的输出都更接近你的预期。** 这不是 AI 幻觉，这是数据驱动的复利。

### 看看具体长什么样

**偏差根因分布** —— AI 为什么出错？一眼看清是幻觉、规则缺失还是上下文不足：

![偏差根因分布](https://raw.githubusercontent.com/LWTlong/ai-dev-analytics/main/docs/deviation-root-cause.png)

**偏差类别分布** —— AI 在哪出错？精准定位到布局、组件、API 还是样式：

![偏差类别分布](https://raw.githubusercontent.com/LWTlong/ai-dev-analytics/main/docs/deviation-category.png)

**偏差 & 规则趋势** —— 绿色线是规则数量，随着规则积累，偏差持续下降。这就是复利：

![偏差与规则趋势](https://raw.githubusercontent.com/LWTlong/ai-dev-analytics/main/docs/deviation-rule-trend.png)

## 看得见的数据看板

以上只是局部，所有数据汇聚到一个完整的交互式看板：

![Dashboard](https://raw.githubusercontent.com/LWTlong/ai-dev-analytics/main/docs/dashboard.png)

> 在线 Demo：https://lwtlong.github.io/ai-dev-analytics/

你还能看到：

- **Bug 严重度分布** —— 哪个阶段质量最差？
- **自检通过率** —— AI 代码质量在变好还是变差？
- **文件修改热点** —— 哪些文件被反复修改？
- **规则溯源表** —— 每条规则关联到产生它的偏差
- **完整开发时间线** —— 每个任务、Bug、审查按时间排列

每个 KPI 卡片都可点击下钻到详情。

## 灵活使用：按需组合

AIDA 不是一个全有或全无的工具。你可以按需使用：

### 模式一：只用数据采集（推荐新手）

加一行 MCP 配置，照常 coding。AIDA 静默采集，想看数据时打开看板。

```bash
npx ai-dev-analytics dashboard
```

### 模式二：数据采集 + 规则沉淀

当 AI 犯错时，记录偏差。如果偏差根因是规则缺失，AI 会建议沉淀规则。你确认后，规则写入 `.aidevos/rules/`，AI 下次会自动读取。

### 模式三：完整 SOP 流程

```bash
aida init    # 选择 Full workflow，获得 14 个 AI Skills
aida start   # 创建开发运行
```

完整的 AI 辅助开发流水线：

```
PRD 接入 → 需求分析 → 任务拆分 → 代码生成 → 自检审查 → Bug 修复 → 偏差修复 → 规则沉淀
```

每个步骤都有对应的 AI Skill 执行，每个环节都自动采集数据。适合团队标准化落地。

## 数据沉淀 = 绩效汇报神器

所有数据都是结构化 JSON，天然适合做汇报：

```
第 1 周：47 个任务、23 个偏差、5 个 Bug、6 条规则、4064 行代码
第 4 周：180+ 任务、偏差率持续下降、15 条规则、完整质量历史
一个季度：完整的开发记录 —— 可导出、可分析、可汇报
```

| 汇报场景 | AIDA 提供什么 |
|---------|-------------|
| **H1/H2 绩效** | 任务完成量、质量指标（通过率、Bug 率）、代码产出、贡献的规则 |
| **Sprint 回顾** | 哪里出了问题、新增了哪些规则、质量变化趋势 |
| **团队 Leader 报告** | 各开发者数据对比、偏差热点、AI 成熟度 |
| **项目交接** | 完整开发历史 + 规则库，接手的人直接受益 |

你不再需要"凭感觉"写绩效了。**数据比"我觉得我干了很多"有说服力一百倍。**

## 100% 本地，零外部请求

这一点必须强调：**AIDA 没有任何外部 HTTP 请求。** 不发遥测、不上传云端、不追踪任何东西。所有数据都在项目的 `.aidevos/` 目录里，是普通的 JSON 文件。零运行时依赖。

你的代码和数据不会离开你的电脑。

## 技术栈

- **运行时**：Node.js + TypeScript，零运行时依赖
- **看板**：React 19 + ECharts + Tailwind CSS 4
- **协议**：MCP over stdio (JSON-RPC 2.0)
- **数据**：本地 JSON 文件
- **国际化**：中文 / 英文看板内一键切换
- **测试**：82 个测试用例全部通过

## 上手

```bash
# 1. 加 MCP 配置（加一行到 .mcp.json）
{ "mcpServers": { "aida": { "command": "npx", "args": ["-y", "ai-dev-analytics", "mcp"] } } }

# 2. 正常 coding，AIDA 自动采集

# 3. 看看数据
npx ai-dev-analytics dashboard
```

- GitHub：https://github.com/LWTlong/ai-dev-analytics
- 在线 Demo：https://lwtlong.github.io/ai-dev-analytics/
- Glama：https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics
- npm：https://www.npmjs.com/package/ai-dev-analytics

---

**没有数据的 Vibe Coding 只是在 Vibe。有了数据，你的 AI 每次运行都在进化。**

如果觉得有用，欢迎 star 支持一下。有问题直接提 Issue，会认真回复。
