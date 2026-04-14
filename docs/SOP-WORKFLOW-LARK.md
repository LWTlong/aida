# AIDevOS SOP 工作流程完整说明

> Historical workflow reference. For the current public CLI and `.aida` asset flow, use [README.md](../README.md) and [COMMANDS.md](../COMMANDS.md) as the canonical docs.

**文档版本：** v1.0
**最后更新：** 2026-03-13

---

## 核心流程文件清单

### 主流程文件（按执行顺序）

| # | 文件路径 | 角色 | 触发方式 |
|---|---------|------|---------|
| 1 | `src/assets/skills/workflow-orchestrator.md` | 流程编排器 | 用户调用 `/workflow` |
| 2 | `src/assets/skills/requirement-analyzer.md` | 需求分析器 | workflow 自动调用 |
| 3 | `src/assets/skills/task-splitter.md` | 任务拆分器 | workflow 自动调用 |
| 4 | `src/assets/skills/code-generator.md` | 代码生成器 | workflow 循环调用 |
| 5 | `src/assets/skills/self-reviewer.md` | 质量自检员 | workflow 循环调用 |
| 6 | `src/assets/skills/bug-fixer.md` | 缺陷修复器 | 自检不通过时调用 |

### 辅助工具文件

| # | 文件路径 | 角色 | 触发方式 |
|---|---------|------|---------|
| 7 | `src/assets/skills/deviation-recorder.md` | 偏差记录器 | 用户手动调用 `/deviation` |
| 8 | `src/assets/skills/rules-evolver.md` | 规则进化器 | 用户手动调用 |
| 9 | `src/assets/skills/docx-to-markdown.md` | DOCX 转换器 | workflow 自动检测 |

### 数据结构定义

| # | 文件路径 | 说明 |
|---|---------|------|
| 10 | `src/schemas/run-json.ts` | run.json 数据结构定义（唯一数据源） |
| 11 | `src/cli/commands/log.ts` | CLI 数据写入命令实现 |
| 12 | `dashboard/src/types.ts` | Dashboard 类型定义（重新导出 schemas） |

---

## 完整工作流程

> 流程图见下方「文本绘图」区块，可直接粘贴到飞书文档的「绘图」模块中。

### 阶段总览

1. **文件接入阶段** - 检测并转换 PRD 和接口文档（支持 .md / .docx）
2. **流程编排** - workflow-orchestrator 初始化 run.json，识别 PRD 阶段
3. **需求分析** - requirement-analyzer 生成 analysis.md
4. **需求确认**（关键控制点 #1）- 用户必须确认需求理解正确
5. **任务拆分** - task-splitter 拆分为原子任务
6. **任务执行循环** - code-generator + self-reviewer 循环
7. **缺陷修复** - bug-fixer（自检不通过时触发）
8. **偏差记录** - deviation-recorder（用户验证阶段触发）

### 接口文档支持

workflow-orchestrator 自动检测以下接口文档（可选，后续追加）：
- `api.md` / `api.docx`
- `interface.md` / `interface.docx`
- 接口文档.md / 接口文档.docx
- 或其他包含 api / interface / 接口 关键词的文档

如发现 `.docx` 格式，自动转换为 `.md`。

---

## 三大关键控制点

### 第1关：需求理解确认（最重要）

**位置：** workflow-orchestrator.md - Step 1

**工程控制论原理：**
- 需求理解是系统性能的决定性因素
- 需求错误会导致后续所有环节全部偏离
- 成本最低的纠错点

**铁律：**
1. requirement-analyzer 生成 analysis.md 后**必须暂停**
2. 输出需求理解要点摘要
3. **只有用户明确回复确认才能继续**
4. **禁止跳过此步骤**
5. 用户提出修正 → 修改 analysis.md → 重新确认

**必须写入的数据：**
```json
// context
{ "currentStage": "requirement-confirmed" }

// timeline
{ "type": "requirement-confirmed", "title": "需求理解已确认", "timestamp": "...", "prdPhase": "PRD1" }

// workflow
{ "stage": "需求分析", "prdPhase": "PRD1", "status": "completed", "endTime": "..." }
```

---

### 第2关：任务执行循环

**位置：** workflow-orchestrator.md - Step 3

**流程：**
1. code-generator 编写代码
2. 强制记录文件变更（每个修改的文件都要记录）
3. 标记任务完成
4. self-reviewer 质量自检
5. 通过 → 下一个任务；不通过 → bug-fixer 修复 → 重新自检

**检查清单：**
- 所有新建/修改/删除的文件都已记录
- 行数统计准确（从 git diff 或编辑器获取）
- 任务状态已标记完成
- 自检结果已记录

---

### 第3关：偏差记录与规则沉淀

**位置：** deviation-recorder.md - Step 5

**判断标准：** 是技术规范还是业务逻辑？

| 技术规范（需要沉淀） | 业务逻辑（不沉淀） |
|-------------------|-----------------|
| 组件使用规范 | 特定功能需求 |
| API 封装规范 | 业务流程定制 |
| 代码规范约束 | 业务逻辑实现 |
| 公共能力使用 | 功能定制方案 |

**技术规范示例：**
- el-dialog 内 Table 需要 min-height
- Table columns 必须放在 computed 中
- API 请求必须走统一封装
- 公共组件 props 使用规范

**业务逻辑示例：**
- 用户列表需要显示注册时间
- 订单详情需要增加物流信息
- 某表单需要特定校验规则

