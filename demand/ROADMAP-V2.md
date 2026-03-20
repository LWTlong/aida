# AIDevOS v2 Feature Roadmap

> 本文档基于产品讨论梳理，记录 v1 验收后的迭代功能点。按优先级排列。

---

## Phase 2-A：数据可靠性（最高优先级）

解决核心硬伤：AI 直接编辑 JSON 可能写坏结构。

### F-001：`aidevos log` 命令族

**背景**：当前 Skill 指导 AI 直接读写 run.json，AI 可能漏字段、写错类型、破坏 JSON 结构。需要一个 CLI 中间层，AI 只负责传参数，CLI 负责校验和写入。

**子命令清单**：

| 子命令 | 功能 | 示例 |
|--------|------|------|
| `aidevos log task` | 新增任务 | `--title "创建类型定义" --stage "基础设施" --prd-phase "PRD1"` |
| `aidevos log task-done` | 标记任务完成 | `--id TASK-01` |
| `aidevos log bug` | 记录 Bug | `--title "API 格式错误" --severity high --source self-review` |
| `aidevos log bug-fix` | 标记 Bug 修复 | `--id BUG-01 --fix "修改响应解析"` |
| `aidevos log deviation` | 记录偏差 | `--title "组件用错" --ai-output "Dialog" --expected "Drawer" --root-cause rule-missing --category component-usage` |
| `aidevos log review` | 记录自检结果 | `--task-id TASK-01 --result pass --scope "src/components/"` |
| `aidevos log rule` | 记录规则沉淀 | `--content "弹窗用 Drawer" --source-deviation DEV-01` |
| `aidevos log file` | 记录文件变更 | `--path "src/api/user.ts" --change-type modified --lines-added 50 --lines-removed 10` |

**技术要求**：
1. 自动定位当前分支 + 开发者对应的 run.json
2. 参数解析 → 构建 JSON 对象
3. Schema 校验：必填字段、枚举值合法性、类型检查
4. 原子写入：读取 → 追加到对应数组 → 自动递增 ID（TASK-XX, BUG-XX, DEV-XX, REV-XX, RULE-XX）→ 写回
5. 自动更新 `summary` 统计字段（totalTasks, completedTasks, bugCount 等）
6. 自动追加 `timeline[]` 和 `events[]` 事件记录
7. CLI 输出确认：`✓ Added TASK-03: 创建类型定义`

**Skill 改造**：所有 Skill 的 SKILL.md 中，将"直接编辑 run.json"的指令改为"执行 `aidevos log xxx` 命令"。AI 出错的面从"编辑整个 JSON 文件"缩小到"传对几个字符串参数"。

**验收标准**：
- [ ] 所有子命令参数解析正确
- [ ] Schema 校验拦截非法输入（缺失必填字段、无效枚举值）
- [ ] ID 自动递增，不重复
- [ ] summary 统计实时同步
- [ ] timeline/events 自动追加
- [ ] 并发写入不丢数据（文件锁或写入重试）

---

### F-002：Skill 指令精简

**背景**：上下文过长时 AI 可能"忘掉" Skill 中的 SOP。需要精简指令，铁律前置。

**改造要点**：
1. 每个 Skill 的 SKILL.md 前 5 行必须是"必须做"的核心指令
2. 详细说明放在后半部分
3. 关键写入操作改为调用 `aidevos log` 命令（F-001 完成后）
4. 增加 checkpoint 确认语句：`完成写入后输出 "✓ run.json updated: [字段]"`

**验收标准**：
- [ ] 每个 Skill 的核心指令在前 5 行
- [ ] 所有数据写入指令改为 `aidevos log` 调用
- [ ] 包含 checkpoint 确认输出

---

## Phase 2-B：报告生成

### F-003：`/report` 快捷指令 + `report-generator` Skill

**背景**：有了结构化的开发数据，最直接的价值是自动生成周报/月报/绩效。开发者最痛的点是"想不起来自己做了什么"，run.json 帮你记住了一切。

**支持的报告类型**：

