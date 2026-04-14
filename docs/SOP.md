# aiDevOS - AI Development SOP

> Historical design reference. The canonical current user-facing docs are [README.md](../README.md) and [COMMANDS.md](../COMMANDS.md). Some workflow artifacts in this file, such as `context.md` and the older `needs/` structure, describe earlier prototypes rather than the current `.aida` CLI flow.

> 基于 frontend-msg-admin 项目真实开发流程提取，所有阶段、文件、数据结构均来自实际运行验证。

---

## 第一步：当前项目真实开发流程分析

### 1.1 完整流程链路

```
PRD(.docx) → [docx-to-markdown] → PRD(.md)
    ↓
PRD(.md) → [requirement-analyzer] → analysis.md
    ↓
    ⚠️  【关键控制点】用户确认需求理解 ← 必须确认无误才能往下走
    ↓
analysis.md → [task-splitter] → task.md
    ↓
task.md → [code-generator] → 业务代码（逐项执行，标记 [x]）
    ↓
业务代码 → [self-reviewer] → review-XX.md
    ├── PASS → 更新 review.md → 下一个任务
    └── FAIL → [bug-fixer] → 修复代码 + bugTask.md → 重新 self-review
    ↓
全部任务完成 → 更新 process.md（阶段闭环）
    ↓
用户验收阶段 → 偏差反馈 → [deviation-recorder] → deviationTask.md + 规则沉淀
    ↓
测试阶段 → Bug 反馈 → [bug-fixer] → bugTask.md
    ↓
数据统计 → [dashboard-generator] → dashboard.html
    ↓
代码提交 → [commit-code] → git push
```

**流程关键控制点说明：**
- **需求理解确认（最高优先级）**：requirement-analyzer 生成 analysis.md 后**必须暂停**，等待用户明确确认理解正确。需求理解错误是工程控制论的最大风险，会导致所有后续环节偏离。
- **任务拆分**：可以自动执行或可选确认，优先级低于需求确认。

### 1.2 Skill 编排体系（已验证）

项目中存在 **1 个编排器 + 10 个原子 Skill + 1 个母 Skill**，分为三层：

#### 第一层：流程编排（自动化主循环）

| Skill | 角色 | 职责 |
|-------|------|------|
| `workflow-orchestrator` | PM / 调度器 | 串联所有原子 Skill，管控流程生命周期，支持中断恢复 |

#### 第二层：核心原子 Skill（纳入 workflow-orchestrator 自动循环）

| Skill | 角色 | 输入 | 输出 |
|-------|------|------|------|
| `docx-to-markdown` | 文档转换器 | .docx 文件 | .md 文件 |
| `requirement-analyzer` | 需求分析师 | prd.md + .cursor/rules/ | analysis.md |
| `task-splitter` | Tech Lead | analysis.md | task.md |
| `code-generator` | 高级工程师 | task.md + .cursor/rules/ | 业务代码 + task.md [x] |
| `self-reviewer` | 代码审查员 | task.md + .cursor/rules/ + 代码 | logs/self-review/review-XX.md |
| `bug-fixer` | 救火队长 | review-XX.md / bugTask.md | 修复代码 + bugTask.md |

#### 第三层：辅助 Skill（用户手动触发，不纳入主循环）

| Skill | 角色 | 触发方式 | 职责 |
|-------|------|----------|------|
| `deviation-recorder` | 质量分析师 | `/deviation` | 记录 AI 产出偏差，沉淀规则 |
| `dashboard-generator` | 数据可视化专家 | `/dashboard` | 生成 ECharts 数据看板 |
| `commit-code` | 提交助手 | `/commit-code` | 冲突检测 + commit message + push |
| `mcp-reviewer` | 高级审查员 | 人工指定 | 安全/性能/架构深度审计 |
| `rules-evolver` | 架构布道师 | 人工触发 | 沉淀规则到 .cursor/rules/ |

#### 元层：Skill 生成器

| Skill | 职责 |
|-------|------|
| `dev-flower` | 母 Skill，扫描项目后生成上述所有原子 Skill + 编排器 + 目录结构 |
| `audit` | 审计项目代码与规则一致性，输出治理报告和优化草案 |

### 1.3 文件目录实际结构

