---
name: aida-resolve
description: 解决 AI 资产文件的 git 合并冲突，逐一解释 ours vs theirs 并落盘。当用户说"规则文件有冲突"、"AI 资产 merge 冲突"时触发。
---

# AIDA Resolve

## Goal
解释关键冲突，让用户明白 ours vs theirs 各自的含义后再落盘。

## Safety Rules
- 绝不静默选边。
- 每个冲突都要短说明。
- 所有写操作走 `aida_apply_governance`（可用 `aida_undo` 回滚）。

## Plan
1. 扫描 `.claude/`, `.cursor/`, `.aida/` 下带冲突标记（`<<<<<<<`、`=======`、`>>>>>>>`）的文件。
2. 只详细读最重要的冲突。
3. 对每个冲突决定：合并 / 保留 ours / 保留 theirs / 拆分。
4. 输出方案清单。
5. **调用 AskUserQuestion 请求确认**。
6. 用户确认后调 `aida_apply_governance` 落盘（每个冲突文件一个 `modify-file` op）。

## Response Style
- 先说冲突严重度。
- 数字进表格。
- 至多 3 个优先冲突。
- 每条解释短且面向决策。

## Output Format

### 结论
一句话。

### 关键数据
| 指标 | 数量 |
|---|---:|
| 冲突文件 | ... |
| 优先冲突 | ... |

### 优先冲突
至多 3 条：
- 文件路径
- ours / theirs 一句话对比
- 建议方案

### 确认
调用 AskUserQuestion：
- `header`: "解决冲突"
- `question`: "确认后我会按建议方案落盘（可用 aida_undo 回滚）"
- 选项："按建议解决" / "只看分析"

### 下一步
```text
如需回滚，运行 /aida-undo
```
