# AIDevOS - AI Development Observability Platform

# 产品需求文档 (PRD v2.0)

---

## 1. 产品定位

AIDevOS 是一个 **npm CLI 工具包**，通过向 Claude Code / Cursor 注入标准化的 Skill（SOP）指令来规范 AI 开发流程，同时将开发过程中产生的任务、Bug、AI 偏差、自检、规则沉淀等数据写入结构化的 `run.json`，最后通过本地 Dashboard 可视化呈现，并支持数据回放、报告生成、模型对比等高级功能。

**一句话**：Vibe coding with receipts — 让 AI 开发过程可量化、可追溯、可复盘。

### 1.1 核心理念：数据优先

Dashboard 只是数据的呈现方式之一。**核心是数据本身**。有了结构化的开发过程数据，可以支撑：
- 实时可视化（Dashboard）
- 开发过程回放（Timeline Replay）
- 周报/月报/绩效自动生成（Report Generation）
- AI 模型效能对比（Model Comparison）
- 跨周期偏差率趋势分析（Temporal Analysis）
- 团队开发效能总览（Team Visibility）

数据是基座，上层应用可以无限扩展。

---

## 2. 目标用户

- **个人开发者**：使用 Claude Code 或 Cursor 进行 AI 辅助开发，想量化 AI 做了什么、做得怎么样
- **技术 Leader**：想了解团队中每个人的 AI 开发效能，看整个项目的开发数据
- **关注 AI 效能的团队**：想评估不同 AI 模型在相同 SOP 和规则下的表现差异，做 token 成本优化决策

---

## 3. 核心问题

1. AI 写了大量代码，但没有工具记录 AI 到底做了什么、做对了多少
2. AI 犯的错（偏差）没有被结构化记录，无法沉淀为规则防止重复犯错
3. AI 开发过程缺乏标准流程，提示词写得好代码生成就准，写得不好就不准，质量参差不齐
4. 无法度量 AI 的生产效率和代码质量
5. 无法对比不同 AI 模型在相同规则和 SOP 下的实际表现
6. 开发者写周报/绩效时想不起来做了什么，AI 开发过程数据全部丢失

---

## 4. 产品架构

```
npx aidevos init
       |
       v
  交互式选择工具 (Claude / Cursor)
       |
       v
  生成 .aidevos/ 目录 + 复制 Skill 到对应工具位置
       |
       v
  用户在 IDE 中通过 /command 触发 Skill（AI 按 SOP 开发）
       |
       v
  Skill 执行过程中读写 run.json（单一数据源）
       |
       v
  aidevos dashboard  →  本地 Node server (watch run.json)  →  实时可视化
  aidevos status     →  CLI 终端输出
```

**关键理解**：AIDevOS 本身不执行 AI 编码，它通过注入 Skill 来「规范化」Claude 和 Cursor 的工作方式，是一个流程管理和数据采集层。

---

## 5. 功能范围

### 5.1 Phase 1 — 核心功能（已完成）

| 命令 | 功能 |
|------|------|
| `npx aidevos init` | 初始化项目（交互式选工具、复制 Skill、注入铁律） |
| `aidevos start` | 创建一次开发运行（run.json + prd.md + analysis.md） |
| `aidevos dashboard` | 启动本地可视化 Dashboard（SSE 实时推送） |
| `aidevos status` | CLI 中查看当前运行状态 |

### 5.2 Phase 2 — 数据可靠性 + 报告生成

| 功能 | 说明 |
|------|------|
| `aidevos log` | CLI 命令写入 run.json（带 schema 校验，替代 AI 直接编辑 JSON） |
| `/report` 快捷指令 | 读取 run.json 数据，按模板生成周报/月报/绩效报告 |

### 5.3 Phase 3 — Dashboard 增强

| 功能 | 说明 |
|------|------|
| Timeline Replay | 开发过程回放，按时间轴动画展示数据增长过程 |
| Model Comparison | 相同规则和 SOP 下，不同 AI 模型的偏差率对比 |
| Temporal Trends | 跨周期偏差率趋势（3月 vs 4月，规则沉淀后偏差是否下降） |
| Team Overview | 团队视图，按开发者聚合数据，Leader 查看全员效能 |

### 5.4 后续规划

| 功能 | 说明 |
|------|------|
| `aidevos compare` | CLI 命令对比两次 run 的数据 |
| 更多 AI 工具支持 | Windsurf、Trae 等 |
| 云端同步 | 可选的数据上传，支持远程 Dashboard |

---

## 6. 命令详细设计

### 6.1 `npx aidevos init`

#### 目标

让用户在现有项目中一键初始化 AIDevOS，生成目录结构并注入 Skill。

#### 交互流程

```
$ npx aidevos init

  AIDevOS - AI Development Observability Platform

? Select your AI tool: (Use arrow keys)
> Claude Code
  Cursor

Initializing AIDevOS...

  Created .aidevos/
  Created .aidevos/skills/          (14 skills)
  Created .aidevos/rules/           (with 3 iron rules)
  Created .aidevos/runs/
  Created .aidevos/templates/

  Copied skills to .claude/commands/   (or .cursor/skills/)
    - /workflow
    - /audit
    - /deviation
    - /self-reviewer
    - /rules-evolver

  Done! Next steps:
    1. Run /audit to generate project-specific rules
    2. Run aidevos start to begin a development run
    3. Run /workflow to start the AI development loop
```

#### 详细逻辑

**Step 1: 生成 .aidevos/ 目录结构**

```
.aidevos/
  config.json                   # 全局配置（aiTool + project）
  skills/                       # 14 个通用 Skill 定义（完整存储）
    workflow-orchestrator/SKILL.md
    requirement-analyzer/SKILL.md
    task-splitter/SKILL.md
    code-generator/SKILL.md
    self-reviewer/SKILL.md
    bug-fixer/SKILL.md
    deviation-recorder/SKILL.md
    dashboard-generator/SKILL.md
    commit-code/SKILL.md
    docx-to-markdown/SKILL.md
    mcp-reviewer/SKILL.md
    rules-evolver/SKILL.md
    dev-flower/SKILL.md
    audit/SKILL.md
  rules/                        # 项目规范（初始含三条铁律）
    iron-rules.md
  runs/                         # 开发运行实例数据（空，由 start 命令创建）
```