| 类型 | 触发方式 | 数据范围 | 输出内容 |
|------|---------|---------|---------|
| 周报 | `/report weekly` | 本周所有 run | 完成任务、Bug 修复、偏差记录、规则沉淀、代码量、时长 |
| 月报 | `/report monthly` | 本月所有 run | 同上 + 月度趋势对比 |
| 绩效汇报 | `/report performance` | 指定时间范围（H1/H2/全年） | 项目贡献、AI 效能指标、规则沉淀、偏差率趋势 |
| 项目复盘 | `/report retrospective` | 单个 run 全量数据 | 开发过程叙事、关键决策、偏差分析、经验总结 |

**数据来源映射**：

| 报告字段 | run.json 路径 |
|---------|--------------|
| 完成了哪些任务 | `tasks[].title` + `tasks[].status` + `tasks[].stageName` |
| 修了多少 Bug | `bugs[]` 聚合 |
| 发现多少偏差 | `deviations[]` 聚合 |
| 沉淀多少规则 | `rules[]` 聚合 |
| 代码变更量 | `summary.filesChanged`, `summary.linesAdded/Removed` |
| 开发时长 | `meta.startTime` / `meta.endTime` 计算 |
| AI 模型信息 | `meta.aiModel` |
| 偏差率 | `metrics.aiDeviationRate` |
| 自检通过率 | `metrics.reviewPassRate` |

**模板机制**：
- 内置默认模板（中文、英文各一套）
- 用户可自定义模板，放在 `.aidevos/templates/report-weekly.md` 等位置
- Skill 读取模板 → 填充数据 → 输出 Markdown

**示例输出（周报）**：

```markdown
# 周报 - 2026.03.06 ~ 2026.03.12

## 本周完成

### feature/user-management
- 完成用户管理模块开发（8/12 任务）
- 修复 2 个 Bug，记录 3 条 AI 偏差
- 沉淀 2 条规则到项目规范
- 使用模型：Claude Sonnet 4，偏差率 25%

## 数据统计

| 指标 | 数值 |
|------|------|
| 完成任务 | 8 |
| Bug 修复 | 2 |
| 偏差记录 | 3 |
| 规则沉淀 | 2 |
| 文件变更 | 15 files (+680 / -120) |
| 开发时长 | 6h 30m |
```

**示例输出（绩效）**：

```markdown
# H1 绩效汇报 - 2026.01 ~ 2026.06

## 开发概览

- 参与 12 个需求开发，全部使用 AI 辅助（AIDevOS SOP 流程）
- 累计完成 156 个任务，修复 23 个 Bug
- 记录 45 条 AI 偏差，沉淀 18 条项目规则
- 代码变更：89 files (+12,400 / -3,200)

## AI 效能趋势

| 月份 | 偏差率 | 规则累计 | 自检通过率 |
|------|--------|---------|-----------|
| 1月 | 35% | 3 | 65% |
| 2月 | 28% | 7 | 72% |
| 3月 | 22% | 11 | 80% |
| 4月 | 18% | 14 | 85% |
| 5月 | 12% | 17 | 91% |
| 6月 | 10% | 18 | 93% |

> 偏差率从 35% 下降到 10%，验证了规则沉淀机制的有效性。
```

**验收标准**：
- [ ] 新增 `report-generator` Skill（第 15 个 Skill）
- [ ] 注册为 `/report` 快捷指令
- [ ] 支持 weekly / monthly / performance / retrospective 四种类型
- [ ] 正确聚合当前项目所有 run.json 数据
- [ ] 输出格式化的 Markdown 文本
- [ ] 支持用户自定义模板（从 `.aidevos/templates/` 读取）

---

### F-004：`aidevos start --model` 参数

**背景**：`meta.aiModel` 字段当前为空字符串。模型对比功能需要此字段有值。

**实现**：
```bash
aidevos start --model claude-sonnet-4
aidevos start --model gpt-4o
aidevos start --model claude-opus-4
```

