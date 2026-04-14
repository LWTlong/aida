# run.json Schema Review

> Historical schema review note. Current runtime and asset-management behavior is documented in [README.md](../README.md) and [COMMANDS.md](../COMMANDS.md).

> 基于 MTR-2995-temporary 真实运行数据（37 tasks / 5 bugs / 23 deviations / 4 reviews）逐字段审查。

---

## 1. Meta - 建议补充

当前设计已覆盖核心字段，建议补充：

| 字段 | 理由 | 来源 |
|------|------|------|
| `prdPhases` | 真实项目存在 PRD1/PRD2/PRD3 三轮迭代，每轮都有独立的分析-拆分-编码循环 | process.md |
| `rulesDir` | 规则文件目录路径，不同项目可能不同 | config.json |

```json
"meta": {
  "schemaVersion": "1.0",
  "runId": "FEATURE-001",
  "project": "example-project",
  "developer": "vito-long",
  "branch": "feature/FEATURE-001",
  "aiModel": "claude",
  "aiTool": "claude-code",
  "startTime": "2026-03-12T10:00:00Z",
  "endTime": null,
  "status": "running",
  "prdPhases": ["PRD1", "PRD2", "PRD3"]
}
```

---

## 2. Summary - 建议补充

缺少在真实项目中被重点追踪的指标：

| 缺失字段 | 理由 | 真实数据 |
|----------|------|---------|
| `reviewPassCount` | 区分通过/未通过，不能只有 reviewCount | 3 PASS / 1 FAIL |
| `reviewFailCount` | 同上 | |
| `rulesSedimented` | 偏差沉淀规则数是 aiDevOS 的核心价值指标 | 4 条规则 |
| `prdPhaseCount` | PRD 迭代轮数 | 3 |

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

---

## 3. Workflow - 需要结构调整

### 问题 1：阶段枚举不完整

当前只有 `analysis`、`task_decomposition`、`coding`。真实流程中还有：

| 缺失阶段 | 对应 Skill | 真实项目中是否运行 |
|----------|-----------|-----------------|
| `document_conversion` | docx-to-markdown | 是（PRD.docx → prd.md） |
| `review` | self-reviewer | 是（4 次） |
| `bug_fix` | bug-fixer | 是（5 次） |
| `build_verification` | - | 是（yarn build 验证） |

建议 stage 枚举值：
```
document_conversion | analysis | task_decomposition | coding | review | bug_fix | build_verification | completed
```

### 问题 2：缺少 PRD 阶段分组

真实项目中，workflow 不是线性一次性的，而是**多轮 PRD 迭代**，每轮都有自己的 analysis → task → coding → review 循环。

建议增加 `prdPhase` 字段：

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
    "stage": "coding",
    "prdPhase": "PRD1",
    "status": "completed",
    "startTime": "2026-03-06T00:00:00Z",
    "endTime": "2026-03-06T00:00:00Z"
  },
  {
    "stage": "analysis",
    "prdPhase": "PRD2",
    "status": "completed",
    "startTime": "2026-03-09T00:00:00Z",
    "endTime": "2026-03-09T00:00:00Z"
  }
]
```

---

## 4. Tasks - 缺少关键字段

对比真实 task.md，缺失：

| 缺失字段 | 理由 | 真实数据示例 |
|----------|------|-------------|
| `stageIndex` | 任务属于哪个阶段（数字） | 11 |
| `stageName` | 阶段名称 | "统一 API 类型定义" |
| `acceptance` | 验收标准，每个任务都有 | "类型文件可正常导入，无 TS 报错" |
| `prdPhase` | 属于哪轮 PRD | "PRD3" |

`priority` 在真实流程中**未使用**，任务按 stageIndex 顺序执行，建议改为可选或移除。

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

---

## 5. Bugs - 缺少关键字段

对比真实 bugTask.md（BUG-01 ~ BUG-05），缺失：

| 缺失字段 | 理由 | 真实数据示例 |
|----------|------|-------------|
| `source` | Bug 来源（self_review / user_feedback / testing） | "user_feedback" |
| `files` | 涉及文件列表 | ["pushTemplate/form.vue", "smsTemplate/form.vue"] |
| `fix` | 修复方案描述 | "移除 template-form-header 及对应样式" |
| `prdPhase` | 属于哪轮 PRD | "PRD2" |
| `ruleSedimented` | 修复后是否沉淀了规则 | ".cursor/rules/component-usage.md" |

`relatedTask` 在真实数据中未使用（Bug 通常与整个模块相关而非单个 task）。建议改为可选。

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

---

## 6. Deviations - 差距最大，需要重构

这是 aiDevOS 区别于普通开发工具的**核心数据结构**。当前设计过于简化，与真实 deviationTask.md（23 条记录）差距很大。

### 缺失的关键字段

| 缺失字段 | 重要性 | 真实数据示例 |
|----------|--------|-------------|
| `aiOutput` | 核心 | `:formProps=\"{ labelPosition: 'top' }\"` |
| `expectedOutput` | 核心 | `直接 attrs 传递 label-position=\"top\"` |
| `rootCause` | 核心 | "AI 不了解 FormJ 内部使用 $attrs 透传机制" |
| `rootCauseCategory` | 分析用 | "component_api_unknown" |
| `deviationCategory` | 分析用 | "component_usage" |
| `files` | 必要 | ["pushTemplate/form.vue"] |
| `prdPhase` | 必要 | "PRD2" |
| `ruleSedimented` | 核心价值 | { file: "component-usage.md", content: "..." } |