**Step 2: 交互式选择 AI 工具**

支持两种工具：
- **Claude Code**：复制 Skill 到 `.claude/commands/`
- **Cursor**：复制 Skill 到 `.cursor/skills/[skill_name]/SKILL.md`

**Step 3: Skill 注册策略**

只注册 **5 个快捷指令**，避免指令污染：

| 快捷指令 | 对应 Skill | 说明 |
|----------|-----------|------|
| `/workflow` | workflow-orchestrator | 流程编排器（内部自动调用其他原子 Skill） |
| `/audit` | audit | 项目审计，生成 rules |
| `/deviation` | deviation-recorder | 记录 AI 偏差 |
| `/self-reviewer` | self-reviewer | 手动触发质量自检 |
| `/rules-evolver` | rules-evolver | 规则演进 |

**编排器引用原子 Skill 的方式**：workflow-orchestrator 的 SKILL.md 中，在需要调用原子 Skill 的位置，通过文件路径引导 AI 读取：

```markdown
触发 requirement-analyzer：请读取 `.aidevos/skills/requirement-analyzer/SKILL.md` 并按其指令执行。
```

AI 直接读文件，没有额外开销，不污染快捷指令列表。

**Step 4: 写入三条铁律到 rules**

写入 `.aidevos/rules/iron-rules.md`：

```markdown
# Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
```

同时同步写入对应工具的规则文件：
- Claude Code：检查 `CLAUDE.md` 是否存在，有则追加（避免重复），无则创建
- Cursor：检查 `.cursorrules` 是否存在，有则追加（避免重复），无则创建

**Step 5: 生成 config.json**

```json
{
  "schemaVersion": "1.0",
  "aiTool": "claude-code",
  "project": "auto-detect-from-package.json-or-dirname"
}
```

精简设计，只记录两个有意义的字段：
- `aiTool`：后续 audit/rules-evolver 写规则时需要知道往哪个工具同步
- `project`：Dashboard 标题显示，自动从 package.json 的 name 字段或目录名获取

---

### 6.2 `aidevos start`

#### 目标

创建一次开发运行（run），初始化 run.json。

#### 逻辑

1. 获取当前 git 分支名作为 `run_id`：`git branch --show-current`
2. 获取开发者名称：`git config user.name`，转小写并用 `-` 替换空格
3. 检查 `.aidevos/runs/[branch_name]/[dev_name]/run.json` 是否已存在
   - **已存在**：提示 "Run already exists"，显示当前状态，不覆盖
   - **不存在**：创建目录 + 初始化 run.json

#### 初始化的文件

```
.aidevos/runs/[branch_name]/[dev_name]/
  run.json              # 运行数据（单一数据源）
  prd.md                # 占位，提示用户放置需求文档
  analysis.md           # 占位，由 requirement-analyzer 生成
```

只有 3 个文件，简洁干净：
- `run.json`：所有结构化数据的单一数据源（任务、Bug、偏差、自检、进度、上下文、时间线、规则沉淀）
- `prd.md`：用户输入的需求文档（自然语言）
- `analysis.md`：AI 生成的需求分析报告（长文本，不适合放 JSON）

#### run.json 初始值

```json
{
  "meta": {
    "schemaVersion": "1.0",
    "runId": "[branch_name]",
    "project": "[from config.json]",
    "developer": "[dev_name]",
    "branch": "[branch_name]",
    "aiModel": "",
    "aiTool": "[from config.json]",
    "startTime": "[ISO8601 now]",
    "endTime": null,
    "status": "running",
    "prdPhases": []
  },
  "summary": {
    "totalTasks": 0,
    "completedTasks": 0,
    "bugCount": 0,
    "deviationCount": 0,
    "reviewCount": 0,
    "reviewPassCount": 0,
    "reviewFailCount": 0,
    "rulesSedimented": 0,
    "prdPhaseCount": 0,
    "filesChanged": 0,
    "linesAdded": 0,
    "linesRemoved": 0
  },
  "workflow": [],
  "tasks": [],
  "bugs": [],
  "deviations": [],
  "reviews": [],
  "files": [],
  "metrics": {
    "aiDeviationRate": 0,
    "bugRate": 0,
    "reviewPassRate": 0,
    "firstPassRate": 0,
    "rulesSedimentedCount": 0,
    "deviationToRuleRatio": 0,
    "avgTaskTimeSeconds": 0,
    "totalDevelopmentTimeSeconds": 0
  },
  "timeline": [],
  "events": [],
  "rules": [],
  "context": {
    "currentPrdPhase": null,
    "currentTaskId": null,
    "currentStage": null,
    "lastUpdated": "[ISO8601 now]"
  },
  "extensions": {}
}
```

#### CLI 输出

```
$ aidevos start

  AIDevOS - New Development Run

  Run ID:     feature/my-feature
  Developer:  vito-long
  Branch:     feature/my-feature

  Created .aidevos/runs/feature-my-feature/vito-long/run.json

  Next: Place your PRD in the run directory, then run /workflow
```

---

### 6.3 `aidevos dashboard`

#### 目标

启动本地 Node HTTP server，提供实时 Web 可视化 Dashboard。

#### 逻辑

1. 读取 `.aidevos/config.json` 确认项目已初始化
2. 获取当前 git 分支名，确定默认展示的 run
3. 扫描 `.aidevos/runs/` 下所有 run.json
4. 启动 HTTP server，监听 `http://localhost:2375`
5. 使用 `fs.watch` 监听当前分支的 run.json，变化时通过 WebSocket 推送到前端实时更新

#### Dashboard 视图层级

Dashboard 有两个视图层级：

**视图一：项目总览（All Runs）**

展示所有 run 的聚合数据：
- 总任务数 / 总 Bug 数 / 总偏差数（跨 run 累计）
- 各 run 的对比卡片（run_id、状态、任务完成率、偏差数、开发时长）
- 点击某个 run 卡片 → 进入该 run 的详情视图

