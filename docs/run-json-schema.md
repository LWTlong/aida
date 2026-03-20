# aiDevOS Run JSON Schema (v1)

该 JSON 文件记录一次 AI 开发运行的完整数据。

文件位置：

.aidevos/runs/{runId}/run.json

---

# 1 Meta 信息

描述当前 run 的基本信息。

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

# 2 Summary（Dashboard 快速统计）

用于 dashboard 快速展示。

```json
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
}
```

---

# 3 Workflow

记录 SOP 阶段执行情况。支持多轮 PRD 迭代，每轮都有独立的 stage 记录。

Stage 枚举：`document_conversion` | `analysis` | `task_decomposition` | `coding` | `review` | `bug_fix` | `build_verification` | `completed`

```json
"workflow": [
  {
    "stage": "document_conversion",
    "prdPhase": "PRD1",
    "status": "completed",
    "startTime": "",
    "endTime": ""
  },
  {
    "stage": "analysis",
    "prdPhase": "PRD1",
    "status": "completed",
    "startTime": "",
    "endTime": ""
  },
  {
    "stage": "coding",
    "prdPhase": "PRD2",
    "status": "running",
    "startTime": "",
    "endTime": null
  }
]
```

---

# 4 Tasks

任务列表。

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
    "createdAt": "",
    "startedAt": "",
    "completedAt": "",
    "files": [
      "src/api/templateManagement/types.ts"
    ]
  }
]
```

---

# 5 Bugs

Bug 记录。

```json
"bugs": [
  {
    "bugId": "BUG-001",
    "title": "form 页面不需要标题（h3）",
    "description": "form 页面顶部不应有独立 h3 标题",
    "severity": "medium",
    "source": "user_feedback",
    "status": "fixed",
    "prdPhase": "PRD2",
    "reportedAt": "",
    "fixedAt": "",
    "fix": "移除 template-form-header 及对应样式",
    "files": [
      "pushTemplate/form.vue",
      "smsTemplate/form.vue"
    ],
    "relatedTask": null,
    "ruleSedimented": null
  }
]
```

Bug source 枚举：`self_review` | `user_feedback` | `mcp_review` | `testing`

---

# 6 Deviations（AI 偏差 — 核心数据结构）

AI 偏差记录，aiDevOS 的核心差异化数据。

```json
"deviations": [
  {
    "deviationId": "DEV-003",
    "title": "FormJ 属性透传方式错误",
    "aiOutput": ":formProps=\"{ labelPosition: 'top' }\"",
    "expectedOutput": "直接 attrs 传递 label-position=\"top\"",
    "rootCause": "AI 不了解 FormJ 内部使用 $attrs 透传机制",
    "rootCauseCategory": "rule_missing",
    "deviationCategory": "component_usage",
    "severity": "medium",
    "prdPhase": "PRD2",
    "status": "resolved",
    "detectedAt": "",
    "resolvedAt": "",
    "files": [
      "pushTemplate/form.vue",
      "smsTemplate/form.vue"
    ],
    "ruleSedimented": {
      "file": ".aidevos/rules/component-usage.md",
      "content": "FormJ 属性必须直接以 attrs 形式传入"
    }
  }
]
```

rootCauseCategory 枚举：

- `rule_missing` — 规则缺失 / AI 不了解组件 API
- `context_insufficient` — 上下文不足
- `ai_hallucination` — AI 臆想不存在的 API/组件
- `reference_copy_blindly` — 盲目照搬参考代码
- `spacing_judgment_error` — 间距/边距判断失误
- `requirement_misunderstanding` — 需求理解偏差
- `multi_round_not_converge` — 多轮修正未收敛
- `process_omission` — 流程/任务遗漏
- `other`

deviationCategory 枚举：

- `ui_spacing` — UI/间距
- `layout_structure` — 布局/结构
- `component_usage` — 组件使用
- `i18n_requirement` — i18n/需求
- `cache_flow` — 缓存/流程
- `process_omission` — 流程遗漏
- `other`

---

# 7 Reviews

Review 记录。

```json
"reviews": [
  {
    "reviewId": "REV-003",
    "type": "self-review",
    "scope": "阶段 11-16 变更文件（14 个文件）",
    "prdPhase": "PRD3",
    "result": "fail",
    "reviewedAt": "",
    "dimensions": [
      { "name": "架构合规性", "result": "pass" },
      { "name": "API 封装规范", "result": "fail", "issues": 1 },
      { "name": "i18n 多语言", "result": "warn", "issues": 1 }
    ],
    "issueList": [
      {
        "issueId": "CRITICAL-01",
        "severity": "critical",
        "file": "src/api/templateManagement/template.ts",
        "description": "无 Mock 数据兜底",
        "fix": "在薄代理层添加 Mock 数据兜底"
      }
    ]
  }
]
```

Review type 枚举：`self-review` | `mcp-review` | `human-review`

Review result 枚举：`pass` | `fail`

---

# 8 Files

文件修改统计。

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

changeType 枚举：`created` | `modified` | `deleted`

---

# 9 Metrics

AI 开发质量指标。

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

# 10 Timeline

开发时间线（简化视图，用于可视化）。

```json
"timeline": [
  {
    "event": "analysis_completed",
    "time": "",
    "prdPhase": "PRD1",
    "detail": "需求分析完成，输出 analysis.md"
  },
  {
    "event": "coding_completed",
    "time": "",
    "prdPhase": "PRD1",
    "detail": "9 项任务全部完成"
  }
]
```

---

# 11 Events

完整事件流（审计级别日志）。

```json
"events": [
  {
    "type": "task_created",
    "time": "",
    "data": {
      "taskId": "TASK-001"
    }
  },
  {
    "type": "rule_sedimented",
    "time": "",
    "data": {
      "deviationId": "DEV-002",
      "ruleFile": "component-usage.md"
    }
  }
]
```

Event type 枚举：
```
task_created | task_completed | bug_created | bug_fixed |
deviation_created | deviation_resolved | review_created |
rule_sedimented | workflow_stage_changed | build_verified
```

---

# 12 Rules（沉淀规则追踪）

```json
"rules": [
  {
    "ruleId": "RULE-001",
    "file": ".aidevos/rules/component-usage.md",
    "content": "编辑页 FormJ 必须 labelPosition: top",
    "sourceDeviation": "DEV-002",
    "sedimentedAt": ""
  }
]
```

---

# 13 Context（工作流恢复点）

用于中断恢复。

```json
"context": {
  "currentPrdPhase": "PRD3",
  "currentTaskId": "TASK-14.2",
  "currentStage": "coding",
  "lastUpdated": ""
}
```

---

# 14 Extensions

允许未来扩展：

```json
"extensions": {}
```

所有插件或未来功能都可以写入 extensions。
