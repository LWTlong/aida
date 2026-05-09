# AIDA 2.0 命令参考

## 总览

AIDA 2.0 的核心不是 run/task 流水账，而是统一管理这几类真源：

- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/config.json`
- `.aida/summary.json`
- `.aida/memories/index.json`
- `.aida/memories/modules/*.json`

生成产物：

- `.aida/rules/*.md`
- `.aida/memories/modules/*.md`
- `CLAUDE.md`
- `AGENTS.md`（仅在启用 codex 时）
- `.claude/**`
- `.cursor/**`
- `.codex/**`
- `.lingma/**`
- `.mcp.json`

2.0 默认会清洗并丢弃这些 1.x 运行态数据：

- `.aida/runs/**`
- `.aida/index.json`
- `.aida/tool-configs.json`
- `run.json / task / timeline / workflow / events`

---

## 主命令

### `aida init`

初始化项目的 2.0 真源和工具接入。

会做的事：

- 创建 `.aida/config.json`
- 创建 `.aida/rules.json`
- 创建 `.aida/skills.json`
- 创建 `.aida/aida-guide.md`
- 生成所选 AI 工具的规则 / skill / MCP 产物
- 可选导入现有工具目录中的 rules / skills 作为 baseline

不会做的事：

- 不创建默认 bundled skill
- 不初始化 run/task 流水账目录

常见用法：

```bash
aida init
```

---

### `aida sync`

从 2.0 真源重建当前项目的全部受管产物。

会做的事：

- 重建 memory markdown 视图
- 重建 `summary.json` 相关投影
- 重建当前启用工具的规则、skill、MCP 配置、根级 guide 文件
- 清理未启用工具的遗留产物

常见用法：

```bash
aida sync
```

指定只重建部分工具：

```bash
aida sync cursor claude-code
```

---

### `aida build`

从真源显式重建工具侧产物。

和 `sync` 的区别：

- `sync` 更偏日常收口
- `build` 更偏显式重建工具产物

常见用法：

```bash
aida build
aida build cursor claude-code
```

---

### `aida doctor`

检查项目当前是否符合 2.0 真源结构。

会检查：

- rules / skills / memories / summary schema
- legacy runtime 是否残留
- memories 是否有 nested / orphan / 脏路径
- rules 是否有疑似近似重复

修复：

```bash
aida doctor --fix
```

`--fix` 会把旧真源清洗成 2.0 结构，并清理 1.x 残留目录。

---

### `aida migrate-legacy`

把旧 `.aidevos` / 1.x 项目迁移成 2.0 真源。

迁移原则：

- 迁移是清洗和提炼，不是照搬
- 只保留 rules / skills / memories / summary
- 丢弃 run/task/timeline/workflow 等运行态噪音

常见用法：

```bash
aida migrate-legacy
```

显式指定 baseline tool：

```bash
aida migrate-legacy cursor
aida migrate-legacy codex
```

迁移后建议：

```bash
aida doctor --fix
aida sync
```

---

## 辅助命令

### `aida import`

从现有工具目录导入 rules / skills 到 `.aida/*.json`。

适用场景：

- 还没迁移，但工具目录里已有可用 rules / skills
- 想显式选择某个 baseline tool 作为导入来源

```bash
aida import
aida import cursor
aida import codex
```

导入后通常需要：

```bash
aida sync
```

---

### `aida merge`

处理 JSON 真源冲突。

当前覆盖：

- `rules.json`
- `skills.json`
- `memories/index.json`
- `memories/modules/*.json`
- 历史 requirement/context/run 输入（迁移期）

行为：

- 结构化合并
- 精确重复自动去重
- 语义近似不自动合并

```bash
aida merge
```

---

### `aida rules`

管理规则真源。

常用：

```bash
aida rules list
aida rules add "提交前必须运行相关测试"
aida rules delete RULE-001
aida rules dedupe
```

---

### `aida skills`

管理项目技能真源。

常用：

```bash
aida skills list
aida skills edit <skill-name>
aida skills build
```

说明：

- 2.0 不再默认预置 bundled skill
- 新项目的 `skills.json` 默认是空的
- 老项目自己的 skills 会在迁移或 import 时保留

---

### `aida memory`

管理模块记忆真源。

常用：

```bash
aida memory search "登录"
aida memory show auth/login
aida memory build
aida memory upsert
```

2.0 的推荐恢复顺序：

1. 先读 `.aida/memories/index.json`
2. 再读 `.aida/summary.json`
3. 命中模块后才读 `.aida/memories/modules/*.json`

---

## 推荐流程

### 新项目

```bash
aida init
aida build
aida doctor
```

### 老项目升级到 2.0

```bash
aida migrate-legacy
aida doctor --fix
aida sync
```

### 日常开发后收口

```bash
aida sync
```

### 规则或 skill 真源改动后

```bash
aida build
```

### git pull 之后

```bash
aida merge
aida sync
```

---

## 2.0 边界

以下内容不是 2.0 核心模型：

- task 持久化流水账
- run.json 作为长期真源
- timeline / workflow / events
- 默认 bundled workflow skills

如果你在历史文档或旧项目里看到这些，按 1.x 遗留理解即可；以当前 `README.md`、`COMMANDS.md` 和 `.aida/aida-guide.md` 为准。
