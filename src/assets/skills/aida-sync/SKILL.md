---
name: aida-sync
description: 跨工具同步 AI 资产：对比 Claude、Cursor、Codex 的规则和配置，去重并同步。当用户说"同步规则到 Cursor"、"多个工具的配置不一致"时触发。
---

# AIDA Sync

## Goal
找出跨工具的重复和漂移，让用户挑最重要的几组同步。

## Safety Rules
- 扫描所有工具，只写用户选中的目标。
- 绝不自动把资产复制到每个工具目录。
- Hash 匹配只是证据，语义等价由模型判断。
- 所有写操作走 `aida_apply_governance`（可用 `aida_undo` 回滚）。

## Plan
1. `aida_list_assets` 对 Claude、Cursor、Codex 各跑一次。
2. 对比工具间的分布、重复内容、单工具独有资产。
3. 输出分析 + 高价值同步候选。
4. **调用 AskUserQuestion 请求确认**（含要同步的方向和目标）。
5. 用户确认后调 `aida_apply_governance` 落盘。

## Response Style
- 结论优先。
- 分布用表格。
- 至多 3 条同步问题。
- 不提 Dashboard。

## Output Format

### 结论
一句话。

### 关键数据
| 工具 | 数量 |
|---|---:|
| Claude | ... |
| Cursor | ... |
| Codex | ... |

| 指标 | 数量 |
|---|---:|
| 重复组 | ... |
| 单工具独有 | ... |

### 主要问题
至多 3 条。

### 确认
调用 AskUserQuestion：
- `header`: "开始同步"
- `question`: "确认后我会按方向同步到目标工具（可用 aida_undo 回滚）"
- 选项："按建议同步" / "只看分析"

### 下一步
```text
如需回滚，运行 /aida-undo
```
