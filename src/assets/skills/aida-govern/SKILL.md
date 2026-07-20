---
name: aida-govern
description: 一站式 AI 资产治理：扫描 → 分析 → 用户确认 → 一次性落盘。当用户说"治理 AI 资产"、"帮我整理规则"、"跑一次完整治理"时触发。
---

# AIDA Govern

## Goal
一次连贯的 AI 资产治理流程。**一站式** —— 不要把子问题推给其他 skill，所有类别的清理都在这一次流程里给出方案。

## Safety Rules
- 先分析，不写文件。
- 用 AskUserQuestion 让用户明确确认后再落盘。
- 所有写操作走 `aida_apply_governance`（journal 内建，出错用 `aida_undo` 一键回滚）。
- 分组要少、要有意义，不要一条规则一个动作。
- **绝不 punt**：识别出的每一类问题都必须给出计划动作，不要说"建议另行 /aida-xxx 处理"。

## Flow

### Phase 1 — 扫描并分析
1. `aida_scan_assets`（`writeIndex: true`, `includeContent: false`）。
2. `aida_list_assets` 汇总类型和工具分布。
3. 识别所有类别的问题（都由本 skill 处理，不外推）：
   - **规则过载**：单个规则文件 > 200 条，或有大量粒度过细/重复的规则行
   - **任务型规则**：描述"如何做某事"的规则（应转为 skill 而不是规则）
   - **文档冗余**：AI 生成的 md 文档过时、重复、与规则冲突
   - **跨工具重复**：`.claude/`、`.cursor/`、`.codex/` 里内容一样的规则
   - **git 合并冲突**：AI 资产文件里有 `<<<<<<<` 标记
   - **聚合镜像**：`_all.md` 类由源文件拼接出来的镜像文件
4. **检测 2.x 遗留物**：
   - `.aida/proposals/*.json` — 旧版审批草稿，3.0 已不使用
   - `.aida/memories/index.json` schemaVersion 为 `2.0` 且 `.aida/memories/modules/` 下有 JSON — 旧版模块记忆
   - `.aida/reports/*.json` — 旧版报告
   - 如发现，作为独立分组"归档 2.x 遗留物"纳入清理清单

### Phase 2 — 展示分析并请求确认
输出分析结果（见下方 Output Format），然后**调用 AskUserQuestion**（不要用纯文本让用户猜）：

- `header`: "开始治理"
- `question`: "确认后我会直接把这些改动落盘（可用 aida_undo 一键回滚）"
- `options`:
  - `label`: "开始治理"
  - `description`: "执行下列 N 组动作，共约 M 个文件操作。全部通过 aida_apply_governance 落盘，出错可回滚。"
  - `label`: "只看分析"
  - `description`: "停在分析结果，不改任何文件。"

如果用户选"只看分析"：结束，给一句"如需执行，再说 /aida-govern"。
如果用户选"开始治理"：继续 Phase 3。

### Phase 3 — 构造并执行 apply_governance
把每组动作拆成 `aida_apply_governance` 的 `operations`。可用 op 类型：

| op | 用途 |
|----|------|
| `remove-lines` | 删指定行号（`lines: number[]`） |
| `modify-file` | 用 `content` 整体覆盖文件（合并重复规则、拆分过长规则、重写文件） |
| `create-file` | 用 `content` 新建文件（比如把一组任务型规则提取成新 skill） |
| `delete-file` | 删除文件（遗留物归档、无用聚合镜像） |

**规则粒度问题的处理**（避免 punt）：
- 如果某个规则文件条目数 > 200，检查是否是**聚合镜像**（内容来自其他源文件拼接）
  - 是 → `delete-file` 删镜像，保留源
  - 否 → 分析规则内容，把编码风格类样板规则整合为一个 style-guide 章节（`modify-file`），保留有编号的硬约束
- 冲突/重复行：`remove-lines`
- 任务型规则：`create-file` 建 skill + `remove-lines` 从规则文件删

**批次策略**：
- 每批 ≤ 20 个 op（保持 undo 粒度可控）
- 每批一个明确的 `description`
- 大批治理拆多次 `aida_apply_governance` 调用

### Phase 4 — 汇报结果
一句话结论 + 一张结果表。**不要提 Dashboard**（3.0 无治理审批 UI）。给出 undo 提示。

## Response Style
- 短。结论优先。数字进表格。
- 分析阶段：至多 3 条重点问题。
- 确认阶段：一次 AskUserQuestion。
- 执行后：一句下一步提示。
- 不要提"Dashboard 审核"、"proposal"、"草稿"。
- **绝对禁止**说"建议另行 /aida-xxx 处理" —— 本 skill 就要处理完。

## Output Format

### 分析阶段

#### 结论
一句话，总结健康度 + 待处理项数。**不要 punt**。

#### 关键数据
| 指标 | 数量 |
|---|---:|
| 总资产 | ... |
| 规则 | ... |
| Skill | ... |
| 重复组 | ... |
| 2.x 遗留物 | ... |

#### 计划动作
覆盖所有识别出的问题，每一类都有对应的行：

| 分组 | 动作 | 影响文件数 |
|---|---|---:|
| A. 去重规则行 | 保留源头，删镜像行 | 3 |
| B. 归档 2.x 遗留 | 删除 .aida/proposals/*.json 等 | 3 |
| C. 整合样板规则 | 把 general.md 里 440 条编码风格规则合并为 style-guide 章节 | 1 |
| ... | ... | ... |

#### 确认
调用 AskUserQuestion（不要输出纯文本选项）。

### 执行阶段

#### 结论
一句话，例如："完成 5 组治理动作，共写入 27 个文件。"

#### 结果
| 分组 | 状态 | Undo ID |
|---|---|---|
| A. 去重规则行 | ✅ | undo-1 |
| B. 归档 2.x 遗留 | ✅ | undo-2 |

#### 下一步
```text
如需回滚，运行 /aida-undo
```
