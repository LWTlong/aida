---
name: aida-help
description: AIDA 命令快速参考卡片。当用户说"aida 有哪些功能"、"aida help"、"aida 怎么用"、"/aida-help"时触发。一次性展示，不修改任何内容。
---

被调用时立即展示下方卡片。**只输出这一张表 + 场景提示**，不要展开解释。

## AIDA 命令

| 命令 | 用途 |
|------|------|
| `/aida-govern` | **一站式治理**：扫描 → 分析 → 你确认 → 一次落盘（含 2.x 遗留物清理）|
| `/aida-audit` | 只读扫描，看项目 AI 资产分布和主要问题 |
| `/aida-remember` | 记一条决策为 MADR，Claude Code 后续会自动加载 |
| `/aida-recall` | 召回之前沉淀的模块记忆 |
| `/aida-analyze` | 分支/功能开发完后，让 AI 沉淀"改了什么、为什么" |
| `/aida-import` | 从本地目录路径安全导入外部 Claude Plugin（先审计风险） |
| `/aida-resolve` | 解决 AI 资产文件的 git 合并冲突 |
| `/aida-sync` | 跨工具同步规则：Claude ↔ Cursor ↔ Codex（你选源→目标）|
| `/aida-pkg` | 打包资产为 Claude Plugin 分享 |
| `/aida-undo` | 回滚最近一次 AIDA 写操作 |
| `/aida-remember-branch` | 从当前分支的 diff 批量提取决策 |
| `/aida-help` | 显示这张卡片 |

## 常见场景

- 刚接手项目 → `/aida-audit`
- 规则乱了 → `/aida-govern`
- 治理搞砸了 → `/aida-undo`
- 想沉淀"为什么这么写" → `/aida-remember`
- 分支写完想批量沉淀 → `/aida-remember-branch`
- 接手老模块前 → `/aida-recall`
- 分享给团队 → `/aida-pkg`