**视图二：单 Run 详情（默认视图，展示当前分支的 run）**

左上角有视图切换器：

```
[视图切换器]
  - feature/my-feature    ← 默认选中（当前分支）
  - All Runs              ← 项目总览
  - feature/other-one     ← 其他历史分支
  - fix/some-bug          ← 其他历史分支
```

单 Run 详情页内容：

**Header**
- 标题：AI Development Dashboard
- 项目名 | 分支名 | 开发者 | 开发周期 | 状态

**KPI 卡片行（6 列，可点击查看详情）**

| 卡片 | 数据来源 | 颜色 | 点击行为 |
|------|---------|------|---------|
| Tasks Completed | summary.completedTasks / summary.totalTasks | green | 弹窗：任务列表 Table |
| Stage Progress | workflow 中 completed 数 / workflow 总数 | blue | 弹窗：阶段进度 Table |
| Deviations | summary.deviationCount | orange | 弹窗：偏差详情 Table |
| Bugs Fixed | summary.bugCount | red | 弹窗：Bug 列表 Table |
| Review Pass Rate | summary.reviewPassCount / summary.reviewCount | purple | 弹窗：自检记录 Table |
| Files Changed | summary.filesChanged | cyan | 弹窗：文件变更列表 Table |

**弹窗详情设计**：
- 点击 KPI 卡片弹出 Modal 弹窗
- 弹窗内容为 Table 列表，展示该维度的详细数据
- 例如点击 "Tasks: 8/12" 弹出任务表：taskId | title | status | stageName | prdPhase
- 例如点击 "Deviations: 5" 弹出偏差表：deviationId | title | aiOutput | expectedOutput | rootCauseCategory | status
- 弹窗用纯 CSS + JS 实现，不引入额外 UI 框架

**图表区域**

| 图表 | 类型 | 数据源 |
|------|------|--------|
| 各阶段任务完成情况 | 水平柱状图 | tasks（按 stageName 分组） |
| AI 偏差根因分析 | 饼图 (donut) | deviations（按 rootCauseCategory 分组） |
| 偏差类别分布 | 水平柱状图 | deviations（按 deviationCategory 分组） |
| 文件修改热点 | 水平柱状图 | files（按出现次数排序） |
| 偏差与规则趋势 | 柱状图 + 折线图双轴 | deviations 数 + rules 累计数 |
| 开发时间线 | 时间线组件 | timeline |

#### 实时刷新机制

- Server 端使用 `fs.watch`（300ms debounce）监听 `.aidevos/runs/` 目录下的 run.json 文件变化
- 文件变化时通过 **SSE（Server-Sent Events）** 推送更新通知到前端
- 前端收到推送后自动重新拉取数据并更新 KPI、图表、表格，无需手动刷新
- 当 AI（Claude/Cursor）在执行 Skill 时写入 run.json，Dashboard 实时反映变化

#### 技术方案

- Node.js HTTP server（原生 http 模块，零依赖）
- SSE（`text/event-stream`）实现实时推送，无需 WebSocket 库
- 前端：单 HTML 页面 + ECharts（CDN）+ 原生 JS Modal 弹窗
- 深色主题：背景 `#0f1923`，卡片 `#162231`，边框 `#1e2d3d`，文字 `#e0e6ed`
- API 接口：
  - `GET /` — Dashboard HTML 页面
  - `GET /api/runs` — 返回所有 run 列表
  - `GET /api/runs/:branch/:dev` — 返回指定 run 的完整 run.json 数据
  - `GET /api/events` — SSE 端点，实时推送 run.json 变化通知
- 响应式布局（CSS Grid，breakpoints: 1200/900/600px）

#### CLI 输出

```
$ aidevos dashboard

  AIDevOS Dashboard

  Server running at http://localhost:2375
  Watching for changes...
  Press Ctrl+C to stop

  Found 2 runs:
    - feature/my-feature (running)  ← current
    - feature/another-one (completed)
```

---

### 6.4 `aidevos status`

#### 目标

在 CLI 终端中快速查看当前 run 的状态概览。

#### 逻辑

1. 获取当前 git 分支名
2. 获取当前开发者名称
3. 读取对应的 run.json
4. 格式化输出

#### CLI 输出

```
$ aidevos status

  AI Development Status

  Run ID:          feature/my-feature
  Developer:       vito-long
  Status:          running
  Current Stage:   coding (PRD2)
  Started:         2026-03-06 10:00

  -- Tasks ------------------------------------
  Completed:       8 / 12

  -- Bugs -------------------------------------
  Open:            2
  Fixed:           3

  -- Deviations -------------------------------
  Detected:        5
  Rules Sedimented: 2

  -- Reviews ----------------------------------
  Pass:            2
  Fail:            1

  -- Files Changed ----------------------------
  10 files

  -- Development Time -------------------------
  1h 20m
```

#### UX 要求

- CLI 输出必须美观，使用色彩库（如 chalk）
- 不同状态用不同颜色：completed=green, running=blue, failed=red
- 数据为空时显示占位（如 "No runs found. Run `aidevos start` first."）

---

### 6.5 `aidevos log` (Phase 2)

#### 目标

提供 CLI 命令写入 run.json，带 schema 校验，确保数据结构正确。替代 AI 直接编辑 JSON 文件，降低出错概率。

#### 子命令

```bash
aidevos log task --title "创建类型定义" --stage "基础设施" --prd-phase "PRD1"
aidevos log task-done --id TASK-01
aidevos log bug --title "API 返回格式错误" --severity high --source self-review
aidevos log bug-fix --id BUG-01 --fix "修改了响应解析逻辑"
aidevos log deviation --title "使用了错误的组件" --ai-output "用了 Dialog" --expected "应该用 Drawer" --root-cause rule-missing --category component-usage
aidevos log review --task-id TASK-01 --result pass --scope "src/components/"
aidevos log rule --content "弹窗场景统一使用 Drawer" --source-deviation DEV-01
aidevos log file --path "src/api/user.ts" --change-type modified --lines-added 50 --lines-removed 10
```

