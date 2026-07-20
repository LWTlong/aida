---
name: aida-audit
description: 扫描并梳理项目中所有 AI 资产（规则、skill、MCP 配置等），覆盖 Claude、Cursor、Codex、AIDA 及未知 dot 目录。当用户说"扫描资产"、"有哪些 AI 资产"、"帮我梳理规则和 skill"时触发。
---

# AIDA Audit

## Goal
给用户一份短、可直接决策的 AI 资产快照。**只读，不写文件。**

## Safety Rules
- 审计阶段绝不修改文件。
- 扫描结果是证据，不是最终判断，语义决策交给模型。
- 未知 dot 目录（`.foo/`）只标注，不建议动。

## Plan
1. `aida_scan_assets`（`writeIndex: true`, `includeContent: false`）。
2. `aida_list_assets` 汇总类型和工具分布。
3. 对少数可疑或代表性资产用 `aida_get_asset` 抽查。
4. 输出结论 + 3 条最重要的问题。

## Response Style
- 结论优先。
- 数字进表格。
- 至多 3 条问题。
- 不解释背景（用户没问就别说）。
- 下一步提示用自然语言，不提 MCP 工具名。

## Output Format

### 结论
一句话。

### 关键数据
| 指标 | 数量 |
|---|---:|
| 总资产 | ... |
| 规则 | ... |
| Skill | ... |
| 文档 | ... |
| 重复组 | ... |

| 工具 | 数量 |
|---|---:|
| Cursor | ... |
| Claude | ... |
| Codex | ... |
| AIDA | ... |

### 主要问题
至多 3 条，每条一行。

### 下一步
一句话，用户可直接说，例如：

```text
帮我治理这些 AI 资产
```
