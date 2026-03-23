---
name: dashboard-generator
description: 根据 run.json 数据自动生成/更新数据看板。现已由 `aida dashboard` CLI 命令替代（实时 Web Dashboard）。
globs: ['.aidevos/runs/*/*/run.json']
---

# dashboard-generator (数据看板生成器)

> **注意**：此 Skill 的功能已由 `aida dashboard` CLI 命令替代。CLI 命令启动本地 HTTP Server + SSE 实时推送，提供更好的可视化体验。以下文档保留作为参考。

## 角色

你是一个数据可视化专家。你的职责是读取 `run.json` 中的所有结构化数据，提取关键指标，生成或更新一份美观的 ECharts 深色主题数据看板（单文件 HTML）。

## 路径约定

> **[run_id]**：当前需求/功能的唯一标识
> **[dev_name]**：通过 `git config user.name` 获取，转全小写并用 `-` 替换空格。
> **数据根目录**：`.aidevos/runs/[run_id]/[dev_name]/`
> **数据源**：`run.json`（单一数据源）

## 数据源 (run.json 字段映射)

| JSON Path | 提取内容 |
|-----------|---------|
| `summary.totalTasks` / `summary.completedTasks` | 任务完成进度 |
| `workflow[]` | 阶段数、各阶段状态 |
| `deviations[]` | 偏差总数、根因分类、类别分布、涉及文件 |
| `bugs[]` | 缺陷总数、涉及文件 |
| `reviews[]` | 自检次数、通过/未通过数 |
| `files[]` | 文件变更数、热点文件 |
| `rules[]` | 已沉淀规则列表 |
| `meta.startTime` / `meta.endTime` | 开发周期 |
| `timeline[]` | 事件时间线 |

## 看板结构

### KPI 卡片行（6 列，可点击查看详情）

| 卡片 | 数据来源 | 颜色 |
|------|---------|------|
| Tasks Completed | summary.completedTasks / summary.totalTasks | green |
| Stage Progress | workflow 中 completed 数 / workflow 总数 | blue |
| Deviations | summary.deviationCount | orange |
| Bugs | summary.bugCount | red |
| Review Pass Rate | summary.reviewPassCount / summary.reviewCount | purple |
| Files Changed | summary.filesChanged | cyan |

### 图表区域

| 图表 | 类型 | 数据源 |
|------|------|--------|
| 各阶段任务完成情况 | horizontal bar | tasks[]（按 stageName 分组） |
| 偏差根因分析 | pie (donut) | deviations[]（按 rootCauseCategory 分组） |
| 偏差类别分布 | horizontal bar | deviations[]（按 deviationCategory 分组） |
| 文件修改热点 | horizontal bar | files[]（按 changeCount 排序） |
| 偏差与规则趋势 | bar + line (双轴) | deviations[] 数量 + rules[] 累计数 |
| 开发时间线 | timeline | timeline[] |

## 技术要求

- **ECharts CDN**：`https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`
- **深色主题**：背景 `#0f1923`，卡片 `#162231`，边框 `#1e2d3d`，文字 `#e0e6ed`
- **响应式**：`window.addEventListener('resize', ...)` 让图表自适应
- **无外部依赖**：除 ECharts CDN 外不依赖其他库
