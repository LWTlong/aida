---
name: aida-rules-to-skills
description: 将描述"如何完成任务"的规则提取为可复用的 skill（规则约束行为，skill 描述流程）。当用户说"这些规则应该是 skill"、"把任务型规则转成 skill"时触发。
---

# AIDA Rules to Skills

## Goal
找出最适合转成 skill 的规则组，确认后一次性创建。

## Safety Rules
- 不删除源规则（转成 skill 后是否删由用户显式决定）。
- 用户确认前不写任何文件。
- 分组要少、要有意义（一个 skill 覆盖一组相关规则，而不是一条一个）。
- 所有写操作走 `aida_apply_governance`（可用 `aida_undo` 回滚）。

## Plan
1. `aida_list_assets`（`type: "rule"`, `includeContent: true`）。
2. 识别任务/流程/组件/API/调试类规则。
3. 按主题分组。
4. 输出分析 + 候选 skill 列表。
5. **调用 AskUserQuestion 请求确认**。
6. 用户确认后调 `aida_apply_governance` 创建 skill 文件。

## Response Style
- 结论优先。
- 数字进表格。
- 至多 3 个最强候选。
- 不提 Dashboard。

## Output Format

### 分析阶段

#### 结论
一句话。

#### 关键数据
| 指标 | 数量 |
|---|---:|
| 已审规则 | ... |
| 候选分组 | ... |
| 可创建 skill | ... |

#### 最佳候选
| 候选 Skill | 来源主题 |
|---|---|
| ... | ... |

#### 确认
调用 AskUserQuestion：
- `header`: "创建 skill"
- `question`: "确认后我会直接创建这些 skill 文件（可用 aida_undo 回滚）"
- 选项："创建" / "只看分析"

### 执行阶段

#### 结论
一句话，例如："已创建 3 个 skill 文件。"

#### 结果
| Skill | 路径 | Undo ID |
|---|---|---|
| ... | `.claude/skills/...` | ... |

#### 下一步
```text
如需回滚，运行 /aida-undo
```
