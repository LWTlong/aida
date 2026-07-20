---
name: aida-audit-docs
description: 审计项目中 AI 生成的 Markdown 文档，找出过时、重复或与规则/skill 冲突的文件。当用户说"清理 AI 文档"、"有哪些 AI 生成的文档"时触发。
---

# AIDA Audit Docs

## Goal
快速判断 AI 生成的文档是"资产"还是"噪音"。**审计阶段只读，不写文件。**

## Safety Rules
- 审计不改文件。
- 需要清理时走 `aida-govern` 或直接调 `aida_apply_governance`（带用户确认）。
- 文件名只是线索，最终价值判断由模型给出。

## Plan
1. `aida_list_assets`（`type: "doc"`）。
2. 只对疑似噪音的少数文档拉取 content。
3. 分类：keep / convert / archive / review。
4. 输出短报告 + 下一步提示。

## Response Style
- 结论优先。
- 一张小表说数字。
- 至多 3 条重点问题。
- 每条问题一行。

## Output Format

### 结论
一句话。

### 关键数据
| 指标 | 数量 |
|---|---:|
| 已审文档 | ... |
| 噪音候选 | ... |
| 转换候选 | ... |

### 主要问题
至多 3 条。

### 下一步
一句话，用户可直接说，例如：

```text
帮我归档这些 AI 生成的噪音文档
```
