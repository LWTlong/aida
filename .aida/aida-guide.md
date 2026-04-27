# AIDA 数据采集与规则沉淀指南

> 此文件引导 AI 在开发过程中采集结构化数据并沉淀项目规则。由 AIDA 自动生成，请勿删除。
> **这是强制规范，不是可选建议。**

## 零、强制前置动作（严禁跳过）

**⚠️ 你正在读取本文件（aida-guide.md）。这是强制规范，严禁跳过任何步骤。**

**开始任何开发任务前，必须按顺序完成以下四步：**

1. **读取项目规则** → 优先读取当前 AI 工具目录下由 `aida build` 生成的规则文件（例如 `.claude/rules/aida/_all.md`、`.cursor/rules/aida/_all.md`、`.codex/rules/aida/_all.md`、`.lingma/rules/aida/_all.md`）；若当前工具目录不可用，则读取 `.aida/rules/_all.md` 这个可读视图；都不存在则跳过
2. **检查 AIDA MCP 与集中授权状态** → 若当前会话可调用 AIDA MCP，必须先调用 `aida_bootstrap`，传入 `action="status"` 检查当前宿主中的 AIDA MCP 是否可用；如果不可用，必须立即提示用户检查并启用/批准 AIDA MCP（例如 Cursor 中可能需要手动打开）；如果可用，再调用 `aida_bootstrap`，传入 `action="manifest"` 读取需要集中授权的工具清单，并明确告知用户“提前授权是为了避免后续开发过程中在 AIDA 数据采集或记忆恢复时被中断”；用户做出授权决定后，再调用 `aida_bootstrap`，传入 `action="complete"` 将本地 bootstrap 状态缓存到 `.aida/bootstrap-state.local.json`。**严禁跳过。**
3. **恢复模块上下文** → 如果已配置 AIDA MCP，优先调用聚合工具 `aida_memory`，传入 `action="search"` 检索当前需求对应模块，再调用 `aida_memory`，传入 `action="pack"`，或使用 `action="get"` / `action="context-get"` 读取命中的模块记忆与当前分支上下文；如果当前分支上下文缺失，先调用 `aida_memory`，传入 `action="context-rebuild"`；若未配置 MCP，则优先读取 JSON 源数据：`.aida/memories/index.json`、`.aida/memories/modules/*.json`、`.aida/runs/*/requirement.json`、`.aida/runs/*/context.json`；如需可读视图，再读取由 `aida memory build` / `aida memory rebuild` 生成的 `.aida/memories/modules/*.md`、`.aida/runs/*/context.md`、`.aida/runs/*/memory.md`
4. **执行数据采集流程** → 严格按照第一节规定的顺序调用 MCP 工具：优先使用聚合工具 `aida_task(action="start")` → `aida_record(action="files")` → `aida_record(action="review")` → `aida_task(action="done")`

不得以任何理由跳过上述步骤。若 `aida_memory(action="search")` 没有命中模块记忆，可退回正常代码分析流程，但必须先完成检索动作。

**当用户直接口述要沉淀某条项目级技术规范，或你识别到 `rule-missing` 类型偏差需要沉淀规则时，不要只修改本地说明文件。若已配置 AIDA MCP，必须优先调用 `aida_record`，传入 `action="rule"` 写入 `.aida/rules.json`；若未配置 MCP，则使用 CLI `aida rules add` 写入 `.aida/rules.json`。**
**当需求推进后需要沉淀模块记忆或更新当前分支上下文时，若已配置 AIDA MCP，优先调用 `aida_memory`，传入 `action="upsert"` / `action="context-update"`；若未配置 MCP，则使用 CLI `aida memory upsert` / `aida memory context-update` 更新 JSON 源数据，再按需执行 `aida memory build` / `aida memory rebuild` 生成 `.md` 视图。不要直接手改生成的 `.md` 视图文件。**

## 一、数据采集

### 核心原则

每个任务的完整生命周期必须被记录。遗漏数据采集节点等于数据缺失，会导致看板和分析不准确。