#### 技术方案

1. 读取当前分支 + 开发者 → 定位 run.json
2. 解析命令参数 → 构建 JSON 对象
3. **Schema 校验**：验证必填字段、枚举值、类型
4. **原子写入**：读取 → 追加/更新 → 写回（加文件锁避免并发冲突）
5. 自动更新 summary 统计
6. 自动追加 timeline[] 和 events[] 事件
7. 输出确认信息

#### Skill 中的使用方式

Skill 的 SKILL.md 中指导 AI：
```markdown
完成 Bug 修复后，执行以下命令记录：
aidevos log bug --title "简述" --severity high --source self-review
```

AI 只需要构造命令参数（字符串），CLI 内部负责 JSON 校验和写入，大幅降低数据出错风险。

---

### 6.6 `/report` 快捷指令 (Phase 2)

#### 目标

读取 run.json 数据，按用户提供的模板或内置模板，生成周报/月报/绩效报告。

#### 作为 Skill 实现

新增第 15 个 Skill：`report-generator`，注册为 `/report` 快捷指令。

#### 支持的报告类型

```bash
# 在 IDE 中触发
/report weekly          # 生成本周周报
/report monthly         # 生成本月月报
/report performance     # 生成绩效汇报材料
/report retrospective   # 生成项目复盘报告
```

#### 数据来源

从当前项目 `.aidevos/runs/` 下所有 run.json 聚合数据：

| 报告内容 | 数据来源 |
|---------|---------|
| 完成了哪些任务 | `tasks[].title` + `tasks[].status` |
| 修了多少 Bug | `bugs[]` |
| 发现并修复了多少偏差 | `deviations[]` |
| 沉淀了多少规则 | `rules[]` |
| 代码变更量 | `summary.filesChanged`, `summary.linesAdded/Removed` |
| 开发时长 | `meta.startTime` / `meta.endTime` |
| AI 模型使用 | `meta.aiModel` |
| 偏差率趋势 | `metrics.aiDeviationRate` 跨 run 对比 |

#### 输出格式

Markdown 文本，AI 根据模板填充数据后输出。用户可自定义模板放在 `.aidevos/templates/report-weekly.md` 等位置。

#### 示例输出（周报）

```markdown
# 周报 - 2026.03.06 ~ 2026.03.12

## 本周完成

- feature/user-management：完成用户管理模块开发
  - 8/12 任务完成，2 个 Bug 修复，3 条偏差记录
  - 沉淀 2 条规则到项目规范
  - AI 模型：Claude Sonnet 4，偏差率 25%

## 数据统计

| 指标 | 数值 |
|------|------|
| 完成任务 | 8 |
| Bug 修复 | 2 |
| 偏差记录 | 3 |
| 规则沉淀 | 2 |
| 文件变更 | 15 files (+680 / -120) |
| 开发时长 | 6h 30m |

## 下周计划

[由用户补充或 AI 根据剩余任务生成]
```

---

### 6.7 Dashboard 增强功能 (Phase 3)

#### 6.7.1 Timeline Replay（开发过程回放）

**场景**：一个需求开发了半个月，想直观看到数据是如何增长的。

**实现方案**：
- Dashboard 底部增加时间轴滑块控件
- 基于 `events[]` 和 `timeline[]` 的时间戳，按时间顺序回放
- 滑块滑动时，KPI 卡片数值逐步增长，图表数据逐步填充
- 支持播放/暂停/拖拽/倍速控制
- 核心：将 run.json 数据按时间戳切片，每个时间点展示截止到该时间点的累计数据

**技术方案**：
- 前端遍历 `events[]`，按 time 排序
- 播放时设置定时器，每帧推进一个事件
- 根据事件类型增量更新 KPI 和图表数据
- 不需要后端支持，纯前端逻辑

#### 6.7.2 Model Comparison（AI 模型对比）

**场景**：在相同的 rules 和 SOP 流程下，Claude Sonnet 4 和 GPT-4o 哪个偏差率更低？值不值得用更贵的模型？

**数据来源**：
- `meta.aiModel` 字段记录每个 run 使用的 AI 模型
- 跨 run 聚合相同项目、不同模型的数据

**Dashboard 视图**：
- 新增 "Model Comparison" 视图（在 All Runs 旁边）
- 对比维度：

| 对比维度 | 数据来源 |
|---------|---------|
| 偏差率 | deviationCount / totalTasks（按模型分组） |
| Bug 率 | bugCount / totalTasks（按模型分组） |
| 自检通过率 | reviewPassRate（按模型分组） |
| 平均任务耗时 | avgTaskTimeSeconds（按模型分组） |
| 首次通过率 | firstPassRate（按模型分组） |

- 图表：分组柱状图 / 雷达图（每个模型一条线）
- 结论区：自动计算哪个模型在哪个维度表现更好

**重要前提**：对比有意义的前提是 **相同的 rules 和 SOP**。AIDevOS 的标准化 Skill 流程正好提供了这个控制变量。

#### 6.7.3 Temporal Trends（跨周期趋势分析）

**场景**：3 月偏差率是 30%，持续沉淀规则后，4 月偏差率降到了 15%，规则沉淀真的有效吗？

**数据来源**：
- 跨 run 的 `metrics` 数据，按 `meta.startTime` 的月份/周分组
- `rules[]` 的累计增长趋势

**Dashboard 视图**：
- 新增 "Trends" 视图
- X 轴：时间（周/月）
- Y 轴：偏差率、Bug 率、自检通过率
- 叠加显示：rules 累计数量（折线图）
- 核心洞察：**规则越多 → 偏差率越低** 的正反馈循环是否成立

#### 6.7.4 Team Overview（团队视图）

**场景**：Leader 想看整个项目中每个开发者的 AI 开发效能。

**数据来源**：
- 跨 run 聚合，按 `meta.developer` 分组

