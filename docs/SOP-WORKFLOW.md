# AIDevOS SOP 工作流程完整说明

**文档版本：** v1.0
**最后更新：** 2026-03-13

---

## 📋 核心流程文件清单

### 🎯 主流程文件（按执行顺序）

| # | 文件路径 | 角色 | 触发方式 |
|---|---------|------|---------|
| 1 | `src/assets/skills/workflow-orchestrator.md` | 流程编排器 | 用户调用 `/workflow` |
| 2 | `src/assets/skills/requirement-analyzer.md` | 需求分析器 | workflow 自动调用 |
| 3 | `src/assets/skills/task-splitter.md` | 任务拆分器 | workflow 自动调用 |
| 4 | `src/assets/skills/code-generator.md` | 代码生成器 | workflow 循环调用 |
| 5 | `src/assets/skills/self-reviewer.md` | 质量自检员 | workflow 循环调用 |
| 6 | `src/assets/skills/bug-fixer.md` | 缺陷修复器 | 自检不通过时调用 |

### 🔧 辅助工具文件

| # | 文件路径 | 角色 | 触发方式 |
|---|---------|------|---------|
| 7 | `src/assets/skills/deviation-recorder.md` | 偏差记录器 | 用户手动调用 `/deviation` |
| 8 | `src/assets/skills/rules-evolver.md` | 规则进化器 | 用户手动调用 |
| 9 | `src/assets/skills/docx-to-markdown.md` | DOCX 转换器 | workflow 自动检测 |

### 📊 数据结构定义

| # | 文件路径 | 说明 |
|---|---------|------|
| 10 | `src/schemas/run-json.ts` | run.json 数据结构定义（唯一数据源） |
| 11 | `src/cli/commands/log.ts` | CLI 数据写入命令实现 |
| 12 | `dashboard/src/types.ts` | Dashboard 类型定义（重新导出 schemas） |

---

## 🔄 完整工作流程图

