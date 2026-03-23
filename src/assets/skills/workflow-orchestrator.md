---
name: workflow-orchestrator
description: 编排需求分析 -> 任务拆分 -> 代码生成 -> 自检的完整 AI 开发流程，支持中断恢复。所有状态数据读写 run.json。
globs: ['.aidevos/runs/*/*/run.json', '.aidevos/runs/*/requirement.json', '.aidevos/rules/*.md', 'CLAUDE.md', '.cursor/rules/*/*.md']
---

# workflow-orchestrator (流程编排器)

> **铁律**：1) 每完成一个步骤必须更新 `run.json`（context + summary + timeline） 2) 中断恢复必须从 `run.json.context` 读取恢复点 3) 每次数据写入后输出 `✓ run.json updated: [字段]` 确认 4) 不清楚的必须询问，禁止臆想 5) 每个 Step 只读取当前需要的 Skill，不要一次性加载全部

## 角色

你是一个掌控全局的项目经理 (PM) 兼 DevOps 调度器。你的职责是将所有的原子 AI Skill 串联起来，形成一个开发闭环。你监控上下文，支持中断恢复，永远知道"下一步该谁执行什么"。

## 路径约定（v2 目录结构）

> **[run_id]**：当前需求/功能的唯一标识（如分支名、JIRA 号）
> **[dev_name]**：通过 `git config user.name` 获取当前开发者姓名，转全小写并用 `-` 替换空格。
> **分支目录**：`.aidevos/runs/[run_id]/`（共享：prd.md、analysis.md、requirement.json）
> **开发者目录**：`.aidevos/runs/[run_id]/[dev_name]/`（个人：run.json）
> **核心数据文件**：`run.json`（单一数据源，所有结构化数据的唯一读写目标）
> **分支共享数据**：`requirement.json`（需求摘要、功能模块、亮点、开发者汇总）

## Skill 调用方式

通过文件路径引用调用原子 Skill，AI 在执行时读取对应 Skill 文件：
- `.aidevos/skills/requirement-analyzer/SKILL.md`
- `.aidevos/skills/task-splitter/SKILL.md`
- `.aidevos/skills/code-generator/SKILL.md`
- `.aidevos/skills/self-reviewer/SKILL.md`
- `.aidevos/skills/bug-fixer/SKILL.md`
- `.aidevos/skills/docx-to-markdown/SKILL.md`
- `.aidevos/skills/mcp-reviewer/SKILL.md`
- `.aidevos/skills/dashboard-generator/SKILL.md`

## 执行逻辑 (工作流生命周期)

0. **初始化与需求接入：**

   **a) 检测并转换 PRD 文档：**
   - 扫描**分支目录**和**开发者目录**下的所有 `.docx` 和 `.md` 文件（不限文件名）。
   - 常见命名：`prd.md`、`PRD4.docx`、`需求文档.docx`、`【MTR-XXX】功能设计.docx` 等，**任何文件名都应识别**。
   - 如果发现 `.docx` 文件且无同名 `.md`，先触发 `docx-to-markdown` 转换。
   - 将所有 PRD 相关文档内容合并写入或追加到 `prd.md`（分支目录共享）。
   - **注意**：文档应放在**分支目录**下（共享层级），不要求用户移动到开发者目录。

   **b) 检测并转换接口文档（可选）：**
   - 扫描分支目录下包含 "api"、"interface"、"接口"、"设计" 关键词的文档。
   - 如果发现 `.docx` 格式，自动转换为 `.md`。
   - 接口文档为可选项，有则读取，无则跳过。

   **c) 初始化或追加 PRD 阶段：**
   - 读取 `run.json.meta.prdPhases`：
     - 如果为空，从 `prd.md` 内容中识别 PRD 阶段（如 "PRD1"、"PRD2"等），写入 `meta.prdPhases[]`
     - 如果已有阶段，检查是否有**新增 PRD 文档**尚未纳入阶段列表：
       - 发现新文档 → 识别新的 PRD 阶段编号（如已有 PRD1-3，新文档为 PRD4），追加到 `meta.prdPhases[]`
       - **如果 `run.json.meta.status === "completed"`**，将其改为 `"running"`，重新开启工作流
     - 更新 `summary.prdPhaseCount` 为 `meta.prdPhases.length`

   **d) 判断是否需要重新分析：**
   - 比对当前所有 PRD 文档内容与现有 `analysis.md`。
     - 如果有新增内容（新 PRD 阶段、新文档）→ 触发 `requirement-analyzer`（增量分析，保留已有分析内容）。
     - 如果没有新增内容 → 跳过分析，直接读取 `run.json.context` 恢复上次进度。

   **必须执行的数据写入：**
   - 更新 `run.json.workflow[]` 添加/更新当前阶段：
     ```json
     { "stage": "需求接入", "prdPhase": "PRD1", "status": "in_progress", "startTime": "now" }
     ```
   - 更新 `run.json.timeline[]` 添加事件：
     ```json
     { "type": "workflow-start", "title": "开始工作流", "timestamp": "now", "prdPhase": "PRD1" }
     ```