```
needs/
  MTR-2995-temporary/          # branch_name
    vito-long/                  # auth_name (git config user.name)
      prd.md                    # PRD1 需求文档
      prd2.md                   # PRD2 增量需求
      api-design.md             # PRD3 接口设计文档
      analysis.md               # 需求分析报告（增量追加）
      task.md                   # 开发任务清单（checklist）
      context.md                # 工作流上下文（中断恢复依据）
      process.md                # 流程进度表（阶段 + 状态 + 完成时间）
      review.md                 # 自检结果汇总
      bugTask.md                # Bug 修复任务清单
      deviationTask.md          # AI 偏差记录清单
      pending-confirmation.md   # 待确认事项
      dashboard.html            # 数据看板（ECharts）
      logs/
        self-review/
          review-01.md          # 第 1 次自检报告
          review-02.md          # 第 2 次自检报告
          review-03.md          # 第 3 次自检报告（未通过）
          review-04.md          # 第 4 次自检报告
        mcp-review/             # MCP 高级审查记录

.cursor/
  skills/                       # Skill 定义
    workflow-orchestrator/SKILL.md
    requirement-analyzer/SKILL.md
    task-splitter/SKILL.md
    code-generator/SKILL.md
    self-reviewer/SKILL.md
    bug-fixer/SKILL.md
    deviation-recorder/SKILL.md
    dashboard-generator/SKILL.md
    commit-code/SKILL.md
    mcp-reviewer/SKILL.md
    rules-evolver/SKILL.md
    dev-flower/SKILL.md
    audit-skills/SKILL.md
    docx-to-markdown/SKILL.md
    message-center-admin-frontend/SKILL.md  # 项目专属业务 Skill
  rules/                        # 项目规范
    coding-style.md
    component-usage.md
    i18n-rule.md
```

### 1.4 workflow-orchestrator 编排逻辑（真实运行）

```
Step 0: 初始化
  ├── 检查 prd.md / prd.docx 是否存在
  ├── 比对 prd 与 analysis.md
  │   ├── 有新增内容 → 触发 requirement-analyzer
  │   └── 无新增 → 读取 context.md 恢复进度
  └── 检查 process.md 是否 100% → 是则提示已闭环

Step 1: 加载上下文
  └── 读取 context.md → 判断中断恢复点

Step 2: 生成任务清单
  ├── analysis.md 存在 + task.md 不存在
  ├── 触发 task-splitter → 生成 task.md
  └── 暂停，请求用户确认 task.md

Step 3: 核心执行循环
  ├── A: code-generator → 写代码
  ├── B: 标记 task.md [x]
  ├── C: self-reviewer → 质量自检
  └── D: FAIL → bug-fixer → 回到 C
       PASS → 更新 review.md → 下一个任务

Step 4: 保存进度
  └── 每完成一个子任务 → 更新 context.md

Step 5: 结束
  └── 全部完成 → 更新 process.md
```

### 1.5 真实运行数据（MTR-2995-temporary）

| 指标 | 数值 |
|------|------|
| PRD 迭代次数 | 3 轮（列表页 → 编辑页 → 接口对接） |
| 任务总数 | 37 项（9 + 14 + 14），全部完成 |
| 自检次数 | 4 次（3 PASS + 1 FAIL） |
| Bug 记录 | 5 条（BUG-01 ~ BUG-05），全部修复 |
| 偏差记录 | 23 条（DEV-01 ~ DEV-23），全部修复 |
| 新建/修改文件 | ~30 个文件 |
| 规则沉淀 | 4 条规则写入 .cursor/rules/ |
| 开发周期 | 2026-03-06 ~ 2026-03-12 |

---

## 第二步：每个阶段的 SOP 定义

### Stage 0: Document Conversion（文档转换）

| 维度 | 内容 |
|------|------|
| **目标** | 将 .docx 格式的 PRD 转换为 Markdown |
| **触发 Skill** | `docx-to-markdown` |
| **输入** | `needs/[branch]/[dev]/prd.docx` |
| **输出** | `needs/[branch]/[dev]/prd.md` |
| **记录数据** | 转换工具、文件大小、行数 |
| **通过条件** | .md 文件生成且内容完整 |

### Stage 1: Requirement Analysis（需求分析）

| 维度 | 内容 |
|------|------|
| **目标** | 将 PRD 转化为结构化的前端分析报告 |
| **触发 Skill** | `requirement-analyzer` |
| **输入** | `prd.md` + `.cursor/rules/*.md`（项目规范） |
| **输出** | `analysis.md` |
| **记录数据** | 页面数、功能点数、API 数、待确认项数 |
| **通过条件** | 用户确认 analysis.md 内容合理 |
| **增量支持** | 多 PRD 迭代时，增补 analysis.md 而非覆盖 |

**analysis.md 输出结构**：
1. 业务概述
2. 页面与路由规划
3. 功能点拆解（字段级别）
4. 规范一致性检查（UI/i18n/API）
5. 待确认或风险项

### Stage 2: Task Decomposition（任务拆分）

| 维度 | 内容 |
|------|------|
| **目标** | 将分析报告转化为可逐条执行的开发任务 |
| **触发 Skill** | `task-splitter` |
| **输入** | `analysis.md` |
| **输出** | `task.md` |
| **记录数据** | 阶段数、子任务总数 |
| **通过条件** | 用户确认 task.md 后才进入编码 |

**task.md 格式规范**：
- 按阶段分组：`## 阶段X：XXX`
- 每项使用 checklist：`- [ ] X.X 描述`
- 每项包含验收标准
- 典型拆分顺序：类型定义 → API → i18n → 视图骨架 → 表单表格 → 交互弹窗

