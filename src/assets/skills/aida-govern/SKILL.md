---
name: aida-govern
description: 一站式 AI 资产治理：扫描 → 分析 → 用户确认 → 一次性落盘。当用户说"治理 AI 资产"、"帮我整理规则"、"跑一次完整治理"时触发。
---

# AIDA Govern

## Goal
一次连贯的 AI 资产治理流程。不让用户手动串联多个 skill、不引入中间"审批"层。

## Safety Rules
- 先分析，不写文件。
- 用 AskUserQuestion 让用户明确确认后再落盘。
- 所有写操作走 `aida_apply_governance`（journal 已内建，出错可用 `aida_undo` 一键回滚）。
- 分组要少、要有意义，不要一条规则一个动作。

## Flow

### Phase 1 — 扫描并分析
1. `aida_scan_assets`（`writeIndex: true`, `includeContent: false`）。
2. `aida_list_assets` 汇总类型和工具分布。
3. 识别典型问题：规则过载、任务型规则应转 skill、跨工具重复、AI 生成文档冗余、`_all.md` 类聚合镜像。
4. **检测 2.x 遗留物**：
   - `.aida/proposals/*.json` — 旧版审批草稿，3.0 已不使用
   - `.aida/memories/index.json` schemaVersion 为 `2.0` 且 `.aida/memories/modules/` 下有 JSON — 旧版模块记忆，3.0 用 `.claude/rules/decisions/` 代替
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

如果用户选"只看分析"：结束，给一句下一步提示。
如果用户选"开始治理"：继续 Phase 3。

### Phase 3 — 构造并执行 apply_governance
把每组动作拆成 `aida_apply_governance` 的 `operations`。可用 op 类型：

| op | 用途 |
|----|------|
| `remove-lines` | 删指定行号（`lines: number[]`） |
| `modify-file` | 用 `content` 整体覆盖文件 |
| `create-file` | 用 `content` 新建文件 |
| `delete-file` | 删除文件（遗留物归档常用） |

**批次策略**：
- 每批 ≤ 20 个 op（保持 undo 粒度可控）
- 每批一个明确的 `description`，例如 "去重 42 组重复规则行"、"归档 3 个 2.x proposal 文件"
- 大批治理拆多次 `aida_apply_governance` 调用

### Phase 4 — 汇报结果
一句话结论 + 一张结果表。**不要提 Dashboard**（3.0 无治理审批 UI）。给出 undo 提示。

## Response Style
- 短。结论优先。数字进表格。
- 分析阶段：至多 3 条重点问题。
- 确认阶段：一次 AskUserQuestion。
- 执行后：一句下一步提示。
- 不要提"Dashboard 审核"、"proposal"、"草稿" —— 3.0 里没有这些概念。

## Output Format

### 分析阶段

#### 结论
一句话。

#### 关键数据
| 指标 | 数量 |
|---|---:|
| 总资产 | ... |
| 规则 | ... |
| Skill | ... |
| 重复组 | ... |
| 2.x 遗留物 | ... |

#### 计划动作
| 分组 | 动作 | 影响文件数 |
|---|---|---:|
| A. 去重 42 组 | 保留源头，删镜像行 | 3 |
| B. 归档 2.x 遗留 | 移除 .aida/proposals/*.json | 3 |
| ... | ... | ... |

#### 确认
调用 AskUserQuestion（不要输出纯文本选项）。

### 执行阶段

#### 结论
一句话，例如："完成 5 组治理动作，共写入 27 个文件。"

#### 结果
| 分组 | 状态 | Undo ID |
|---|---|---|
| A. 去重 42 组 | ✅ | undo-1 |
| B. 归档 2.x 遗留 | ✅ | undo-2 |

#### 下一步
```text
如需回滚，运行 /aida-undo
```