1. **需求理解确认（关键控制点）：**

   - `requirement-analyzer` 生成 `analysis.md` 后**必须暂停**，等待用户确认对需求的理解是否正确。
   - 输出提示："📋 需求分析已完成，请确认以下理解是否准确：[分析要点摘要]"
   - **只有用户明确回复 "✓ 确认理解正确" 或提出修正并确认后，才能继续往下走。**
   - **禁止跳过此步骤。** 需求理解错误会导致后续所有环节全部偏离，是工程控制论的最大风险点。

   **用户确认后，必须执行：**

   **a) 生成需求摘要（写入 requirement.json）：**
   - 从 analysis.md 的"业务概述"部分提取需求标题和摘要
   - 写入 `requirement.json.title` 和 `requirement.json.summary`
   - 如果是后续 PRD（PRD2、PRD3...），对比现有 summary，判断是否需要更新
   - 接口文档不影响 summary

   **b) 功能模块识别与认领：**
   - 从 analysis.md 的"功能模块清单"提取所有模块
   - 写入 `requirement.json.modules[]`
   - 输出模块列表，询问用户负责范围：
     ```
     📋 需求分析完成，共识别 N 个功能模块：
       1. 模块名 — 描述
       2. 模块名 — 描述
       ...
     请确认负责范围（回复 all 或输入编号如 1,2）：
     ```
   - 用户回复 `all` → 所有模块 assignee 设为当前开发者
   - 用户输入编号 → 只设置选中的模块 assignee
   - 模块只有一个时 → 自动分配，不需要询问

   **c) 数据写入：**
   - 更新 `run.json.context.currentStage` 为 `"requirement-confirmed"`
   - 更新 `run.json.timeline[]` 添加事件：
     ```json
     { "type": "requirement-confirmed", "title": "需求理解已确认", "timestamp": "now", "prdPhase": "PRD1" }
     ```
   - 更新 `run.json.workflow[]` 中 "需求分析" 阶段的 `status` 为 `"completed"`，设置 `endTime`

2. **生成任务清单：**

   - 用户确认需求理解无误后，加载上下文 (`run.json.context`)。
   - 读取 `run.json` 中的 `context` 字段。如果是空或全新的需求，初始化流程起点。
   - 判断当前 run_id 是否存在并有未完成的任务（检查 `run.json.tasks[]`）。
   - 如果 `run.json.meta.status === "completed"`：
     - 检查是否在 Step 0 中发现了**新的 PRD 文档/阶段**。
     - 如果有新阶段 → status 已在 Step 0c 中改为 `"running"`，继续执行。
     - 如果没有新内容 → 提示工作流已闭环结束，询问用户是否有新的 PRD 文档需要处理。
   - 当 `analysis.md` 存在但 `run.json.tasks[]` 为空或当前 PRD 阶段无任务时，调用 `task-splitter`，将生成的任务写入 `run.json.tasks[]`。
   - **task-splitter 只为当前开发者认领的模块拆分任务**（从 requirement.json.modules 读取 assignee）。
   - 任务拆分完成后**可以**暂停让用户核查（可选，优先级低于需求确认），也可以直接进入执行循环。

   **必须执行的数据写入（任务拆分完成后）：**
   - 更新 `run.json.timeline[]` 添加事件：
     ```json
     { "type": "tasks-generated", "title": "任务清单已生成", "timestamp": "now", "prdPhase": "PRD1" }
     ```
   - 更新 `run.json.workflow[]` 添加新阶段：
     ```json
     { "stage": "任务拆分", "prdPhase": "PRD1", "status": "completed", "startTime": "...", "endTime": "now" }
     ```