### Stage 3: Code Generation（代码生成）

| 维度 | 内容 |
|------|------|
| **目标** | 逐条执行 task.md，产出符合规范的业务代码 |
| **触发 Skill** | `code-generator` |
| **输入** | `task.md`（第一个 `[ ]` 项）+ `.cursor/rules/` |
| **输出** | 业务代码文件 + `task.md` 标记 `[x]` |
| **记录数据** | 当前任务编号、修改文件列表 |
| **约束** | 强制加载 rules、禁止 Options API、禁止魔法字符串、禁止相对路径 |

### Stage 4: Quality Review（质量自检）

| 维度 | 内容 |
|------|------|
| **目标** | 对新增/修改代码进行全维度规范检查 |
| **触发 Skill** | `self-reviewer` |
| **输入** | `task.md` 已完成项 + `.cursor/rules/` + 代码文件 |
| **输出** | `logs/self-review/review-XX.md` + `review.md` 状态更新 |
| **记录数据** | 检查维度数、问题数（按严重度）、PASS/FAIL |
| **检查维度** | 架构合规、Vue3/TS、API 规范、FormJ/Table computed、i18n、异常处理、路径别名 |

**review-XX.md 结构**（从实际文件提取）：
- 审查范围、日期
- 每个维度：检查项 + 结果(PASS/FAIL/WARN) + 说明
- 问题清单（编号 + 严重度 + 文件 + 描述 + 修复方案）
- 结论：Review Passed / 未通过

### Stage 5: Bug Fix（缺陷修复）

| 维度 | 内容 |
|------|------|
| **目标** | 修复自检未通过的问题或测试阶段发现的 Bug |
| **触发 Skill** | `bug-fixer` |
| **输入** | `logs/self-review/review-XX.md` 或 `bugTask.md` |
| **输出** | 修复后的代码 + `bugTask.md` 记录（强制） |
| **记录数据** | BUG 编号、来源、涉及文件、修复方案 |
| **后续** | 修复后重新触发 self-reviewer |

**bugTask.md 条目格式**：
```
- [x] BUG-XX: 简述
  - 来源: 用户反馈 / self-review
  - 文件: 涉及文件路径
  - 修复: 修复方案描述
```

### Stage 6: Deviation Recording（偏差记录）

| 维度 | 内容 |
|------|------|
| **目标** | 记录 AI 产出与用户期望的偏差，驱动规则优化 |
| **触发 Skill** | `deviation-recorder` |
| **触发方式** | 用户手动 `/deviation` |
| **输入** | 用户反馈（AI 产出 vs 期望） |
| **输出** | `deviationTask.md` 记录 + 代码修复 + 规则沉淀（按需） |
| **记录数据** | DEV 编号、AI 产出、用户期望、根因分析、涉及文件、已沉淀规则 |

**deviationTask.md 条目格式**：
```
- [x] DEV-XX: 简述
  - AI 产出: AI 实际生成了什么
  - 用户期望: 用户实际想要什么
  - 根因分析: 规则缺失 / 上下文不足 / 臆想
  - 涉及文件: 文件路径
  - 已沉淀规则: 写入的规则文件路径 / 无
```

### Stage 7: Dashboard（数据看板）

| 维度 | 内容 |
|------|------|
| **目标** | 从开发过程数据生成可视化看板 |
| **触发 Skill** | `dashboard-generator` |
| **输入** | task.md + deviationTask.md + bugTask.md + review logs |
| **输出** | `dashboard.html`（ECharts 单文件 HTML） |
| **看板内容** | KPI 卡片 + 任务完成柱状图 + 偏差根因饼图 + 文件热点图 + 自检汇总表 |

### Stage 8: Code Commit（代码提交）

| 维度 | 内容 |
|------|------|
| **目标** | 安全地提交和推送代码 |
| **触发 Skill** | `commit-code` |
| **流程** | git pull → 冲突检测 → git status → 生成 commit message → git add → git commit → 确认推送 |
| **输出** | git commit + push |

### 辅助阶段（不在主循环内）

| 阶段 | Skill | 触发 | 目标 |
|------|-------|------|------|
| MCP 高级审查 | `mcp-reviewer` | 人工指定 | 安全/性能深度审计 |
| 规则演进 | `rules-evolver` | 人工触发 | 沉淀新规则到 .cursor/rules/ |
| 项目审计 | `audit` | 人工触发 | 扫描代码与规则一致性 |

---

## 第三步：通用目录结构设计

