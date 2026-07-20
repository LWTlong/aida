---
name: aida-help
description: AIDA 所有 skill 的快速参考卡片。当用户说"aida 有哪些功能"、"aida help"、"aida 怎么用"、"/aida-help"时触发。一次性展示，不修改任何内容。
---

被调用时立即展示下方参考卡片。一次性，不修改任何文件。

## AIDA 命令一览

### 治理类（会改文件，先确认，可 undo）

| 命令 | 用途 |
|------|------|
| `/aida-govern` | **一站式治理**：扫描 → 分析 → 用户确认 → 一次落盘（含 2.x 遗留物清理） |
| `/aida-clean-rules` | 整理过度堆积的规则：合并重复、拆分过长、解决冲突 |
| `/aida-rules-to-skills` | 将任务型规则提取为可复用 skill |
| `/aida-audit-docs` | 审计并清理 AI 生成的文档冗余 |
| `/aida-resolve` | 处理 AI 资产文件的 git 合并冲突 |
| `/aida-sync` | 同步 Claude、Cursor、Codex 中的规则配置 |
| `/aida-import` | 安全导入外部 Claude Plugin（默认最小安装） |
| `/aida-cleanup` | 底层清理：按行/文件粒度删除重复规则、归档过期资产 |

### 只读类（不改文件）

| 命令 | 用途 |
|------|------|
| `/aida-audit` | 扫描并梳理项目中所有 AI 资产 |
| `/aida-analyze` | 沉淀功能/分支的分析到项目记忆 |
| `/aida-recall` | 检索项目记忆 |

### 记忆和回滚

| 命令 | 用途 |
|------|------|
| `/aida-remember` | 沉淀项目决策为 MADR 记录 |
| `/aida-remember-branch` | 沉淀当前分支相关的决策 |
| `/aida-undo` | 回滚最近的 AIDA 写操作 |

### 分享

| 命令 | 用途 |
|------|------|
| `/aida-pkg` | 打包项目资产为 Claude Plugin，或打包 AIDA 自身 |
| `/aida-help` | 显示这张卡片 |

## 常见流程

- 刚接手项目：`/aida-audit` → 看资产分布
- 规则乱了：`/aida-govern` → 一次治到底
- 治理搞砸了：`/aida-undo` → 一键回滚上一批写操作
- 想分享给团队：`/aida-pkg` → 打包成 Plugin