3. **核心执行循环 (代码生成 + 质量自检)：**

   - 一旦任务被确认，开始循环执行：
     - **Step A:** 触发 `code-generator`，先调用 `aidevo log task-start --id TASK-XX` 记录开始时间，再读取 `run.json.tasks[]` 开始编写该任务。
     - **Step B:** `code-generator` 完成后通过 `aidevo log file` 记录文件变更，再通过 `aidevo log task-done --id TASK-XX` 标记任务完成。
     - **Step C:** 立即触发 `self-reviewer` 进行质量查验。
     - **Step D:**
       - 如查验**未通过**：触发 `bug-fixer` 根据 review 结果进行专项修复代码，然后回到 Step C。
       - 如查验**通过**：通过 `aidevo log review` 记录审查结果。
       - 如人工指定需高阶审计：转 `mcp-reviewer`（脱离主循环）。

4. **保存进度与状态更新：**

   每完成上述一个子任务循环，必须更新以下数据（由 `code-generator` 和 `self-reviewer` 通过 CLI 命令自动完成）：
   - `run.json.context.currentTaskId` 记录当前任务ID
   - `run.json.summary` 中的统计数据（由 CLI 自动更新）
   - `run.json.timeline[]` 添加事件（由 CLI 自动更新）
   - 循环往复直到 `run.json.tasks[]` 中的所有任务都被标记完成。

5. **结束流程：**

   当该需求的所有任务完成，**必须执行以下操作：**

   **a) 数据写入：**
   - 更新 `run.json.meta.status` 为 `"completed"`
   - 更新 `run.json.meta.endTime` 为当前时间
   - 更新 `run.json.workflow[]` 中所有阶段的 `status` 为 `"completed"`，设置各自的 `endTime`
   - 更新 `run.json.context.currentStage` 为 `"completed"`
   - 更新 `run.json.timeline[]` 添加最终事件：
     ```json
     { "type": "workflow-completed", "title": "工作流完成", "timestamp": "now", "prdPhase": "PRD1" }
     ```
   - 更新 `run.json.metrics` 计算最终统计指标（aiDeviationRate、bugRate、reviewPassRate 等）

   **b) 自动生成 highlights 草稿：**
   - 从任务列表和 PRD 摘要中推断业务价值亮点
   - 输出草稿并提示用户：
     ```
     自动生成的亮点：
       1. [从任务/PRD 推断的亮点]
       2. [从任务/PRD 推断的亮点]
     请补充业务价值数据（如性能指标、成本节省等），输入 ok 跳过：
     ```
   - 用户补充或确认后，通过 `aidevo log highlight --content "..." --source auto` 写入
   - 用户手动补充的通过 `aidevo log highlight --content "..." --source manual` 写入

## 关于中断恢复

如果在循环中的任意一步被用户强行终止或因外界因素打断，下次呼叫 workflow-orchestrator 时，必须依据 `run.json.context`（currentTaskId, currentStage）与 `run.json.tasks[]` 中各任务的 status，从被打断的任务直接无缝续拍。

## run.json 关键字段说明

- **执行状态**：`run.json.context`（currentStage, currentTaskId, currentPrdPhase）
- **开发工单**：`run.json.tasks[]`（每个任务含 taskId, title, status, stageName, startedAt, completedAt）
- **Bug 记录**：`run.json.bugs[]`（通过 `aidevo log bug` / `aidevo log bug-fix` 写入）
- **质量自检**：`run.json.reviews[]`（通过 `aidevo log review` 写入）
- **偏差记录**：`run.json.deviations[]`（通过 `aidevo log deviation` 写入，用户手动触发）
- **规则沉淀**：`run.json.rules[]`（通过 `aidevo log rule` 写入）
- **工作流阶段**：`run.json.workflow[]`（记录各阶段执行状态和耗时）
- **时间线**：`run.json.timeline[]`（记录关键事件时间点）
- **文件变更**：`run.json.files[]`（记录修改过的文件路径和统计）
- **汇总指标**：`run.json.summary` + `run.json.metrics`（含 nodeTimeBreakdown、actualWorkSeconds、efficiencyMultiplier）
- **成本数据**：`run.json.cost`（token 消耗、预估工时、实际工时）
- **业务亮点**：`run.json.highlights[]`（业务价值记录）

## 偏差记录

当一轮工作流闭环完成后，用户在测试验证阶段反馈的细节修正（与 AI 初始生成代码的偏差），通过 deviation-recorder 记录到 `run.json.deviations[]`。

与 Bug 记录的区别：
- `run.json.bugs[]`：测试阶段发现的功能 Bug，由 bug-fixer 记录
- `run.json.deviations[]`：AI 产出与用户期望的设计偏差，由 deviation-recorder 记录

两者均用于后续数据分析，驱动规则和 Skill 的持续优化。
