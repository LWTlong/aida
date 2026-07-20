---
name: aida-clean-rules
description: 整理过度堆积的规则：合并重复项、拆分过长规则、解决冲突。当用户说"规则太多了"、"帮我整理规则"、"规则有冲突"时触发。
---

# AIDA Clean Rules

## Goal
减少规则过载。告诉用户哪几个动作最值得做，确认后一次落盘。

## Safety Rules
- 先分析再改。
- 用户确认前不写任何文件。
- 分组要少、要有意义。
- 所有写操作走 `aida_apply_governance`（可用 `aida_undo` 回滚）。

## Plan
1. `aida_list_assets`（`type: "rule"`, `includeContent: true`）。
2. 分主题：硬约束 / 任务指引 / 元信息 / 重复冲突。
3. 每组决定一个动作：保留 / 合并 / 转 skill / 归档 / 冲突。
4. 输出分析。
5. **调用 AskUserQuestion 请求确认**（不要输出纯文本让用户猜）。
6. 用户确认后调 `aida_apply_governance` 落盘。

## Response Style
- 结论优先。
- 数字进表格。
- 至多 3 条重点动作。
- 每条一行。
- 落盘后给一句 undo 提示，不提 Dashboard。

## Output Format

### 分析阶段

#### 结论
一句话。

#### 关键数据
| 指标 | 数量 |
|---|---:|
| 已审规则 | ... |
| 主要分组 | ... |
| 可执行动作 | ... |

#### 优先动作
至多 3 条。

#### 确认
调用 AskUserQuestion：
- `header`: "开始清理"
- `question`: "确认后我会直接落盘（可用 aida_undo 回滚）"
- 选项："开始清理" / "只看分析"

### 执行阶段

#### 结论
一句话。

#### 结果
| 分组 | 状态 | Undo ID |
|---|---|---|
| ... | ✅ | ... |

#### 下一步
```text
如需回滚，运行 /aida-undo
```