**Dashboard 视图**：
- 新增 "Team" 视图
- 开发者列表：每人一行，显示总任务数、偏差率、规则沉淀数、开发时长
- 点击某开发者 → 展开该开发者的所有 run 列表
- 不做排名，只做数据展示（避免内卷导向）

---

## 7. Skill 体系设计

### 7.1 Skill 分层

```
编排层（1 个）
  └── workflow-orchestrator    串联所有原子 Skill，管控流程生命周期

核心原子层（6 个，由编排器自动调用）
  ├── docx-to-markdown         .docx → .md 转换
  ├── requirement-analyzer     PRD → analysis.md
  ├── task-splitter            analysis.md → run.json.tasks[]
  ├── code-generator           run.json.tasks[] → 业务代码
  ├── self-reviewer            代码 → run.json.reviews[]
  └── bug-fixer                review/bug → 修复代码 + run.json.bugs[]

辅助层（6 个，用户手动触发）
  ├── deviation-recorder       记录 AI 偏差 → run.json.deviations[]
  ├── report-generator         读取 run.json 数据生成周报/月报/绩效报告 (Phase 2)
  ├── dashboard-generator      （保留，本期 dashboard 由 CLI server 替代）
  ├── commit-code              git 提交流程
  ├── mcp-reviewer             高级安全/架构审计
  └── rules-evolver            规则维护和演进

元层（2 个）
  ├── dev-flower               （保留，本期由 CLI init 替代）
  └── audit                    项目审计，生成贴合项目的 rules
```

### 7.2 快捷指令注册（6 个）

| 注册指令 | Skill | 角色 |
|----------|-------|------|
| `/workflow` | workflow-orchestrator | 启动/恢复完整开发流程 |
| `/audit` | audit | 扫描项目生成 rules |
| `/deviation` | deviation-recorder | 记录 AI 偏差 |
| `/self-reviewer` | self-reviewer | 手动触发质量自检 |
| `/rules-evolver` | rules-evolver | 沉淀/更新规则 |
| `/report` | report-generator | 生成周报/月报/绩效报告 (Phase 2) |

### 7.3 Skill 与工具的映射

**Claude Code**

快捷指令复制到 `.claude/commands/[command-name].md`。

```
.claude/commands/workflow.md         ← workflow-orchestrator SKILL.md
.claude/commands/audit.md            ← audit SKILL.md
.claude/commands/deviation.md        ← deviation-recorder SKILL.md
.claude/commands/self-reviewer.md    ← self-reviewer SKILL.md
.claude/commands/rules-evolver.md    ← rules-evolver SKILL.md
```

**Cursor**

快捷指令复制到 `.cursor/skills/[skill-name]/SKILL.md`。

```
.cursor/skills/workflow/SKILL.md
.cursor/skills/audit/SKILL.md
.cursor/skills/deviation/SKILL.md
.cursor/skills/self-reviewer/SKILL.md
.cursor/skills/rules-evolver/SKILL.md
```

编排器内部调用原子 Skill 的方式：在 SKILL.md 中通过路径引导 AI 读取 `.aidevos/skills/[skill-name]/SKILL.md`。

### 7.4 workflow-orchestrator 编排逻辑

这是核心 Skill，串联整个 AI 开发流程。所有流程数据读写都操作 run.json。

```
Step 0: 初始化与需求接入
  ├── 检查 run 目录下 prd.md / prd.docx 是否存在
  ├── .docx 存在且无 .md → 读取 docx-to-markdown Skill 并执行
  ├── 比对 prd.md 与 analysis.md
  │   ├── 有新增内容 → 读取 requirement-analyzer Skill 并执行
  │   └── 无新增 → 读取 run.json.context 恢复进度
  └── run.json.meta.status == "completed" → 提示已闭环

Step 1: 加载上下文
  └── 读取 run.json.context → 判断中断恢复点

Step 2: 生成任务清单
  ├── analysis.md 存在 + run.json.tasks 为空
  ├── 读取 task-splitter Skill 并执行 → 写入 run.json.tasks[]
  └── 暂停，请求用户确认任务清单

Step 3: 核心执行循环
  ├── A: 读取 code-generator Skill 并执行 → 写代码（第一个 status=pending 的 task）
  ├── B: 更新 run.json.tasks[] 中对应 task 的 status 为 completed
  ├── C: 读取 self-reviewer Skill 并执行 → 写入 run.json.reviews[]
  └── D: result=fail → 读取 bug-fixer Skill 并执行 → 回到 C
       result=pass → 下一个任务

Step 4: 保存进度
  └── 每完成一个子任务 → 更新 run.json.context + run.json.summary

Step 5: 结束
  └── 全部完成 → 更新 run.json.meta.status = "completed" + run.json.meta.endTime
```

支持中断恢复：基于 `run.json.context` 中记录的 currentTaskId 和 currentStage，下次调用时从中断点继续。

### 7.5 Skill 读写 run.json 的规范

每个 Skill 在 SKILL.md 中明确约束其对 run.json 的读写权限：

| Skill | 读取字段 | 写入字段 |
|-------|---------|---------|
| workflow-orchestrator | 全部 | `meta.status`, `context`, `workflow[]`, `summary`, `timeline[]`, `events[]` |
| requirement-analyzer | `meta` | 无（输出到 analysis.md） |
| task-splitter | 无（读 analysis.md） | `tasks[]`, `summary.totalTasks`, `events[]` |
| code-generator | `tasks[]`, `context` | `tasks[].status`, `files[]`, `summary.completedTasks`, `events[]` |
| self-reviewer | `tasks[]` | `reviews[]`, `summary.reviewCount/reviewPassCount/reviewFailCount`, `events[]` |
| bug-fixer | `reviews[]` | `bugs[]`, `summary.bugCount`, `events[]` |
| deviation-recorder | `meta` | `deviations[]`, `rules[]`, `summary.deviationCount/rulesSedimented`, `events[]` |
| commit-code | `meta` | 无（执行 git 操作） |

每个 Skill 的 SKILL.md 中包含：
1. 明确的 JSON 路径（如 "向 `run.json` 的 `bugs` 数组末尾追加"）
2. 完整的 JSON 片段示例（AI 照着填值）
3. 禁止修改不相关字段的约束

