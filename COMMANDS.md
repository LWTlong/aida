# AIDA 2.0 命令参考

## 总览

AIDA 2.0 是一个 AI 工具资产管理器。对外主命令只保留：

- `aida init`
- `aida sync`
- `aida doctor`
- `aida rules`
- `aida skills`
- `aida memory`
- `aida mcp`

`.aida/*.json` 是唯一真源。`.cursor`、`.claude`、`.codex`、`.lingma` 等目录都只是可重建投影。

---

## 顶层命令

### `aida init`

初始化 2.0 真源和 AI 工具接入。

```bash
aida init
```

会创建：

- `.aida/config.json`
- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/summary.json`
- `.aida/aida-guide.md`

并生成所选 AI 工具的投影文件。

### `aida sync`

2.0 的日常主命令。把真源重新收口到投影。

```bash
aida sync
aida sync cursor claude-code
```

会做的事：

- 重建 memory markdown 视图
- 刷新 summary 相关视图
- 重建规则、skills、MCP 配置和 guide 投影
- 清理未启用工具的遗留投影

### `aida doctor`

检查当前项目是否符合 2.0 结构。

```bash
aida doctor
aida doctor --fix
```

`--fix` 会：

- 规范化 rules / skills / memories / summary
- 清理旧 schema 和遗留结构
- 清理残留 runtime 目录

### `aida rules`

管理项目规则真源。

```bash
aida rules list
aida rules add "提交前必须运行相关测试"
aida rules delete RULE-001
aida rules dedupe
```

### `aida skills`

管理项目技能真源。

```bash
aida skills list
aida skills edit <skill-name>
```

### `aida memory`

管理模块记忆真源。

```bash
aida memory search "登录"
aida memory show auth/login
aida memory build
aida memory upsert auth/login --summary "补充登录模块约束"
aida memory context-update --summary "收口本次需求"
```

### `aida mcp`

启动 MCP server，供 AI 工具通过 stdio 调用。

```bash
aida mcp
```

---

## 推荐流程

### 新项目

```bash
aida init
aida sync
aida doctor
```

### 日常开发后收口

```bash
aida sync
```

### 修改规则或技能真源后

```bash
aida sync
```

### 高级维护

以下能力保留为高级子命令，不属于 2.0 日常主路径：

- `aida rules merge`
- `aida rules build`
- `aida skills merge`
- `aida skills build`

---

## 2.0 边界

以下内容不再属于 2.0 产品面：

- 顶层 `build` 命令
- 顶层 `migrate` 命令
- 顶层 `merge` 命令
- dashboard
- run.json 作为长期真源
- task / timeline / workflow / events 持久化

如果旧项目或历史材料中出现这些内容，按已废弃能力理解；以当前 `README.md`、`COMMANDS.md` 和 `.aida/aida-guide.md` 为准。