**逻辑**：
- `--model` 参数可选，传入时写入 `meta.aiModel`
- 不传时保持空字符串，Skill 执行时可由 AI 自动填写
- 常见模型名支持简写映射（如 `sonnet` → `claude-sonnet-4`）

**验收标准**：
- [ ] `--model` 参数正确解析并写入 run.json
- [ ] 不传时不报错，保持空字符串

---

## Phase 3-A：Dashboard 增强

### F-005：Timeline Replay（开发过程回放）

**背景**：一个需求开发了半个月，想直观看到数据是怎么一步步增长的。比如任务从 0 到 12，Bug 从 0 到 3 再回到 0，偏差逐步被发现和修复。

**交互设计**：
- Dashboard 底部增加时间轴控制栏
- 控件：播放按钮 | 暂停按钮 | 进度滑块 | 倍速选择（1x / 2x / 5x / 10x）
- 滑块范围：从 `meta.startTime` 到 `meta.endTime`（或当前时间）

**回放逻辑**：
1. 将 `events[]` 按 `time` 字段排序
2. 播放时设置定时器，每帧推进一个事件
3. 根据事件类型增量更新：
   - `task_created` → totalTasks++
   - `task_completed` → completedTasks++
   - `bug_created` → bugCount++
   - `bug_fixed` → bugCount 状态更新
   - `deviation_created` → deviationCount++
   - `review_created` → reviewCount++, passCount/failCount++
   - `rule_sedimented` → rulesSedimented++
4. KPI 卡片数值动态递增
5. 图表数据逐步填充
6. 拖拽滑块时立即跳转到该时间点的累计状态

**技术方案**：
- 纯前端实现，不需要后端额外接口
- events[] 作为"事件源"，累计计算出任意时间点的状态快照
- 使用 `requestAnimationFrame` 实现平滑动画
- 图表使用 ECharts 的 `setOption` 增量更新

**验收标准**：
- [ ] 时间轴控制栏 UI 正常显示
- [ ] 播放/暂停/拖拽/倍速功能正常
- [ ] KPI 数值随时间推进逐步增长
- [ ] 图表数据随时间推进逐步填充
- [ ] 拖拽滑块能立即定位到该时间点状态
- [ ] 无事件数据时隐藏回放控件

---

### F-006：Model Comparison（AI 模型对比）

**背景**：不是你说 Claude 准就是准了，有人觉得 GPT 更好用。在相同 rules 和标准 SOP 下，用数据说话。AIDevOS 的标准化 Skill 提供了控制变量，使对比有意义。

**使用场景**：
- 开发者评估：同一项目用 Claude Sonnet 和 GPT-4o 分别跑一个 run，对比偏差率
- 团队决策：如果偏差率差不多，是否可以用 token 更经济的模型？
- 模型升级评估：新版本模型是否比旧版本表现更好？

**数据来源**：
- 从所有 run.json 中，按 `meta.aiModel` 分组聚合
- 前提：同一个项目的 rules 是共享的，SOP（Skill）是标准的

**Dashboard 新视图 — "Models"**：

在顶部 Run Selector 旁新增视图选项：
```
[All Runs] [Models] [Trends] [Team] | feature/xxx (running)
```

**对比维度 & 图表**：

| 对比维度 | 计算方式 | 图表类型 |
|---------|---------|---------|
| 偏差率 | sum(deviationCount) / sum(totalTasks) | 分组柱状图 |
| Bug 率 | sum(bugCount) / sum(totalTasks) | 分组柱状图 |
| 自检通过率 | sum(reviewPassCount) / sum(reviewCount) | 分组柱状图 |
| 首次通过率 | avg(firstPassRate) | 分组柱状图 |
| 平均任务耗时 | avg(avgTaskTimeSeconds) | 分组柱状图 |
| 综合雷达图 | 上述 5 个维度归一化 | 雷达图（每个模型一条线） |

**结论区**：
- 自动生成文字总结，如："在当前项目规则下，Claude Sonnet 4 偏差率 (12%) 低于 GPT-4o (18%)，但平均任务耗时更长 (45s vs 32s)。"
- 不做主观推荐，只展示数据