### 7.6 audit Skill 特殊说明

`/audit` 执行后：
1. 扫描项目代码，生成项目级技术规则
2. 输出到 `.aidevos/audit-output/`（草案，等用户确认）
3. 用户确认后写入 `.aidevos/rules/`
4. 根据 `config.json` 中的 `aiTool`，同步规则到对应工具位置：
   - Claude Code → 追加到 `CLAUDE.md`
   - Cursor → 追加到 `.cursorrules` 或 `.cursor/rules/`

---

## 8. 数据模型

### 8.1 数据文件设计（精简）

每个 run 目录下只有 3 个文件：

```
.aidevos/runs/[branch_name]/[dev_name]/
  run.json              # 单一数据源：所有结构化数据
  prd.md                # 需求文档（用户输入，自然语言）
  analysis.md           # 需求分析报告（AI 生成，长文本）
```

**设计原则**：
- `run.json` 是唯一的结构化数据源，Dashboard 和 status 命令只读 run.json
- `prd.md` 和 `analysis.md` 保留为 .md 文件，因为它们是长篇自然语言文本，不适合放入 JSON
- 不再使用 task.md / bugTask.md / deviationTask.md / review.md / context.md / process.md 等独立文件
- 所有结构化数据（任务、Bug、偏差、自检、进度、上下文）全部在 run.json 中维护
- 想看具体详情可以通过 Dashboard 的交互式弹窗查看

### 8.2 run.json Schema (v1)

```
run.json
├── meta           # 运行元信息
│   ├── schemaVersion    string     "1.0"
│   ├── runId            string     分支名
│   ├── project          string     项目名
│   ├── developer        string     开发者
│   ├── branch           string     git 分支
│   ├── aiModel          string     AI 模型（如 "claude-sonnet-4", "gpt-4o"，由 Skill 执行时写入或 start --model 指定）
│   ├── aiTool           string     "claude-code" | "cursor"
│   ├── startTime        ISO8601    运行开始时间
│   ├── endTime          ISO8601?   运行结束时间
│   ├── status           enum       "running" | "paused" | "completed"
│   └── prdPhases        string[]   PRD 迭代阶段列表
│
├── summary        # Dashboard 快速统计
│   ├── totalTasks          number
│   ├── completedTasks      number
│   ├── bugCount            number
│   ├── deviationCount      number
│   ├── reviewCount         number
│   ├── reviewPassCount     number
│   ├── reviewFailCount     number
│   ├── rulesSedimented     number
│   ├── prdPhaseCount       number
│   ├── filesChanged        number
│   ├── linesAdded          number
│   └── linesRemoved        number
│
├── workflow[]     # SOP 阶段执行记录
│   ├── stage         enum       见 WorkflowStage 枚举
│   ├── prdPhase      string     "PRD1" | "PRD2" | ...
│   ├── status        enum       "pending" | "in_progress" | "completed"
│   ├── startTime     ISO8601
│   └── endTime       ISO8601?
│
├── tasks[]        # 任务列表
│   ├── taskId         string     "TASK-1.1"
│   ├── title          string
│   ├── description    string
│   ├── status         enum       "pending" | "in_progress" | "completed" | "blocked"
│   ├── stageIndex     number     阶段序号
│   ├── stageName      string     阶段名称
│   ├── prdPhase       string
│   ├── acceptance     string     验收标准
│   ├── createdAt      ISO8601
│   ├── startedAt      ISO8601?
│   ├── completedAt    ISO8601?
│   └── files          string[]
│
├── bugs[]         # Bug 记录
│   ├── bugId          string     "BUG-001"
│   ├── title          string
│   ├── description    string
│   ├── severity       enum       "critical" | "high" | "medium" | "low"
│   ├── source         enum       "self_review" | "user_feedback" | "mcp_review" | "testing"
│   ├── status         enum       "open" | "fixed"
│   ├── prdPhase       string
│   ├── reportedAt     ISO8601
│   ├── fixedAt        ISO8601?
│   ├── fix            string     修复方案描述
│   ├── files          string[]
│   ├── relatedTask    string?
│   └── ruleSedimented string?    沉淀的规则文件路径
│
├── deviations[]   # AI 偏差记录（核心差异化数据）
│   ├── deviationId         string     "DEV-001"
│   ├── title               string
│   ├── aiOutput            string     AI 实际产出
│   ├── expectedOutput      string     用户期望
│   ├── rootCause           string     根因分析
│   ├── rootCauseCategory   enum       见 DeviationRootCause 枚举
│   ├── deviationCategory   enum       见 DeviationCategory 枚举
│   ├── severity            enum       "critical" | "high" | "medium" | "low"
│   ├── prdPhase            string
│   ├── status              enum       "open" | "resolved"
│   ├── detectedAt          ISO8601
│   ├── resolvedAt          ISO8601?
│   ├── files               string[]
│   └── ruleSedimented      object?    { file: string, content: string }
│
├── reviews[]      # 自检记录
│   ├── reviewId      string     "REV-001"
│   ├── type          enum       "self-review" | "mcp-review" | "human-review"
│   ├── scope         string     审查范围描述
│   ├── prdPhase      string
│   ├── result        enum       "pass" | "fail"
│   ├── reviewedAt    ISO8601
│   ├── dimensions[]             检查维度列表
│   │   ├── name       string
│   │   ├── result     enum      "pass" | "fail" | "warn"
│   │   └── issues     number?
│   └── issueList[]              问题列表
│       ├── issueId    string
│       ├── severity   enum      "critical" | "warn" | "info"
│       ├── file       string
│       ├── description string
│       └── fix        string
│
├── files[]        # 文件修改统计
│   ├── path           string
│   ├── changeType     enum       "created" | "modified" | "deleted"
│   ├── linesAdded     number
│   ├── linesRemoved   number
│   └── relatedTo      string[]   关联的 taskId / bugId / deviationId
│
├── metrics        # AI 开发质量指标
│   ├── aiDeviationRate          number    偏差数 / 任务数
│   ├── bugRate                  number    Bug 数 / 任务数
│   ├── reviewPassRate           number    通过数 / 自检总数
│   ├── firstPassRate            number    首次通过数 / 总阶段数
│   ├── rulesSedimentedCount     number    沉淀规则数
│   ├── deviationToRuleRatio     number    规则数 / 偏差数
│   ├── avgTaskTimeSeconds       number
│   └── totalDevelopmentTimeSeconds number
│
├── timeline[]     # 时间线（可视化用）
│   ├── event      string     事件类型
│   ├── time       ISO8601
│   ├── prdPhase   string
│   └── detail     string     事件描述
│
├── events[]       # 完整事件流（审计级日志）
│   ├── type       enum       见 EventType 枚举
│   ├── time       ISO8601
│   └── data       object     事件数据
│
├── rules[]        # 沉淀规则追踪
│   ├── ruleId           string     "RULE-001"
│   ├── file             string     规则文件路径
│   ├── content          string     规则内容
│   ├── sourceDeviation  string     来源偏差 ID
│   └── sedimentedAt     ISO8601
│
├── context        # 工作流恢复点
│   ├── currentPrdPhase  string?
│   ├── currentTaskId    string?
│   ├── currentStage     string?
│   └── lastUpdated      ISO8601
│
└── extensions     # 扩展字段
    {}
```