```
用户输入需求（prd.md 或 prd.docx）
        ↓
   检测文件格式
        ↓
    ┌───┴────┐
    ↓        ↓
  .md      .docx
    ↓        ↓
    │   docx-to-markdown
    │        ↓
    └────→ prd.md
        ↓
   检测接口文档（可选）
   (api.md/docx, interface.md/docx, 接口文档.md/docx)
        ↓
    如有 .docx → 自动转换为 .md
        ↓
┌───────────────────────────────────────────────┐
│ 1. workflow-orchestrator (流程编排器)          │
│    ✓ 检测并转换 prd.docx → prd.md             │
│    ✓ 检测并转换接口文档（可选，支持多种命名）：  │
│      - api.md/docx                            │
│      - interface.md/docx                      │
│      - 接口文档.md/docx                        │
│      - 或其他包含 api/interface/接口 关键词   │
│    ✓ 初始化 run.json                           │
│    ✓ 从 prd.md 识别 PRD 阶段 (PRD1, PRD2...)  │
│    ✓ 设置 meta.prdPhases[]                    │
│    ✓ 更新 summary.prdPhaseCount               │
│    ✓ 写入 workflow[] 和 timeline[]            │
└───────────────┬───────────────────────────────┘
                ↓
┌───────────────────────────────────────────────┐
│ 2. requirement-analyzer (需求分析器)           │
│    ✓ 读取 prd.md                               │
│    ✓ 读取接口文档（如存在）                     │
│      - 提取接口路径、参数、响应结构             │
│      - 融入需求分析，明确 API 调用细节         │
│    ✓ 读取项目规范                               │
│    ✓ 生成 analysis.md                         │
│    ✓ 输出需求理解要点摘要                       │
│    ✓ 写入 workflow[] 和 timeline[]            │
└───────────────┬───────────────────────────────┘
                ↓
        【⚠️ 关键控制点 #1】
        ═══════════════════
        用户确认需求理解
        ═══════════════════
        必须等待用户回复：
        "✓ 确认理解正确"

        禁止跳过此步骤！
        需求理解错误会导致
        后续所有环节偏离
        ↓
        ✓ 确认正确
        ↓
    【必须写入数据】
    - context.currentStage = "requirement-confirmed"
    - timeline[] 添加确认事件
    - workflow[] 更新阶段状态
        ↓
┌───────────────────────────────────────────────┐
│ 3. task-splitter (任务拆分器)                  │
│    ✓ 读取 analysis.md                          │
│    ✓ 读取 .aidevos/rules/ 确保符合规范         │
│    ✓ 从 prd.md/analysis.md 识别 PRD 阶段      │
│    ✓ 拆分为原子任务（按依赖顺序）               │
│    ✓ 每个任务执行:                             │
│      aidevos log task \                        │
│        --title "..." \                         │
│        --stage "阶段名" \                       │
│        --prd-phase "PRD1" \                    │
│        --acceptance "验收标准"                  │
│    ✓ CLI 自动更新 summary.totalTasks          │
│    ✓ CLI 自动写入 timeline[]                  │
└───────────────┬───────────────────────────────┘
                ↓
        【循环：每个任务】
                ↓
┌───────────────────────────────────────────────┐
│ 4. code-generator (代码生成器)                 │
│    ✓ 读取 run.json.tasks[] 找第一个 pending   │
│    ✓ 读取项目所有规范：                         │
│      - .aidevos/rules/*.md                    │
│      - CLAUDE.md (Claude Code)                │
│      - .cursor/rules/*/*.md (Cursor)          │
│    ✓ 读取接口文档（如存在且任务涉及 API）：     │
│      - 按接口文档定义生成 API 调用代码          │
│      - 接口路径、参数、响应格式严格一致         │
│    ✓ 严格按规范生成/修改代码                    │
│    ✓ 禁止魔法字符串（文案走 i18n）             │
│    ✓ 禁止臆想不存在的 API/组件                 │
│    ✓ 代码完成后强制记录（不可跳过）：           │
│                                                │
│      【检查清单】                               │
│      □ 记录所有文件变更                         │
│        aidevos log file \                      │
│          --path "src/api/xxx.ts" \            │
│          --change-type modified \             │
│          --lines-added 50 \                   │
│          --lines-removed 10                   │
│                                                │
│      □ 标记任务完成                             │
│        aidevos log task-done --id TASK-XX     │
│                                                │
│    ✓ CLI 自动更新:                             │
│      - summary.filesChanged                   │
│      - summary.linesAdded                     │
│      - summary.linesRemoved                   │
│      - timeline[]                             │
│      - files[]                                │
└───────────────┬───────────────────────────────┘
                ↓
┌───────────────────────────────────────────────┐
│ 5. self-reviewer (质量自检员)                  │
│    ✓ 读取 run.json.tasks[] 最近完成的任务      │
│    ✓ 读取项目所有规范作为检查基准               │
│    ✓ 执行全维度自检：                          │
│      - 架构合规性                               │
│      - 语言与框架规范                           │
│      - API 封装规范                            │
│      - 组件开发规范                             │
│      - i18n 多语言                             │
│      - 异常处理                                 │
│      - 路径别名                                 │
│    ✓ 记录审查结果：                             │
│      aidevos log review \                      │
│        --task-id TASK-XX \                     │
│        --result pass \                         │
│        --scope "审查范围" \                     │
│        --issues 0                              │
│    ✓ CLI 自动更新:                             │
│      - summary.reviewCount                    │
│      - summary.reviewPassCount                │
│      - timeline[]                             │
└───────────────┬───────────────────────────────┘
                ↓
        ┌───────┴────────┐
        ↓                ↓
    ✓ 审查通过      ✗ 审查不通过
        ↓                ↓
    下一个任务    ┌──────────────────────────┐
                  │ 6. bug-fixer (缺陷修复器)  │
                  │    ✓ 读取最近一条 fail 记录 │
                  │    ✓ 读取项目所有规范       │
                  │    ✓ 定位问题文件           │
                  │    ✓ 严谨修复代码           │
                  │    ✓ 记录 Bug:             │
                  │      aidevos log bug \     │
                  │        --title "..." \     │
                  │        --severity high \   │
                  │        --source self-review \│
                  │        --task TASK-XX \    │
                  │        --files "..."       │
                  │    ✓ 修复后:               │
                  │      aidevos log bug-fix \ │
                  │        --id BUG-XX \       │
                  │        --fix "修复方案"     │
                  │    ✓ 记录文件变更:          │
                  │      aidevos log file ...  │
                  │    ✓ CLI 自动更新:         │
                  │      - summary.bugCount    │
                  │      - timeline[]          │
                  └──────┬───────────────────┘
                         ↓
                  重新自检（回到步骤5）

所有任务完成
        ↓
    【必须写入数据】
    - meta.status = "completed"
    - meta.endTime = now()
    - context.currentStage = "completed"
    - workflow[] 所有阶段设为 completed
    - timeline[] 添加完成事件
    - metrics 计算最终指标
        ↓
工作流闭环结束
        ↓
【用户测试验证阶段】
        ↓
发现 AI 偏差（与期望不符）
        ↓
┌───────────────────────────────────────────────┐
│ 7. deviation-recorder (偏差记录器)             │
│    ✓ 用户手动触发（/deviation）                │
│    ✓ 从用户反馈提取偏差描述                     │
│    ✓ 回顾项目所有规范判断根因                   │
│    ✓ 修复偏差代码                               │
│    ✓ 记录偏差:                                 │
│      aidevos log deviation \                   │
│        --title "偏差简述" \                     │
│        --root-cause rule-missing \             │
│        --category component-usage \            │
│        --ai-output "AI实际生成" \              │
│        --expected "用户期望" \                  │
│        --files "file1.ts,file2.ts"            │
│    ✓ CLI 自动更新 summary.deviationCount      │
│                                                │
│    【关键判断】是否需要沉淀规则？               │
│    问：这是技术规范还是业务逻辑？               │
│         ↓                                      │
│    ┌────┴────┐                                │
│    ↓         ↓                                │
│  技术规范  业务逻辑                            │
│  (无业务)  (有业务)                            │
│    ↓         ↓                                │
│  需要沉淀  不沉淀                              │
│                                                │
│  ✅ 技术规范示例：                             │
│    - el-dialog 内 Table 需要 min-height       │
│    - Table columns 必须放在 computed 中       │
│    - API 请求必须走统一封装                    │
│    - 公共组件 props 使用规范                   │
│                                                │
│  ❌ 业务逻辑示例：                             │
│    - 用户列表需要显示注册时间                   │
│    - 订单详情需要增加物流信息                   │
│    - 某表单需要特定校验规则                     │
│                                                │
│  如果是技术规范：                              │
│    ✓ 创建 pending 规则:                        │
│      aidevos log rule \                        │
│        --content "[待沉淀] 规则描述" \         │
│        --source-deviation DEV-XX \             │
│        --status pending                        │
│                                                │
│    ✓ 正式沉淀规则:                             │
│      aidevos log rule \                        │
│        --content "正式规则内容" \              │
│        --source-deviation DEV-XX \             │
│        --file ".aidevos/rules/xxx.md"         │
│                                                │
│    ✓ CLI 自动更新 summary.rulesSedimented     │
└───────────────────────────────────────────────┘
```

