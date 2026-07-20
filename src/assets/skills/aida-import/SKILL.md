---
name: aida-import
description: 安全导入外部 Claude Plugin：先做风险审计，再选择性安装。当用户说"导入插件"、"安装这个 plugin"、"检查插件安全性"时触发。
---

# AIDA Import

## Goal
以"风险优先"的方式导入外部插件。**默认最小安装、不执行任何脚本。**

## Safety Rules
- 绝不执行插件里的 hooks / scripts / MCP servers / commands。
- 默认只安装 skills 和 rules，其他资产需用户显式勾选。
- 所有安装动作走 `aida_apply_governance`（可用 `aida_undo` 回滚）。

## Plan
1. `aida_parse_plugin`。
2. `aida_audit_plugin_risk`。
3. 推荐最小安全安装集合。
4. **调用 AskUserQuestion 请求确认**（列出要安装的资产和风险等级）。
5. 用户确认后调 `aida_apply_governance` 拷贝到 `.claude/`（或用户选择的工具目录）。

## Response Style
- 先给推荐（装什么、跳过什么）。
- 风险等级放在最前。
- 至多 3 条主要风险。
- 除非用户问，不逐个列资产。

## Output Format

### 结论
一句话，例如："推荐只安装 3 个 skill，跳过 2 个含脚本的资产。"

### 关键数据
| 指标 | 值 |
|---|---:|
| Skill | ... |
| Rule | ... |
| 中/高风险资产 | ... |
| 整体风险 | low / medium / high |

### 主要风险
至多 3 条。

### 确认
调用 AskUserQuestion：
- `header`: "开始导入"
- `question`: "确认后我会把选中的资产拷贝到项目（可用 aida_undo 回滚）"
- 选项："导入推荐集合" / "只看审计报告"

### 下一步
```text
如需回滚，运行 /aida-undo
```
