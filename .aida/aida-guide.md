# AIDA 数据采集与规则沉淀指南

> 此文件引导 AI 在开发过程中采集结构化数据并沉淀项目规则。由 AIDA 自动生成，请勿删除。
> **这是强制规范，不是可选建议。**

## 零、强制前置动作（严禁跳过）

**⚠️ 你正在读取本文件（aida-guide.md）。这是强制规范，严禁跳过任何步骤。**

**开始任何开发任务前，必须按顺序完成以下四步：**

1. **读取项目规则** → 优先读取当前 AI 工具目录下由 `aida build` 生成的规则文件（例如 `.claude/rules/aida/_all.md`、`.cursor/rules/aida/_all.md`、`.codex/rules/aida/_all.md`、`.lingma/rules/aida/_all.md`）；若当前工具目录不可用，则读取 `.aida/rules/_all.md` 这个可读视图；都不存在则跳过
2. **检查 AIDA MCP 与集中授权状态** → 若当前会话可调用 AIDA MCP，必须先调用 `aida_bootstrap`，传入 `action="status"` 检查当前宿主中的 AIDA MCP 是否可用；如果不可用，必须立即提示用户检查并启用/批准 AIDA MCP（例如 Cursor 中可能需要手动打开）；如果可用，再调用 `aida_bootstrap`，传入 `action="manifest"` 读取需要集中授权的工具清单，并明确告知用户“提前授权是为了避免后续开发过程中在 AIDA 数据采集或记忆恢复时被中断”；用户做出授权决定后，再调用 `aida_bootstrap`，传入 `action="complete"` 将本地 bootstrap 状态缓存到 `.aida/bootstrap-state.local.json`。**严禁跳过。**
3. **恢复模块上下文** → 如果已配置 AIDA MCP，优先调用聚合工具 `aida_memory`，传入 `action="search"` 检索当前需求对应模块，再调用 `aida_memory`，传入 `action="get"` 读取命中的模块记忆；若未配置 MCP，则先读取低成本索引：`.aida/memories/index.json`、`.aida/summary.json`；只有当索引命中相关模块后，才继续读取对应的 `.aida/memories/modules/*.json`；如需可读视图，再读取由 `aida memory build` 生成的 `.aida/memories/modules/*.md`
4. **执行数据沉淀流程** → 只在真实仓库改动落地后沉淀项目级规则、模块记忆和需求摘要；不要沉淀 task、runtime、timeline、event、workflow 之类的过程数据

不得以任何理由跳过上述步骤。若 `aida_memory(action="search")` 没有命中模块记忆，可退回正常代码分析流程，但必须先完成检索动作。

**当用户直接口述要沉淀某条项目级技术规范，或你识别到 `rule-missing` 类型偏差需要沉淀规则时，不要只修改本地说明文件。若已配置 AIDA MCP，必须优先调用 `aida_record`，传入 `action="rule"` 写入 `.aida/rules.json`；若未配置 MCP，则使用 CLI `aida rules add` 写入 `.aida/rules.json`。**
**当需求推进后需要沉淀模块记忆时，若已配置 AIDA MCP，优先调用 `aida_memory`，传入 `action="upsert"`；若未配置 MCP，则使用 CLI `aida memory upsert` 更新 JSON 源数据，再按需执行 `aida memory build` 生成 `.md` 视图。不要直接手改生成的 `.md` 视图文件。**

## 一、数据采集

### 核心原则

AIDA 2.0 只沉淀最终有效结果，不沉淀过程流水账。需要保留的是：
- 模块记忆（这个需求对模块改了什么、为什么改、有哪些约束）
- 需求摘要（这个需求最终改了什么、涉及哪些模块）
- 项目级规则（真正长期有效的技术规范）

不需要也不应该保留的内容包括：
- task 流水账
- run/runtime 数据
- timeline / events / workflow
- 讨论过程、排查过程、失败尝试

### 何时不要采集

只有当修改实际落到项目仓库代码或配置后，才进入 AIDA 数据沉淀流程。

以下场景严禁沉淀为 memory/summary/rule 之外的过程数据：
- 纯调查、只读分析、普通聊天
- git 历史排查、`git blame`、`git log`、`git show` 等只读排查
- 本地环境操作，如安装依赖、切换 node 版本、`npm link/unlink`、Volta 操作、token/registry 排障
- 不会落到仓库的临时实验、验证脚本或一次性命令

如果当前工作仍停留在上述阶段，可以继续分析和验证，但不要写入任何过程型数据。只有当你开始产生真实仓库改动时，才进入下面的沉淀流程。

### 单个需求的数据沉淀流程

每完成一个真实需求/功能修改，必须沉淀以下内容：

1. **模块记忆** → 更新命中的 `memories/modules/*.json`，记录这个需求对模块改了什么、为什么改、有哪些约束
2. **需求摘要** → 更新 `.aida/summary.json`，记录 ticket/branch、标题、摘要、涉及模块、关键改动点
3. **规则沉淀** → 如果形成新的项目级技术规范，再写入 `.aida/rules.json`
4. **构建产物** → 执行 `aida sync` 或 `aida build`，把真源分发到各 AI 工具目录

### 多模块场景

如果一次需求同时涉及多个模块，不要拆成大量 task 流水账。应在 `.aida/summary.json` 中保留一条需求摘要，并在每个命中的模块记忆下挂对应的变更摘要。

## 二、规则沉淀

当你识别到某个问题本质上是“项目级技术规范缺失”时，必须评估是否需要沉淀规则。

### 判断标准（严格执行）

**需要沉淀 — 仅限项目级技术规范：**
- 公共组件的使用方式错误（如：el-dialog 内 Table 必须有 min-height 容器）
- 公共模块/能力的调用方式错误（如：API 请求必须走统一封装层）
- 参数传递错误（如：日期组件必须传 format="YYYY-MM-DD"）
- 代码风格/架构规范（如：状态管理必须使用 Pinia，禁止直接操作 localStorage）

**绝对不沉淀 — 业务逻辑：**
- 特定页面的功能需求（如：用户列表需要显示注册时间）
- 特定业务流程的实现（如：订单状态流转需要通知仓库）
- 一次性的数据处理逻辑

### 执行流程

1. 完成代码修复或方案确认后，判断修复方案是否属于上述"需要沉淀"的范围
2. 如果是，**必须询问用户**："这个偏差的修复方案属于项目级规范，沉淀为规则后可以防止同类问题复现。是否沉淀为项目规则？"
3. 用户同意后，如果已配置 AIDA MCP，则优先调用 `aida_record`，传入 `action="rule"`；否则调用 CLI `aida rules add`。两者都必须写入 `.aida/rules.json`，再通过 `aida build` 分发到各 AI 工具目录
   - content: 规则描述
   - category: 分类（可选值：component, api, style, i18n, architecture, state-management, routing, testing, process, general）
   - sourceDeviation: 可选；如果当前会话本身有偏差记录，可关联对应 ID

### 用户直接口述规则

如果用户明确口述一条应长期生效的项目级技术规范，也应按同样原则处理：
1. 判断它是否属于项目级技术规范，而不是业务逻辑
2. 如有歧义先确认
3. 确认后调用 `aida_record(action="rule")` 或 CLI `aida rules add` 写入 `.aida/rules.json`
4. 不要只把它写进某个 AI 工具自己的本地规则文件

### 阶段性回顾

完成一轮开发后，只需要回看两件事：
1. 当前需求是否已经正确沉淀到相关模块记忆和 `.aida/summary.json`
2. 是否形成了新的项目级技术规范需要进入 `.aida/rules.json`