**流程：** rootCause = rule-missing → 判断性质 → 技术规范则创建 pending 规则 → 正式沉淀到 .aida/rules/*.md

---

## 数据契约说明

### 单一数据源（Single Source of Truth）

**Schema 定义位置：** `src/schemas/run-json.ts`

所有模块都从这里导入类型定义：
- CLI (`src/cli/commands/log.ts`) - 数据写入
- Dashboard (`dashboard/src/types.ts`) - 数据展示

**字段命名规范：**
- ID 字段：`taskId`, `bugId`, `deviationId`, `reviewId`, `ruleId`
- 时间字段：`reportedAt`, `detectedAt`, `reviewedAt`, `sedimentedAt`, `fixedAt`
- 枚举值：kebab-case (`rule-missing`, `component-usage`, `self-review`)

### run.json 核心结构（14个顶级字段）

```typescript
{
  meta: RunMeta              // 元数据（runId, branch, developer, prdPhases[]）
  summary: RunSummaryData    // 汇总统计
  metrics: RunMetrics        // 计算指标
  context: RunContext        // 执行上下文（currentStage, currentTaskId）
  tasks: TaskItem[]          // 任务清单
  deviations: DeviationItem[] // 偏差记录
  bugs: BugItem[]            // Bug 记录
  reviews: ReviewItem[]      // 自检记录
  rules: RuleItem[]          // 规则沉淀
  files: FileItem[]          // 文件变更
  timeline: TimelineItem[]   // 时间线事件
  workflow: WorkflowStage[]  // 工作流阶段
  events: EventItem[]        // 系统事件
}
```

---

## CLI 命令速查

### 初始化与更新
```bash
aida init        # 初始化项目
aida update      # 更新 skills 到最新版本
aida migrate     # 迁移旧数据到新 schema
```

### 工作流命令
```bash
aida start       # 创建新的 run
aida status      # 查看当前状态
aida dashboard   # 启动可视化面板
```

### 数据记录命令
```bash
# 任务
aida log task --title "..." --stage "..." --prd-phase "PRD1" --acceptance "..."
aida log task-done --id TASK-XX

# Bug
aida log bug --title "..." --severity high --source self-review --task TASK-XX
aida log bug-fix --id BUG-XX --fix "..."

# 偏差
aida log deviation --title "..." --root-cause rule-missing --category component-usage --ai-output "..." --expected "..." --files "..."

# 自检
aida log review --task-id TASK-XX --result pass --scope "..." --issues 0

# 规则
aida log rule --content "..." --source-deviation DEV-XX --status pending
aida log rule --content "..." --source-deviation DEV-XX --file ".aida/rules/xxx.md"

# 文件变更
aida log file --path "..." --change-type modified --lines-added 50 --lines-removed 10
```

---

## 项目目录结构

```
.aida/
├── config.json                 # 配置文件
├── rules/                      # 项目规范
│   ├── component-usage.md
│   ├── api-patterns.md
│   └── ...
├── skills/                     # Skill 副本（用户可本地修改）
│   ├── workflow-orchestrator/
│   │   └── SKILL.md
│   └── ...
└── runs/                       # 运行数据
    └── [run_id]/
        └── [dev_name]/
            ├── prd.md          # 需求文档
            ├── prd.docx        # 原始 Word 文档（如有）
            ├── api.md          # 接口文档（可选，后续追加）
            ├── interface.md    # 或其他名称的接口文档
            ├── 接口文档.md      # 支持中文文件名
            ├── analysis.md     # 分析报告
            └── run.json        # 数据记录（唯一数据源）
```

**接口文档说明：**
- 接口文档为**可选**，通常在后续阶段追加
- 支持多种文件名：`api`、`interface`、`接口文档` 等
- 支持格式：`.md` 或 `.docx`（自动转换）
- workflow 会自动检测并转换，供后续分析和代码生成使用

---

## 工程控制论原则

### 1. 系统性能不取决于最强环节

**结论：** 需求理解确认是最重要的控制点

需求错误的成本：
- 分析阶段纠错：成本 = 1
- 开发阶段纠错：成本 = 10
- 测试阶段纠错：成本 = 100

### 2. 协同效率决定整体性能

**结论：** 数据契约必须统一

- 单一 Schema 定义（`src/schemas/run-json.ts`）
- TypeScript 编译时强制检查
- 所有模块从同一来源导入

### 3. 反馈循环加速优化

**结论：** 偏差记录驱动规则进化

偏差发现 → 规则沉淀 → 规范约束 → 减少偏差 → 持续优化（循环）

---

## 校对检查清单

**核心流程文件（6个）：**
- [ ] workflow-orchestrator.md - 流程编排
- [ ] requirement-analyzer.md - 需求分析
- [ ] task-splitter.md - 任务拆分
- [ ] code-generator.md - 代码生成
- [ ] self-reviewer.md - 质量自检
- [ ] bug-fixer.md - 缺陷修复

**辅助工具文件（3个）：**
- [ ] deviation-recorder.md - 偏差记录
- [ ] rules-evolver.md - 规则进化
- [ ] docx-to-markdown.md - 文档转换

**数据层文件（3个）：**
- [ ] src/schemas/run-json.ts - Schema 定义
- [ ] src/cli/commands/log.ts - CLI 实现
- [ ] dashboard/src/types.ts - 前端类型

---

**最后更新：** 2026-03-13
**维护者：** AIDevOS Team