**验收标准**：
- [ ] "Models" 视图正常切换
- [ ] 按 aiModel 分组聚合数据正确
- [ ] 分组柱状图对比 5 个维度
- [ ] 雷达图多模型叠加显示
- [ ] 结论区自动生成数据摘要
- [ ] 无模型数据时（aiModel 为空）提示用户填写

---

### F-007：Temporal Trends（跨周期趋势分析）

**背景**：3 月偏差率 30%，持续沉淀规则后 4 月降到 15%。规则沉淀到底有没有效？用数据证明。这是 AIDevOS 飞轮效应的可视化证据。

**Dashboard 新视图 — "Trends"**：

**图表 1：偏差率趋势**
- X 轴：时间（按周或月分组，自动判断）
- Y 轴（左）：偏差率 %（柱状图）
- Y 轴（右）：规则累计数量（折线图）
- 核心洞察：规则数量上升时，偏差率是否下降？

**图表 2：质量指标趋势**
- X 轴：时间
- 多条折线：偏差率、Bug 率、自检通过率
- 展示整体质量趋势

**图表 3：效率趋势**
- X 轴：时间
- 折线：平均任务耗时
- 展示 AI 开发效率是否提升

**数据来源**：
- 跨 run 聚合，按 `meta.startTime` 的月份/周分组
- 每个时间段取该段内所有 run 的聚合 metrics

**验收标准**：
- [ ] "Trends" 视图正常切换
- [ ] 按时间分组聚合正确
- [ ] 偏差率 + 规则累计双轴图
- [ ] 质量指标多线趋势图
- [ ] 效率趋势图
- [ ] run 数量少于 2 时提示"数据不足"

---

### F-008：Team Overview（团队视图）

**背景**：Leader 想看整个项目每个人干了啥，不用一个个问。标准 SOP 下数据可比，但只做展示不做排名，避免内卷导向。

**Dashboard 新视图 — "Team"**：

**开发者列表**：

| 列 | 数据来源 |
|----|---------|
| 开发者名称 | `meta.developer` |
| Run 数量 | 按 developer 分组的 run 计数 |
| 总任务完成 | sum(completedTasks) |
| 偏差率 | sum(deviationCount) / sum(totalTasks) |
| 规则沉淀 | sum(rulesSedimented) |
| 自检通过率 | sum(reviewPassCount) / sum(reviewCount) |
| 总开发时长 | sum(totalDevelopmentTimeSeconds) |

**交互**：
- 点击某开发者 → 展开该开发者所有 run 的列表
- 点击某个 run → 跳转到该 run 的详情视图

**注意事项**：
- 不做排名，不标红标绿
- 只是客观数据展示
- 开发者自己也能看到自己的数据趋势

**验收标准**：
- [ ] "Team" 视图正常切换
- [ ] 按 developer 分组聚合正确
- [ ] 开发者列表表格正常渲染
- [ ] 点击展开 run 列表
- [ ] 点击 run 跳转到详情

---

## Phase 3-B：高级功能

### F-009：`aidevos compare` 命令

**背景**：CLI 中快速对比两次 run 的数据差异。

```bash
aidevos compare feature/v1 feature/v2
aidevos compare --model claude-sonnet-4 --model gpt-4o
```

**输出**：
```
  Run Comparison

  Metric              feature/v1    feature/v2    Delta
  ─────────────────────────────────────────────────────
  Tasks               12            15            +3
  Deviation Rate      25%           12%           -13% ↓
  Bug Rate            16%           6%            -10% ↓
  Review Pass Rate    70%           90%           +20% ↑
  Rules Sedimented    3             8             +5
  Dev Time            4h 20m        3h 10m        -1h 10m ↓
```

**验收标准**：
- [ ] 支持按 run ID 对比
- [ ] 支持按模型对比（聚合同模型的所有 run）
- [ ] 终端表格格式化输出
- [ ] Delta 列标注增减方向和颜色

---

### F-010：数据完整性保障