### type 枚举需扩展

当前只有 4 种：`requirement_misunderstanding`、`logic_error`、`rule_violation`、`extra_feature`

真实数据中的根因分类（从 23 条偏差提取）：

| 真实根因 | 出现次数 | 建议枚举值 |
|----------|---------|-----------|
| 规则缺失 / AI 不了解组件 API | 5 | `rule_missing` |
| 盲目照搬参考代码 | 4 | `reference_copy_blindly` |
| 间距/边距判断失误 | 6 | `spacing_judgment_error` |
| 需求理解偏差 | 2 | `requirement_misunderstanding` |
| 多轮未收敛 | 3 | `multi_round_not_converge` |
| 上下文不足 | 2 | `context_insufficient` |
| AI 臆想 | 1 | `ai_hallucination` |

真实数据中的偏差类别：

| 类别 | 出现次数 | 建议枚举值 |
|------|---------|-----------|
| UI/间距 | 8 | `ui_spacing` |
| 布局/结构 | 3 | `layout_structure` |
| 组件使用 | 4 | `component_usage` |
| i18n/需求 | 3 | `i18n_requirement` |
| 缓存/流程 | 2 | `cache_flow` |
| 流程遗漏 | 2 | `process_omission` |
| 其他 | 1 | `other` |

### 建议结构

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

---

## 7. Reviews - 需要丰富结构

当前只有 `issues: 3`（数字），真实 review 日志包含**多维度检查结果**和**结构化问题列表**。

### 缺失字段

| 缺失字段 | 理由 | 真实数据 |
|----------|------|---------|
| `scope` | 审查范围描述 | "阶段 11-16 变更文件（14 个文件）" |
| `prdPhase` | 属于哪轮 PRD | "PRD3" |
| `dimensions` | 每个检查维度的结果 | 架构合规 PASS / API 规范 FAIL / ... |
| `issueList` | 结构化问题列表 | [{severity, file, description, fix}] |

`result` 值应该用 `pass` / `fail` 而非 `issues_found`（语义模糊，有 issues 可能是 WARN 级别仍然 PASS）。

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

---

## 8. Files - 小改进

`changeType` 建议增加 `created`，真实项目中大量新建文件：

```
changeType: "created" | "modified" | "deleted"
```

建议增加可选的 `relatedTo` 字段追踪文件变更的来源（哪个 task/bug/deviation 触发的修改）：

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

---

## 9. Metrics - 建议补充

| 建议新增 | 计算方式 | 价值 |
|----------|---------|------|
| `reviewPassRate` | reviewPassCount / reviewCount | 自检通过率 |
| `firstPassRate` | 首次自检即通过的任务数 / 总任务数 | AI 一次生成质量 |
| `rulesSedimentedCount` | deviation 中 ruleSedimented 非 null 的数量 | 规则沉淀效率 |
| `deviationToRuleRatio` | rulesSedimented / deviationCount | 偏差转化率 |

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

---

## 10. Timeline - OK

结构清晰，建议增加 `prdPhase` 和可选 `detail`：

```json
"timeline": [
  {
    "event": "analysis_completed",
    "time": "2026-03-06T00:00:00Z",
    "prdPhase": "PRD1",
    "detail": "需求分析完成，输出 analysis.md"
  }
]
```

---

## 11. Events - OK

完整事件流设计合理，建议 event type 枚举：

```
task_created | task_completed | bug_created | bug_fixed |
deviation_created | deviation_resolved | review_created |
rule_sedimented | workflow_stage_changed | build_verified
```

---

## 12. 建议新增顶层字段

### 12.1 Rules（沉淀规则追踪）

规则沉淀是 aiDevOS 的核心价值链末端，应独立追踪：

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

### 12.2 Context（工作流恢复点）

用于中断恢复，替代 context.md 的 JSON 化：

```json
"context": {
  "currentPrdPhase": "PRD3",
  "currentTaskId": "TASK-14.2",
  "currentStage": "coding",
  "lastUpdated": "2026-03-10T00:00:00Z"
}
```

---

## 总结：改动优先级

| 优先级 | 字段 | 改动类型 |
|--------|------|---------|
| P0 | deviations 重构 | 补充 aiOutput/expectedOutput/rootCause/rootCauseCategory/deviationCategory/files/ruleSedimented |
| P0 | reviews 丰富 | 补充 dimensions/issueList/scope/prdPhase，result 改为 pass/fail |
| P1 | workflow 增加 prdPhase | 支持多轮 PRD 迭代 |
| P1 | tasks 补充 stageIndex/stageName/acceptance/prdPhase | 对齐真实 task.md 结构 |
| P1 | bugs 补充 source/files/fix/prdPhase/ruleSedimented | 对齐真实 bugTask.md |
| P1 | 新增 rules 顶层字段 | 追踪沉淀规则 |
| P1 | 新增 context 顶层字段 | 中断恢复 JSON 化 |
| P2 | summary 补充 reviewPassCount/rulesSedimented | dashboard 指标完整性 |
| P2 | metrics 补充 reviewPassRate/firstPassRate | AI 质量度量 |
| P2 | meta 补充 prdPhases | 多轮迭代追踪 |
