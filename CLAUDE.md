# CLAUDE.md

## AIDA 使用规范

- 开发前先跑 `/aida-audit` 了解项目 AI 资产分布。
- 需要治理规则/skill 时跑 `/aida-govern`（会先分析，用户确认后落盘，可 `/aida-undo` 回溺）。
- 沉淀"为什么这么写"用 `/aida-remember`（写入 `.claude/rules/decisions/`，Claude Code 会按 `paths` 前置元数据自动加载）。
- 所有 AIDA 写操作都通过 `aida_apply_governance`，可 `aida_undo` 回溺。