```
.aida/
  config.json                   # 全局配置（项目名、技术栈、默认分支等）

  skills/                       # 通用 SOP Skill 定义
    workflow-orchestrator/
      SKILL.md
    requirement-analyzer/
      SKILL.md
    task-splitter/
      SKILL.md
    code-generator/
      SKILL.md
    self-reviewer/
      SKILL.md
    bug-fixer/
      SKILL.md
    deviation-recorder/
      SKILL.md
    dashboard-generator/
      SKILL.md
    commit-code/
      SKILL.md
    mcp-reviewer/
      SKILL.md
    rules-evolver/
      SKILL.md
    docx-to-markdown/
      SKILL.md
    dev-flower/                 # 母 Skill（初始化生成器）
      SKILL.md

  rules/                        # 项目规范（由 audit / rules-evolver 维护）
    coding-style.md
    component-usage.md
    i18n-rule.md
    # 用户可自定义扩展

  runs/                         # 需求运行实例（替代原 needs/）
    FEATURE-001/                # branch_name / feature_id
      developer-a/              # auth_name
        run.json                # 运行元数据（状态、时间线、统计）
        prd.md                  # 需求文档
        analysis.md             # 需求分析
        task.md                 # 任务清单
        context.md              # 工作流上下文（中断恢复）
        process.md              # 流程进度
        review.md               # 自检汇总
        bugTask.md              # Bug 记录
        deviationTask.md        # 偏差记录
        dashboard.html          # 数据看板
        logs/
          self-review/
            review-01.md
            review-02.md
          mcp-review/

  templates/                    # 文件模板（初始化时使用）
    context.md.tpl
    process.md.tpl
    task.md.tpl
    review.md.tpl
    bugTask.md.tpl
    deviationTask.md.tpl
    run.json.tpl
```

### 目录设计说明

| 目录 | 原项目对应 | 变更原因 |
|------|-----------|----------|
| `.aida/skills/` | `.cursor/skills/` | 去除 Cursor 绑定，通用化 |
| `.aida/rules/` | `.cursor/rules/` | 同上 |
| `.aida/runs/` | `needs/` | 语义更明确，每次需求是一次 "run" |
| `run.json` | 无（新增） | 机器可读的运行元数据 |
| `.aida/templates/` | 无（新增） | 初始化文件模板 |

---

## 第四步：开发数据模型 — run.json Schema (v1)

> 文件位置：`.aida/runs/{runId}/run.json`
> 该 JSON 文件记录一次 AI 开发运行的完整数据，是 dashboard、CLI 查询、中断恢复的统一数据源。

### 4.1 Meta（运行元信息）