**背景**：除了 F-001 的 CLI 写入，还需要额外的数据保护。

**功能点**：
1. **run.json 读取容错**：字段缺失给默认值，结构异常跳过而非崩溃（现有 api.ts 加强）
2. **`aidevos doctor`**：检查 run.json 结构完整性，修复常见问题（缺失字段补充默认值、summary 重算）
3. **run.json 备份**：每次 `aidevos log` 写入前，备份当前版本到 `.aidevos/runs/[branch]/[dev]/run.json.bak`

**验收标准**：
- [ ] 读取缺失字段不崩溃
- [ ] `aidevos doctor` 扫描并报告问题
- [ ] 自动修复可修复的问题
- [ ] 写入前备份

---

### F-011：Dashboard Demo 数据

**背景**：推广时需要让用户 clone 后立即看到完整 Dashboard，而不是空页面。这是转化率的关键。

**实现**：
- 仓库中内置一份真实的示例 run.json（基于真实项目数据脱敏）
- 示例数据包含：10+ 个任务、3 个 Bug、5 条偏差、多条 review、规则沉淀、完整 timeline
- `aidevos dashboard --demo` 命令直接用内置数据启动 Dashboard

**验收标准**：
- [ ] 内置示例 run.json 数据完整
- [ ] `--demo` 参数正常加载示例数据
- [ ] Dashboard 所有图表都有数据展示

---

## 功能依赖关系

```
F-001 (aidevos log)
  ↓
F-002 (Skill 精简) ← 依赖 F-001
  ↓
F-003 (/report) ← 可独立做，但 F-001 完成后数据更可靠
F-004 (--model) ← 独立
  ↓
F-005 (Replay) ← 依赖 events[] 有数据（F-001 保证质量）
F-006 (Model Compare) ← 依赖 F-004（aiModel 有值）
F-007 (Trends) ← 依赖多个 run 有数据
F-008 (Team) ← 依赖多开发者有数据
  ↓
F-009 (compare CLI) ← 独立
F-010 (doctor) ← 独立
F-011 (demo data) ← 独立，但推广前必须完成
```

## 优先级排序

| 优先级 | 功能 | 原因 |
|--------|------|------|
| P0 | F-001 aidevos log | 解决数据可靠性硬伤，是其他一切的基础 |
| P0 | F-004 --model 参数 | 极小改动，模型对比的前提 |
| P1 | F-003 /report | 最直接的用户价值（帮写周报/绩效），拉新杀手锏 |
| P1 | F-002 Skill 精简 | 配合 F-001 改造 |
| P1 | F-011 Demo 数据 | 推广前必须有，决定用户第一印象 |
| P2 | F-005 Replay | Dashboard 差异化功能，演示效果好 |
| P2 | F-006 Model Compare | 叙事价值大，但需要多模型 run 数据积累 |
| P2 | F-007 Trends | 飞轮效应可视化，长期价值 |
| P3 | F-008 Team | 面向团队场景，用户基数增长后再做 |
| P3 | F-009 compare CLI | Dashboard 已有可视化对比，CLI 是补充 |
| P3 | F-010 doctor | 防御性功能，可后置 |

---

## 数据 Schema 扩展备注

当前 run.json 模板中需要关注的字段：

| 字段 | 当前状态 | v2 需要 |
|------|---------|--------|
| `meta.aiModel` | 存在，空字符串 | F-004 填充，F-006 依赖 |
| `events[]` | 存在，空数组 | F-001 自动追加，F-005 依赖 |
| `events[].type` | 已定义枚举 | 足够用 |
| `events[].time` | ISO8601 | F-005 回放依赖精确时间戳 |
| `timeline[]` | 存在，空数组 | F-001 自动追加 |
| `rules[].createdAt` | 存在 | F-007 趋势依赖 |
| `meta.developer` | 存在 | F-008 团队视图依赖 |

**结论**：当前 v1 的数据 schema 已经能支撑所有 v2 功能，不需要 breaking change。只需要确保数据被正确填充。
