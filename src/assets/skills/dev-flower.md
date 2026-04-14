---
name: dev-flower
description: 母 Skill，用于初始化 aiDevOS 开发流程：生成 Skill 文件、Rules 占位、需求目录结构。现已由 `aida init` CLI 命令替代。
globs: []
---

# dev-flower (初始化生成器 / 母 Skill)

> **注意**：此 Skill 的功能已由 `npx aida init` CLI 命令替代。以下文档保留作为参考。

## 角色

你是 aiDevOS 的脚手架生成器。你的职责是扫描当前项目，生成完整的 AI 开发流程基础设施。

## 执行步骤

### 1. 扫描项目

- 读取当前项目源码、依赖和已有规则
- 排除目录：node_modules、dist
- 识别技术栈：框架、UI 组件库、状态管理、路由模式

### 2. 检查已有 Skill

需要生成的 Skill 列表（14 个）：
- workflow-orchestrator
- requirement-analyzer
- task-splitter
- code-generator
- self-reviewer
- bug-fixer
- deviation-recorder
- dashboard-generator
- commit-code
- docx-to-markdown
- mcp-reviewer
- rules-evolver
- dev-flower
- audit

遍历列表：
- 如果 `.aida/skills/[skill_name]/SKILL.md` 已存在 -> 跳过
- 如果不存在 -> 创建

### 3. 创建目录结构

```
.aida/
  skills/               # Skill 定义（14 个）
  rules/                # 项目规范
    iron-rules.md       # 铁律（不可违反）
  runs/                 # 需求运行实例
    [branch_name]/
      [dev_name]/
        run.json        # 单一数据源（所有结构化数据）
        prd.md          # 用户输入的需求文档
        analysis.md     # AI 生成的需求分析报告
  config.json           # 全局配置
```

### 4. 初始化 Rules 文件

在 `.aida/rules/` 下生成 `iron-rules.md`，包含 3 条铁律。

### 5. 初始化需求文件夹

- 创建 `runs/[branch_name]/[dev_name]/` 目录
- 初始化 `run.json`（使用标准模板，包含 meta, summary, tasks, bugs, deviations, reviews, workflow, files, metrics, timeline, events, rules, context, extensions 15 个顶层字段）
- 创建 `prd.md` 和 `analysis.md` 占位文件

### 6. 生成 config.json

```json
{
  "schemaVersion": "1.0",
  "aiTool": "claude-code | cursor",
  "project": "项目名称"
}
```

### 7. 完成提示

- 输出已生成的 Skill 列表
- 提示用户补充 rules 内容
- 提示用户使用 `workflow-orchestrator` 开始开发闭环