```json
"meta": {
  "schemaVersion": "1.0",
  "runId": "FEATURE-001",
  "project": "example-project",
  "developer": "vito-long",
  "branch": "feature/FEATURE-001",
  "aiModel": "claude",
  "aiTool": "claude-code",
  "startTime": "2026-03-06T10:00:00Z",
  "endTime": null,
  "status": "running",
  "prdPhases": ["PRD1", "PRD2", "PRD3"]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `schemaVersion` | string | Schema 版本号 |
| `runId` | string | 运行唯一标识（如分支名、JIRA 号） |
| `project` | string | 项目名称 |
| `developer` | string | 开发者（git config user.name 转换） |
| `branch` | string | Git 分支名 |
| `aiModel` | string | AI 模型（claude / gpt 等） |
| `aiTool` | string | AI 工具（claude-code / cursor 等） |
| `startTime` | ISO8601 | 运行开始时间 |
| `endTime` | ISO8601 / null | 运行结束时间 |
| `status` | enum | `running` / `paused` / `completed` |
| `prdPhases` | string[] | PRD 迭代阶段列表（支持多轮迭代） |

### 4.2 Summary（Dashboard 快速统计）

```json
"summary": {
  "totalTasks": 37,
  "completedTasks": 37,
  "bugCount": 5,
  "deviationCount": 23,
  "reviewCount": 4,
  "reviewPassCount": 3,
  "reviewFailCount": 1,
  "rulesSedimented": 4,
  "prdPhaseCount": 3,
  "filesChanged": 30,
  "linesAdded": 0,
  "linesRemoved": 0
}
```

> 与原始设计差异：补充 `reviewPassCount`、`reviewFailCount`、`rulesSedimented`、`prdPhaseCount`。
> 理由：自检通过率和规则沉淀数是 aiDevOS 的核心价值指标，在真实项目中被重点追踪（3 PASS / 1 FAIL / 4 条规则）。

### 4.3 Workflow（SOP 阶段执行）

```json
"workflow": [
  {
    "stage": "document_conversion",
    "prdPhase": "PRD1",
    "status": "completed",
    "startTime": "2026-03-06T00:00:00Z",
    "endTime": "2026-03-06T00:00:00Z"
  },
  {
    "stage": "analysis",
    "prdPhase": "PRD1",
    "status": "completed",
    "startTime": "2026-03-06T00:00:00Z",
    "endTime": "2026-03-06T00:00:00Z"
  },
  {
    "stage": "task_decomposition",
    "prdPhase": "PRD1",
    "status": "completed",
    "startTime": "2026-03-06T00:00:00Z",
    "endTime": "2026-03-06T00:00:00Z"
  },
  {
    "stage": "coding",
    "prdPhase": "PRD2",
    "status": "running",
    "startTime": "2026-03-09T00:00:00Z",
    "endTime": null
  }
]
```

> 与原始设计差异：
> 1. 增加 `prdPhase` 字段 — 真实项目中 workflow 不是线性一次性的，而是多轮 PRD 迭代（PRD1/PRD2/PRD3），每轮都有独立的 analysis -> task -> coding -> review 循环。
> 2. stage 枚举扩展为：`document_conversion` | `analysis` | `task_decomposition` | `coding` | `review` | `bug_fix` | `build_verification` | `completed`

### 4.4 Tasks（任务列表）

```json
"tasks": [
  {
    "taskId": "TASK-11.1",
    "title": "创建统一 API 类型定义",
    "description": "创建 src/api/templateManagement/types.ts，定义 8 个 TypeScript 接口",
    "status": "completed",
    "stageIndex": 11,
    "stageName": "统一 API 类型定义",
    "prdPhase": "PRD3",
    "acceptance": "类型文件可正常被其他模块导入，无 TS 报错",
    "createdAt": "2026-03-10T00:00:00Z",
    "startedAt": "2026-03-10T00:00:00Z",
    "completedAt": "2026-03-10T00:00:00Z",
    "files": [
      "src/api/templateManagement/types.ts"
    ]
  }
]
```

> 与原始设计差异：
> 1. 补充 `stageIndex` / `stageName` — 任务按阶段分组是真实 task.md 的核心结构（阶段一~十六）。
> 2. 补充 `prdPhase` — 区分任务属于哪轮 PRD 迭代。
> 3. 补充 `acceptance` — 每个任务都有验收标准（从真实 task.md 提取）。
> 4. 移除 `priority` — 真实流程中未使用，任务按 stageIndex 顺序执行。

### 4.5 Bugs（缺陷记录）

```json
"bugs": [
  {
    "bugId": "BUG-001",
    "title": "form 页面不需要标题（h3）",
    "description": "form 页面顶部不应有独立 h3 标题，菜单名和面包屑已承担标题功能",
    "severity": "medium",
    "source": "user_feedback",
    "status": "fixed",
    "prdPhase": "PRD2",
    "reportedAt": "2026-03-09T00:00:00Z",
    "fixedAt": "2026-03-09T00:00:00Z",
    "fix": "移除 <div class=\"template-form-header\"> 及对应样式",
    "files": [
      "pushTemplate/form.vue",
      "smsTemplate/form.vue"
    ],
    "relatedTask": null,
    "ruleSedimented": null
  }
]
```

> 与原始设计差异：
> 1. 补充 `source` — Bug 来源区分（`self_review` / `user_feedback` / `testing` / `mcp_review`）。
> 2. 补充 `files` — 涉及文件列表（真实 bugTask.md 每条都记录）。
> 3. 补充 `fix` — 修复方案描述。
> 4. 补充 `prdPhase` / `ruleSedimented` — 部分 Bug 修复会沉淀规则（如 BUG-02 沉淀了 labelPosition 规则）。

### 4.6 Deviations（AI 偏差记录 — 核心数据结构）

这是 aiDevOS 区别于普通开发工具的**核心数据结构**。

```json
"deviations": [
  {
    "deviationId": "DEV-003",
    "title": "FormJ 属性透传方式错误",
    "aiOutput": ":formProps=\"{ labelPosition: 'top' }\"（包裹在对象 prop 中）",
    "expectedOutput": "直接 attrs 传递 label-position=\"top\"",
    "rootCause": "AI 不了解 FormJ 内部使用 $attrs 透传机制，臆想了一个 formProps prop",
    "rootCauseCategory": "rule_missing",
    "deviationCategory": "component_usage",
    "severity": "medium",
    "prdPhase": "PRD2",
    "status": "resolved",
    "detectedAt": "2026-03-09T00:00:00Z",
    "resolvedAt": "2026-03-09T00:00:00Z",
    "files": [
      "pushTemplate/form.vue",
      "smsTemplate/form.vue"
    ],
    "ruleSedimented": {
      "file": ".aida/rules/component-usage.md",
      "content": "FormJ 属性必须直接以 attrs 形式传入"
    }
  }
]
```

> 与原始设计差异（重构级改动）：
> 1. 补充 `aiOutput` + `expectedOutput` — AI 实际产出 vs 用户期望的对比是偏差记录的核心价值。
> 2. 补充 `rootCause` — 详细根因分析文本。
> 3. `type` 重命名为 `rootCauseCategory` 并扩展枚举 — 原 4 种不够，真实数据中提取出 8 种根因。
> 4. 新增 `deviationCategory` — 偏差类别维度（UI/布局/组件/i18n 等），用于饼图分析。
> 5. 补充 `files` — 涉及文件列表。
> 6. 补充 `ruleSedimented` — 偏差是否沉淀为规则（aiDevOS 的价值闭环终点）。
> 7. `resolved` (boolean) 改为 `status` + `resolvedAt` — 更规范的状态追踪。

**rootCauseCategory 枚举**（从 23 条真实偏差提取）：

| 值 | 含义 | 真实出现次数 |
|----|------|-------------|
| `rule_missing` | 规则缺失 / AI 不了解组件 API | 5 |
| `spacing_judgment_error` | 间距/边距判断失误 | 6 |
| `reference_copy_blindly` | 盲目照搬参考代码 | 4 |
| `multi_round_not_converge` | 多轮修正未收敛 | 3 |
| `requirement_misunderstanding` | 需求理解偏差 | 2 |
| `context_insufficient` | 上下文不足 | 2 |
| `ai_hallucination` | AI 臆想不存在的 API/组件 | 1 |
| `process_omission` | 流程遗漏（任务拆分时漏掉） | 2 |
| `other` | 其他 | - |

**deviationCategory 枚举**：

| 值 | 含义 | 真实出现次数 |
|----|------|-------------|
| `ui_spacing` | UI/间距问题 | 8 |
| `layout_structure` | 布局/结构问题 | 3 |
| `component_usage` | 组件使用错误 | 4 |
| `i18n_requirement` | i18n/需求遗漏 | 3 |
| `cache_flow` | 缓存/流程问题 | 2 |
| `process_omission` | 流程/任务遗漏 | 2 |
| `other` | 其他 | 1 |

### 4.7 Reviews（自检记录）

```json
"reviews": [
  {
    "reviewId": "REV-003",
    "type": "self-review",
    "scope": "阶段 11-16 变更文件（14 个文件）",
    "prdPhase": "PRD3",
    "result": "fail",
    "reviewedAt": "2026-03-10T00:00:00Z",
    "dimensions": [
      { "name": "架构合规性", "result": "pass" },
      { "name": "Vue 3 & TypeScript", "result": "pass" },
      { "name": "API 封装规范", "result": "fail", "issues": 1 },
      { "name": "i18n 多语言", "result": "warn", "issues": 1 },
      { "name": "路径别名", "result": "pass" },
      { "name": "异常处理", "result": "pass" },
      { "name": "数据一致性", "result": "warn", "issues": 1 }
    ],
    "issueList": [
      {
        "issueId": "CRITICAL-01",
        "severity": "critical",
        "file": "src/api/templateManagement/template.ts",
        "description": "无 Mock 数据兜底，后端未就绪时页面报错",
        "fix": "在薄代理层添加 Mock 数据兜底"
      }
    ]
  }
]
```

> 与原始设计差异：
> 1. 补充 `scope` — 审查范围描述（真实 review 都有明确范围）。
> 2. 补充 `prdPhase` — 属于哪轮 PRD。
> 3. 补充 `dimensions` — 每个检查维度的独立结果（从真实 review-03.md 的表格结构提取）。
> 4. `issues` (number) 改为 `issueList` (array) — 结构化问题列表，含 severity/file/description/fix。
> 5. `result` 值改为 `pass` / `fail`（原 `issues_found` 语义模糊）。
>
> Review type 枚举：`self-review` | `mcp-review` | `human-review`

### 4.8 Files（文件修改统计）

```json
"files": [
  {
    "path": "src/api/templateManagement/types.ts",
    "changeType": "created",
    "linesAdded": 120,
    "linesRemoved": 0,
    "relatedTo": ["TASK-11.1"]
  }
]
```

> 与原始设计差异：
> 1. `changeType` 增加 `created` — 真实项目中大量新建文件（枚举：`created` | `modified` | `deleted`）。
> 2. 新增 `relatedTo` — 追踪文件变更来源（哪个 task/bug/deviation 触发），用于热点分析。

### 4.9 Metrics（AI 开发质量指标）

```json
"metrics": {
  "aiDeviationRate": 0.62,
  "bugRate": 0.14,
  "reviewPassRate": 0.75,
  "firstPassRate": 0.75,
  "rulesSedimentedCount": 4,
  "deviationToRuleRatio": 0.17,
  "avgTaskTimeSeconds": 720,
  "totalDevelopmentTimeSeconds": 8400
}
```

> 补充指标：
> - `reviewPassRate` = reviewPassCount / reviewCount（自检通过率）
> - `firstPassRate` = 首次自检即通过的阶段数 / 总阶段数（AI 一次生成质量）
> - `rulesSedimentedCount` = deviation 中 ruleSedimented 非 null 的数量
> - `deviationToRuleRatio` = rulesSedimented / deviationCount（偏差转化率）

### 4.10 Timeline（开发时间线）

```json
"timeline": [
  {
    "event": "analysis_completed",
    "time": "2026-03-06T00:00:00Z",
    "prdPhase": "PRD1",
    "detail": "需求分析完成，输出 analysis.md"
  },
  {
    "event": "coding_completed",
    "time": "2026-03-06T00:00:00Z",
    "prdPhase": "PRD1",
    "detail": "9 项任务全部完成，8 个文件已创建"
  }
]
```

### 4.11 Events（完整事件流）

```json
"events": [
  {
    "type": "task_created",
    "time": "2026-03-06T00:00:00Z",
    "data": { "taskId": "TASK-001" }
  },
  {
    "type": "task_completed",
    "time": "2026-03-06T00:00:00Z",
    "data": { "taskId": "TASK-001" }
  },
  {
    "type": "bug_created",
    "time": "2026-03-09T00:00:00Z",
    "data": { "bugId": "BUG-001" }
  },
  {
    "type": "rule_sedimented",
    "time": "2026-03-09T00:00:00Z",
    "data": { "deviationId": "DEV-002", "ruleFile": "component-usage.md" }
  }
]
```

Event type 枚举：
```
task_created | task_completed | bug_created | bug_fixed |
deviation_created | deviation_resolved | review_created |
rule_sedimented | workflow_stage_changed | build_verified
```

### 4.12 Rules（沉淀规则追踪 — 新增顶层字段）

规则沉淀是 aiDevOS 的核心价值链末端，从 deviation -> 规则的闭环需要独立追踪。

```json
"rules": [
  {
    "ruleId": "RULE-001",
    "file": ".aida/rules/component-usage.md",
    "content": "编辑页 FormJ 必须 labelPosition: top",
    "sourceDeviation": "DEV-002",
    "sedimentedAt": "2026-03-09T00:00:00Z"
  }
]
```

> 原始设计中无此字段。新增理由：偏差 -> 规则沉淀是 aiDevOS 区别于普通开发工具的核心数据链路，需要独立可查。

### 4.13 Context（工作流恢复点 — 新增顶层字段）

用于中断恢复，是 context.md 的 JSON 化表达。

```json
"context": {
  "currentPrdPhase": "PRD3",
  "currentTaskId": "TASK-14.2",
  "currentStage": "coding",
  "lastUpdated": "2026-03-10T00:00:00Z"
}
```

> 原始设计中无此字段。新增理由：workflow-orchestrator 的中断恢复依赖此数据，JSON 化后可被 CLI 直接解析。

### 4.14 Extensions（扩展字段）

```json
"extensions": {}
```

允许未来插件或功能扩展写入此字段，不影响核心 Schema 兼容性。

### 4.15 枚举汇总

```json
{
  "RunStatus": ["running", "paused", "completed"],
  "WorkflowStage": [
    "document_conversion", "analysis", "task_decomposition",
    "coding", "review", "bug_fix", "build_verification", "completed"
  ],
  "StageStatus": ["pending", "in_progress", "completed"],
  "TaskStatus": ["pending", "in_progress", "completed", "blocked"],
  "BugSeverity": ["critical", "high", "medium", "low"],
  "BugSource": ["self_review", "user_feedback", "mcp_review", "testing"],
  "BugStatus": ["open", "fixed"],
  "ReviewType": ["self-review", "mcp-review", "human-review"],
  "ReviewResult": ["pass", "fail"],
  "IssueSeverity": ["critical", "warn", "info"],
  "DeviationStatus": ["open", "resolved"],
  "DeviationRootCauseCategory": [
    "rule_missing",
    "context_insufficient",
    "ai_hallucination",
    "reference_copy_blindly",
    "spacing_judgment_error",
    "requirement_misunderstanding",
    "multi_round_not_converge",
    "process_omission",
    "other"
  ],
  "DeviationCategory": [
    "ui_spacing",
    "layout_structure",
    "component_usage",
    "i18n_requirement",
    "cache_flow",
    "process_omission",
    "other"
  ],
  "FileChangeType": ["created", "modified", "deleted"],
  "TimelineEventType": [
    "prd_conversion", "analysis_started", "analysis_completed",
    "task_split", "coding_started", "coding_completed",
    "review_created", "bug_fix", "deviation_record",
    "build_verified", "rule_sedimented", "component_extraction"
  ],
  "EventType": [
    "task_created", "task_completed",
    "bug_created", "bug_fixed",
    "deviation_created", "deviation_resolved",
    "review_created", "rule_sedimented",
    "workflow_stage_changed", "build_verified"
  ]
}
```

---

## 第五步：aiDevOS CLI 命令设计

### 5.1 初始化命令

```bash
# 初始化 aiDevOS（在项目根目录执行）
aida init