### 单个任务的数据采集流程

每接到一个任务/功能/修改，必须按以下顺序调用：

1. **开始前** → 优先调用 `aida_task`，传入 `action="start"`、任务标题和所属模块
2. **编码完成后** → 优先调用 `aida_record`，传入 `action="files"`，自动扫描 git diff 记录文件变更（无需传参）
3. **自检代码** → 对照项目规范审查自己的产出，优先调用 `aida_record`，传入 `action="review"` 记录审查结果（pass/fail + 问题列表）
4. **任务完成** → 优先调用 `aida_task`，传入 `action="done"` 和任务 ID

### 过程中的事件记录

在开发过程中遇到以下情况时，必须立即记录：

- **发现 Bug** → 优先调用 `aida_record`，传入 `action="bug"`，再传入描述和严重程度（critical/high/medium/low）
- **修复 Bug** → 优先调用 `aida_record`，传入 `action="bug-fix"`、Bug ID 和修复方案
- **用户指出偏差**（AI 产出与用户预期不符） → 优先调用 `aida_record`，传入 `action="deviation"`、偏差描述、根因分类（rootCause）和偏差类别（category）
- **值得记录的亮点**（如性能优化、架构改进） → 优先调用 `aida_record`，传入 `action="highlight"`

### rootCause 和 category 参数说明

`aida_record(action="deviation")` 的 rootCause 可选值：
- `rule-missing`：项目规范中缺少对应规则
- `hallucination`：AI 臆想了不存在的 API/组件/用法
- `context-insufficient`：上下文信息不足导致产出偏差
- `misunderstanding`：AI 理解错了用户意图
- `reference-copy`：AI 照搬了参考代码但不适用
- `process-omission`：AI 跳过了必要的步骤
- `other`：其他原因

category 可选值：
- `ui-spacing`, `layout`, `component-usage`, `i18n`, `api`, `logic`, `architecture`, `style`, `other`

### 多任务场景

如果一次需求包含多个子任务，每个子任务都必须单独调用 `aida_task(action="start")` 和 `aida_task(action="done")`。`aida_record(action="files")` 可以在每个任务完成后调用，也可以在一批任务完成后统一调用一次。

### 查看当前状态

随时可以调用 `aida_record(action="status")` 或 `aida_status` 查看当前的任务列表、Bug 数量、进度等信息。

## 二、规则沉淀

当通过 `aida_record(action="deviation")` 记录偏差，且 rootCause 为 `rule-missing` 时，必须评估是否需要沉淀规则。

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

1. 修复偏差代码后，判断修复方案是否属于上述"需要沉淀"的范围
2. 如果是，**必须询问用户**："这个偏差的修复方案属于项目级规范，沉淀为规则后可以防止同类问题复现。是否沉淀为项目规则？"
3. 用户同意后，如果已配置 AIDA MCP，则优先调用 `aida_record`，传入 `action="rule"`；否则调用 CLI `aida rules add`。两者都必须写入 `.aida/rules.json`，再通过 `aida build` 分发到各 AI 工具目录
   - content: 规则描述
   - category: 分类（可选值：component, api, style, i18n, architecture, state-management, routing, testing, process, general）
   - sourceDeviation: 关联的偏差 ID（如 DEV-01）

### 用户直接口述规则

如果用户明确口述一条应长期生效的项目级技术规范，也应按同样原则处理：
1. 判断它是否属于项目级技术规范，而不是业务逻辑
2. 如有歧义先确认
3. 确认后调用 `aida_record(action="rule")` 或 CLI `aida rules add` 写入 `.aida/rules.json`
4. 不要只把它写进某个 AI 工具自己的本地规则文件

### 阶段性回顾

完成一轮开发（多个任务完成）后：
1. 调用 `aida_record(action="status")` 或 `aida_status` 查看当前偏差情况
2. 检查是否有 rootCause 为 `rule-missing` 的偏差尚未沉淀对应规则
3. 如果有，汇总这些偏差模式并询问用户是否需要批量沉淀