### 8.3 核心枚举值

| 枚举 | 值 |
|------|----|
| RunStatus | `running`, `paused`, `completed` |
| WorkflowStage | `document_conversion`, `analysis`, `task_decomposition`, `coding`, `review`, `bug_fix`, `build_verification`, `completed` |
| TaskStatus | `pending`, `in_progress`, `completed`, `blocked` |
| BugSeverity | `critical`, `high`, `medium`, `low` |
| BugSource | `self_review`, `user_feedback`, `mcp_review`, `testing` |
| BugStatus | `open`, `fixed` |
| ReviewType | `self-review`, `mcp-review`, `human-review` |
| ReviewResult | `pass`, `fail` |
| IssueSeverity | `critical`, `warn`, `info` |
| DeviationStatus | `open`, `resolved` |
| DeviationRootCause | `rule_missing`, `context_insufficient`, `ai_hallucination`, `reference_copy_blindly`, `spacing_judgment_error`, `requirement_misunderstanding`, `multi_round_not_converge`, `process_omission`, `other` |
| DeviationCategory | `ui_spacing`, `layout_structure`, `component_usage`, `i18n_requirement`, `cache_flow`, `process_omission`, `other` |
| FileChangeType | `created`, `modified`, `deleted` |
| EventType | `task_created`, `task_completed`, `bug_created`, `bug_fixed`, `deviation_created`, `deviation_resolved`, `review_created`, `rule_sedimented`, `workflow_stage_changed`, `build_verified` |

---

## 9. 技术方案

### 9.1 技术栈

| 层级 | 技术选型 |
|------|---------|
| CLI | Node.js + TypeScript（ESM，零运行时依赖） |
| CLI 交互 | 原生 readline（无外部依赖） |
| CLI 美化 | ANSI escape codes（无外部依赖） |
| Dashboard Server | Node.js 原生 http 模块 |
| Dashboard 实时推送 | SSE（Server-Sent Events，原生实现，无需 ws 库） |
| Dashboard 前端 | 单 HTML 页面 + ECharts（CDN）+ 原生 CSS/JS Modal |
| 数据存储 | JSON 文件（run.json） |
| 文件监听 | 原生 fs.watch（300ms debounce） |
| 包管理 | npm，支持 `npx aidevos` 执行 |

**设计原则**：零运行时外部依赖。所有功能使用 Node.js 原生模块实现。

### 9.2 项目结构（AIDevOS 自身的代码结构）

```
ai-dev-os/
  package.json
  tsconfig.json
  src/
    cli/
      index.ts              # CLI 入口（#!/usr/bin/env node），命令路由
      commands/
        init.ts             # init 命令（交互式、Skill 复制、铁律注入）
        start.ts            # start 命令（创建 run）
        dashboard.ts        # dashboard 命令（启动 server）
        status.ts           # status 命令（终端输出）
        log.ts              # log 命令（schema 校验写入 run.json）(Phase 2)
    server/
      index.ts              # Dashboard HTTP server + SSE + fs.watch
      api.ts                # REST API（getAllRuns, getRunData）
    dashboard/
      index.html            # Dashboard 单页面（ECharts + KPI + Modal + SSE）
    assets/
      skills/               # 14 个 Skill 的 SKILL.md 源文件
        workflow-orchestrator.md
        requirement-analyzer.md
        task-splitter.md
        code-generator.md
        self-reviewer.md
        bug-fixer.md
        deviation-recorder.md
        dashboard-generator.md
        commit-code.md
        docx-to-markdown.md
        mcp-reviewer.md
        rules-evolver.md
        dev-flower.md
        audit.md
      templates/             # 模板文件
        run.json             # run.json 初始模板
    utils/
      paths.ts              # 路径常量和解析
      git.ts                # git 操作工具函数
      fs.ts                 # 文件系统工具函数
      display.ts            # ANSI 颜色输出工具函数
  dist/                     # TypeScript 编译输出
```

### 9.3 npm 包配置

```json
{
  "name": "aidevos",
  "bin": {
    "aidevos": "./bin/aidevos.js"
  }
}
```

支持：
- `npx aidevos init`（无需全局安装）
- `npx aidevos start / dashboard / status`

---

## 10. 三条铁律写入策略

### 10.1 写入 .aidevos/rules/iron-rules.md

```markdown
# Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
```

### 10.2 同步写入工具规则文件

**Claude Code**：
- 检查项目根目录是否有 `CLAUDE.md`
  - 有：在文件末尾追加铁律（先检查是否已包含，避免重复）
  - 无：创建 `CLAUDE.md`，写入铁律

**Cursor**：
- 检查项目根目录是否有 `.cursorrules`
  - 有：在文件末尾追加铁律（先检查是否已包含，避免重复）
  - 无：创建 `.cursorrules`，写入铁律