# 执行内容：
# 1. 创建 .aida/ 目录结构
# 2. 扫描项目技术栈，生成 config.json
# 3. 生成通用 skills/ 和 rules/ 占位
# 4. 提示用户补充项目规范
# 等价于原项目的 dev-flower 母 Skill
```

### 5.2 需求生命周期命令

```bash
# 创建新需求运行
aida run create <feature-id>
# → 创建 runs/<feature-id>/<developer>/ 目录 + 初始化模板文件

# 查看当前运行状态
aida run status
# → 读取 context.md + process.md，显示当前阶段和进度

# 恢复中断的运行
aida run resume
# → 读取 context.md，从中断点继续执行
```

### 5.3 流程编排命令

```bash
# 启动完整工作流（等价于 /workflow-orchestrator）
aida workflow start
# → PRD → Analysis → Task → Code → Review → 循环直到完成

# 执行单个阶段
aida workflow step <stage>
# stage: analyze | split | code | review | fix

# 示例：
aida workflow step analyze   # 等价于 /analyze
aida workflow step split     # 等价于 /split
aida workflow step code      # 等价于 /gen
aida workflow step review    # 等价于 /self-reviewer
aida workflow step fix       # 等价于 /bug-fixer
```

### 5.4 辅助命令

```bash
# 文档转换
aida convert <file.docx> [output.md]
# 等价于 /docx