---

## 🚨 三大关键控制点

### 第1关：需求理解确认（最重要！）

**位置：** workflow-orchestrator.md - Step 1

**工程控制论原理：**
- 需求理解是系统性能的决定性因素
- 需求错误会导致后续所有环节全部偏离
- 成本最低的纠错点

**铁律：**
1. requirement-analyzer 生成 analysis.md 后**必须暂停**
2. 输出需求理解要点摘要
3. **只有用户明确回复 "✓ 确认理解正确" 才能继续**
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
```
1. code-generator 编写代码
   ↓
2. 强制记录文件变更（每个修改的文件都要记录）
   aidevos log file --path "..." --change-type modified --lines-added 50 --lines-removed 10
   ↓
3. 标记任务完成
   aidevos log task-done --id TASK-XX
   ↓
4. self-reviewer 质量自检
   aidevos log review --task-id TASK-XX --result pass/fail --scope "..." --issues 0
   ↓
   ┌───────┴────────┐
   ↓                ↓
 pass             fail
   ↓                ↓
下一个任务      bug-fixer 修复
                    ↓
              aidevos log bug ...
              aidevos log bug-fix ...
                    ↓
              重新自检（回到步骤4）
```

**检查清单：**
- ✅ 所有新建/修改/删除的文件都已记录
- ✅ 行数统计准确（从 git diff 或编辑器获取）
- ✅ 任务状态已标记完成
- ✅ 自检结果已记录

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

**关键词识别：**
- 技术规范：组件、props、API、必须、禁止、规范、封装、约束
- 业务逻辑：用户、订单、审批、需要、显示、增加、功能、流程

**流程：**
```
rootCause = rule-missing
        ↓
   判断性质
        ↓
  ┌─────┴─────┐
  ↓           ↓
技术规范    业务逻辑
  ↓           ↓
创建规则    不创建规则
(pending)   （仅记录偏差）
  ↓
正式沉淀
(.aidevos/rules/*.md)
```

---

## 📊 数据契约说明

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

## 🔧 CLI 命令速查

### 初始化与更新
```bash
aidevos init        # 初始化项目
aidevos update      # 更新 skills 到最新版本
aidevos migrate     # 迁移旧数据到新 schema
```

### 工作流命令
```bash
aidevos start       # 创建新的 run
aidevos status      # 查看当前状态
aidevos dashboard   # 启动可视化面板
```

### 数据记录命令
```bash
# 任务
aidevos log task --title "..." --stage "..." --prd-phase "PRD1" --acceptance "..."
aidevos log task-done --id TASK-XX

# Bug
aidevos log bug --title "..." --severity high --source self-review --task TASK-XX
aidevos log bug-fix --id BUG-XX --fix "..."

# 偏差
aidevos log deviation --title "..." --root-cause rule-missing --category component-usage --ai-output "..." --expected "..." --files "..."

# 自检
aidevos log review --task-id TASK-XX --result pass --scope "..." --issues 0

# 规则
aidevos log rule --content "..." --source-deviation DEV-XX --status pending
aidevos log rule --content "..." --source-deviation DEV-XX --file ".aidevos/rules/xxx.md"

# 文件变更
aidevos log file --path "..." --change-type modified --lines-added 50 --lines-removed 10
```

---

## 📁 项目目录结构

```
.aidevos/
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

## 🎯 工程控制论原则

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

```
偏差发现 → 规则沉淀 → 规范约束 → 减少偏差
   ↑                                    ↓
   └────────── 持续优化 ←──────────────┘
```

---

## 📝 校对检查清单

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