---

## 11. CLI UX 规范

### 11.1 设计原则

- CLI 输出必须美观
- 使用颜色区分信息层级：标题=bold, 成功=green, 警告=yellow, 错误=red, 数据=cyan
- 使用 box drawing 字符分隔区域
- 加载过程使用 spinner 动画
- 空状态必须有友好提示

### 11.2 错误处理

| 场景 | 提示 |
|------|------|
| 未初始化就执行 start/dashboard/status | "AIDevOS not initialized. Run `npx aidevos init` first." |
| 不在 git 仓库中执行 start | "Not a git repository. AIDevOS requires git." |
| dashboard 端口被占用 | "Port 2375 is already in use. Use --port to specify another port." |
| run.json 不存在执行 status | "No active run found. Run `aidevos start` first." |

---

## 12. 验收标准

### 12.1 `npx aidevos init`

- [ ] 交互式选择 AI 工具（Claude Code / Cursor）
- [ ] 生成完整的 `.aidevos/` 目录结构（skills/ + rules/ + runs/）
- [ ] 14 个 Skill 文件正确写入 `.aidevos/skills/`
- [ ] 5 个快捷指令正确复制到对应工具目录
- [ ] 三条铁律写入 `.aidevos/rules/iron-rules.md`
- [ ] 三条铁律同步写入工具规则文件（CLAUDE.md / .cursorrules），不重复
- [ ] config.json 正确生成（aiTool + project）
- [ ] CLI 输出美观、信息完整

### 12.2 `aidevos start`

- [ ] 正确获取 git 分支名和用户名
- [ ] 创建 run 目录、run.json、prd.md 占位、analysis.md 占位
- [ ] 已存在时不覆盖，提示已存在并显示当前状态
- [ ] CLI 输出美观

### 12.3 `aidevos dashboard`

- [ ] 启动 HTTP server 在 localhost:2375
- [ ] 默认展示当前分支的 run 数据
- [ ] 支持切换到项目总览视图（All Runs）
- [ ] 支持切换到任意历史 run 视图
- [ ] 6 个 KPI 卡片正确展示且可点击查看详情弹窗
- [ ] 弹窗内 Table 正确展示详细数据
- [ ] 所有图表正确渲染（柱状图、饼图、时间线）
- [ ] 深色主题
- [ ] 响应式布局
- [ ] SSE 实时推送，run.json 变化时自动更新
- [ ] 数据为空时有占位提示

### 12.4 `aidevos status`

- [ ] 正确读取当前 run 数据
- [ ] 格式化输出所有状态信息
- [ ] 颜色和排版美观
- [ ] 无 run 时友好提示

### 12.5 Skill 体系

- [ ] 14+ 个 Skill 的 SKILL.md 内容完整、去除项目特性、通用化
- [ ] 所有 Skill 的读写操作都指向 run.json，SKILL.md 中包含明确的 JSON 路径和示例
- [ ] workflow-orchestrator 通过文件路径正确引用其他原子 Skill
- [ ] /audit 执行后能生成项目级 rules 并同步到工具规则文件

### 12.6 `aidevos log` (Phase 2)

- [ ] 支持 task / task-done / bug / bug-fix / deviation / review / rule / file 子命令
- [ ] 每个子命令有 schema 校验（必填字段、枚举值、类型）
- [ ] 原子写入 run.json（读取 → 校验 → 追加/更新 → 写回）
- [ ] 自动更新 summary 统计
- [ ] 自动追加 timeline[] 和 events[]
- [ ] CLI 输出确认信息

### 12.7 `/report` (Phase 2)

- [ ] 支持 weekly / monthly / performance / retrospective 报告类型
- [ ] 正确聚合当前项目所有 run.json 数据
- [ ] 输出格式化的 Markdown 报告
- [ ] 支持用户自定义模板

### 12.8 Dashboard 增强 (Phase 3)

- [ ] Timeline Replay：播放/暂停/拖拽/倍速控制
- [ ] Model Comparison：分组柱状图对比偏差率、Bug 率、通过率
- [ ] Temporal Trends：跨周期偏差率趋势 + 规则累计折线
- [ ] Team Overview：按开发者聚合数据，Leader 可查看全员

---

## 13. 产品愿景与差异化

### 13.1 Why AIDevOS

| 对比维度 | 传统 AI Coding | AIDevOS |
|---------|---------------|---------|
| 过程记录 | 无（黑盒） | 全过程结构化数据 |
| 偏差管理 | 人脑记忆 | 结构化记录 + 规则沉淀 |
| 质量度量 | 无法量化 | 偏差率、Bug 率、通过率等指标 |
| 流程标准化 | 依赖个人 Prompt 能力 | 标准 SOP Skill，消除 Prompt 方差 |
| 模型评估 | "我觉得 Claude 更好" | 相同 SOP + Rules 下的数据对比 |
| 周报/绩效 | 回忆 + 编 | 数据自动聚合生成 |
| 规则进化 | 手动维护 | 偏差驱动自动沉淀，越用越准 |

### 13.2 核心价值主张

> **对开发者**：AI 帮你写代码，AIDevOS 帮你记账。你知道 AI 做了什么、做对了多少、哪里偏了。顺便帮你写周报和绩效。
>
> **对 Leader**：标准化 SOP 消除团队中"会用 AI"和"不会用 AI"的方差。数据看板让你知道每个人的 AI 开发效能。
>
> **对行业**：在相同规则和流程下，用数据说话，哪个模型更准、更经济。不再是主观感受，而是可量化的对比。

### 13.3 飞轮效应

```
使用 SOP 开发 → 产生结构化数据 → 发现偏差 → 沉淀规则
       ↑                                              ↓
       ←────── AI 下次更准确 ←──── 规则反哺 Skill ←──┘
```

规则越多 → 偏差越少 → AI 越准 → 开发效率越高 → 产生更多数据 → 沉淀更多规则

这是一个正向飞轮。用户用得越久，项目的 AI 开发质量越高，切换成本也越高。