# 记录偏差
aida deviation <description>
# 等价于 /deviation

# 生成数据看板
aida dashboard
# 等价于 /dashboard

# 提交代码
aida commit
# 等价于 /commit-code

# MCP 高级审查
aida mcp-review
# 等价于人工触发 mcp-reviewer

# 规则演进
aida rules evolve
# 等价于 /evolve

# 项目审计
aida audit
# 等价于 /audit
```

### 5.5 数据查询命令

```bash
# 查看任务进度
aida tasks [--stage <n>] [--status pending|completed]

# 查看 Bug 列表
aida bugs [--status open|fixed]

# 查看偏差统计
aida deviations [--category] [--root-cause]

# 查看自检历史
aida reviews [--result pass|fail]

# 导出运行数据（JSON）
aida export [--format json|csv]
```

### 5.6 CLI 与 Skill 的映射关系

| CLI 命令 | 原 Skill | 原触发词 |
|---------|----------|----------|
| `aida init` | `dev-flower` | `/dev` |
| `aida workflow start` | `workflow-orchestrator` | `/workflow-orchestrator` |
| `aida workflow step analyze` | `requirement-analyzer` | `/analyze` |
| `aida workflow step split` | `task-splitter` | `/split` |
| `aida workflow step code` | `code-generator` | `/gen` |
| `aida workflow step review` | `self-reviewer` | `/self-reviewer` |
| `aida workflow step fix` | `bug-fixer` | `/bug-fixer` |
| `aida convert` | `docx-to-markdown` | `/docx` |
| `aida deviation` | `deviation-recorder` | `/deviation` |
| `aida dashboard` | `dashboard-generator` | `/dashboard` |
| `aida commit` | `commit-code` | `/commit-code` |
| `aida mcp-review` | `mcp-reviewer` | 人工 |
| `aida rules evolve` | `rules-evolver` | `/evolve` |
| `aida audit` | `audit` | `/audit` |

---

## 附录：通用化 Skill 提取说明

以下是从当前项目 Skill 中去除项目特性后的通用 SOP 能力总结。每个 Skill 的通用化改造要点：

### 需要去除的项目特性

| 原项目特性 | 通用化替代 |
|-----------|-----------|
| `PageLayout / FormJ / Table` 组件名 | 由 `rules/component-usage.md` 配置 |
| `/@/` 路径别名 | 由 `rules/coding-style.md` 配置 |
| Vue 3 + Element Plus 技术栈 | 由 `config.json` 声明，Skill 读取 |
| `src/views/` 目录约定 | 由 rules 配置 |
| `zh-cn.ts / en.ts` i18n 结构 | 由 `rules/i18n-rule.md` 配置 |
| `message-center-admin-frontend` Skill | 项目专属，不提取 |

### 通用化后的 Skill 核心逻辑

每个 Skill 保留的是 **流程逻辑和数据契约**，项目特定的技术细节通过读取 `rules/` 动态获取：

1. **workflow-orchestrator**：流程编排 + 中断恢复逻辑（不变）
2. **requirement-analyzer**：PRD → 结构化分析模板（输出模板不变，检查维度从 rules 读取）
3. **task-splitter**：分析报告 → checklist 任务清单（拆分维度从 rules 读取）
4. **code-generator**：读 task → 加载 rules → 生成代码 → 标记完成（规范约束从 rules 读取）
5. **self-reviewer**：全维度自检（检查维度从 rules 动态构建）
6. **bug-fixer**：定位 → 修复 → 记录 bugTask.md（强制记录逻辑不变）
7. **deviation-recorder**：记录偏差 → 修复 → 沉淀规则（数据格式不变）
8. **dashboard-generator**：扫描数据文件 → 生成 HTML 看板（数据源约定不变，样式可配置）
9. **commit-code**：git 操作流程（完全通用，无需改造）
10. **docx-to-markdown**：文档转换（完全通用，无需改造）
11. **mcp-reviewer**：深度审计框架（输出目录约定不变）
12. **rules-evolver**：规则维护框架（操作对象从 `.cursor/rules/` 改为 `.aida/rules/`）
13. **dev-flower**：母 Skill → 初始化脚手架（目标目录改为 `.aida/`）
14. **audit**：代码与规则一致性审计（扫描目标改为 `.aida/`）
