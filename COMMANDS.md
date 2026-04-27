# AIDA 命令参考

## 总览

AIDA 有两层能力：

1. 开发过程观测
- 通过 MCP 采集 task / bug / deviation / review / file / token 等数据
- 聚合项目进展，供 dashboard / report / memory 使用

2. AI 资产管理
- 统一管理项目规则、技能和 AI 工具配置
- 从 `.aida` 真源分发到 Claude / Cursor / Codex 等工具侧本地产物

真源文件：

- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/config.json`
- `.aida/tool-configs.json`
- `.aida/memories/index.json`
- `.aida/memories/modules/*.json`
- `.aida/runs/*/context.json`

生成产物：

- `.aida/rules/*.md`
- `.aida/memories/modules/*.md`
- `.aida/runs/*/context.md`
- `.mcp.json`
- `.cursor/**`
- `.claude/**`
- `.codex/**`
- `.lingma/**`

## 主流程

### 新项目

```bash
aida init
```

适用场景：

- 仓库里还没有 `.aida`
- 想从零接入 AIDA
- 想选择 collect / full 模式并写入工具侧产物

建议收尾：

```bash
aida build
aida status
```

### 老项目迁移

```bash
aida migrate-legacy
```

适用场景：

- 老项目还在使用 `.aidevos`
- 旧项目里已有 Cursor / Claude / Codex 本地规则，需要导入回 `.aida/*.json`
- 发新包后，想在旧项目里一次性补齐导入、memory、build、schema migration

如果你想分步执行并显式选择 baseline tool：

```bash
aida migrate-dir
aida import cursor
aida migrate
aida memory rebuild
```

适用场景：

- 你想手动控制每一步
- 你只想做目录迁移，不想立刻 import
- 你要排查是哪一步出了问题

### 团队协作

```bash
git pull
aida merge
aida build
```

适用场景：

- 多人协作后同步主干
- 规则 / skills 真源可能发生冲突
- 想把冲突解决和生成产物重建串成固定动作

---

## 场景操作

### 场景 1：新项目初始化

```bash
aida init
```

典型流程：

1. 选择 `collect` 或 `full`
2. 选择 AI tools
3. 如果检测到现有闭环工具，可选一个 baseline tool 导入
4. 初始化完成后执行：

```bash
aida build
aida status
```

如果以后缺产物了，不用重来，直接重新执行 `aida init`，然后选 `Repair missing generated files`。

### 场景 2：老项目迁移

最快方式：

```bash
aida migrate-legacy
```

指定 baseline tool：

```bash
aida migrate-legacy cursor
aida migrate-legacy codex
```

分步迁移：

```bash
aida migrate-dir
aida import cursor
aida migrate
aida memory rebuild
aida build
```

什么时候用哪种方式：

- 只想一把梭迁完：`migrate-legacy`
- 想逐步排查：拆成 `migrate-dir + import + migrate + memory rebuild + build`
- 项目已经是 `.aida`，但你想补齐老版本缺产物：重复执行 `migrate-legacy`

### 场景 3：项目已初始化，但想补齐缺失产物

适用场景：

- 删掉了 `AGENTS.md`、`CLAUDE.md`、`.codex/config.toml`
- 老版本包生成不完整
- 切换分支后想重建工具侧产物

操作：

```bash
aida init
```

然后在交互里选：

- `Repair missing generated files`

或者直接：

```bash
aida build
```

差异：

- `init -> repair`：面向“补文件”场景，适合人手操作
- `build`：面向“从真源重建全部受管产物”场景

### 场景 4：import 和 build 怎么配合

#### 先 import，后 build

当项目里已经有工具侧规则 / skills，需要先回收到 `.aida/*.json` 时：

```bash
aida import
aida build
```

或者指定 baseline tool：

```bash
aida import cursor
aida build
```

#### 只 build，不 import

当 `.aida/rules.json`、`.aida/skills.json` 已经是最新真源，只想重建产物时：

```bash
aida build
```

判断标准：

- 真源缺失、资产分散在工具目录里：先 `import`
- 真源完整，只是产物缺失或想刷新：直接 `build`

### 场景 5：rules 冲突

只处理 `.aida/rules.json`：

```bash
aida rules merge
```

处理完建议立刻跑：

```bash
aida rules dedupe
aida rules build
```

如果你不确定是否只有 rules 冲突，也可以直接：

```bash
aida merge
```

说明：

- `rules merge` 只处理 rules
- `merge` 会同时处理 rules 和 skills
- `rules dedupe` 会清 exact duplicate，并提示 near duplicate

### 场景 6：skills 冲突

推荐：

```bash
aida merge
```

如果你明确只想处理 skills：

```bash
aida skills merge
```

处理完建议：

```bash
aida build
```

### 场景 7：git pull 之后的标准补救动作

```bash
git pull
aida merge
aida build
aida rules dedupe
```

适用场景：

- 拉代码后担心 `.aida/*.json` 冲突
- 想顺手把受管产物重新拉齐
- 想检查合并后是否出现重复规则

### 场景 8：发布前自检

建议在当前项目真实跑一遍：

```bash
npm run build
npm test
npm pack --dry-run
aida build
aida import codex
aida migrate-legacy codex
aida rules build
aida rules dedupe
```

如果仓库里保留了 rules 冲突样本，还应补：

```bash
aida rules merge
aida merge
```

---

## 顶层命令

### `aida init`

初始化当前项目。

行为：

- 创建 `.aida`
- 写入 config / rules / skills 真源
- 向支持的 AI 工具注入 AIDA guide 引导
- 如果检测到现有工具已有本地 rules / skills / config，可选择一个 baseline tool 导入进 `.aida/*.json`

已初始化项目再次执行时：

- 进入交互分支
- 可选 `Add a new AI tool`
- 可选 `Repair missing generated files`
- 可选 `Exit`

`repair` 适合以下场景：

- 之前初始化过程中断
- 老版本包生成不完整
- 手动删掉了 `AGENTS.md` / `.codex/config.toml` / `.aida/rules/_all.md` 等产物

推荐后续动作：

```bash
aida build
```

### `aida import`

把现有项目资产反向导入 AIDA JSON，然后重建。

导入来源：

- 旧的 `.aida/rules/*.md` 或 `.aida/rules/_all.md`
- 旧的 `.aida/skills/*/SKILL.md`
- AI 工具侧的 rules / skills / MCP config
- tool-specific config snapshot

示例：

```bash
aida import
aida import cursor
```

行为：

- 无参数：导入当前 AIDA 源数据和可发现的工具配置快照
- 带 baseline tool：优先导入该工具的规则 / 技能，再合并进 `.aida/*.json`
- 导入完成后自动 rebuild

常见用法：

- `aida import`：把当前项目里能发现的工具资产都回收到 `.aida`
- `aida import cursor`：明确以 Cursor 现有资产作为 baseline
- `aida import codex`：明确以 Codex 现有资产作为 baseline

### `aida build`

从 `.aida` 真源构建 rules / skills / MCP config / tool-specific 本地产物。

示例：

```bash
aida build
aida build all
aida build claude-code
aida build cursor codex
```

行为：

- 无参数：进入交互式多选
- 带参数：只构建选定目标
- 更新 `.gitignore`
- 渲染 memory markdown 视图
- 非 TTY 环境回退为逗号分隔数字输入

什么时候该跑：

- `import` 完成后
- `merge` / `rules merge` / `skills merge` 完成后
- 升级包版本后想重建受管产物
- 手工改过 `.aida/*.json` 真源之后

覆盖语义：

- 会重建 AIDA 受管生成产物
- 不会清空用户自己的 `.gitignore`
- 不会覆盖 `AGENTS.md` / `CLAUDE.md` 的非 AIDA 内容
- 会合并 `.mcp.json` / `.cursor/mcp.json` / `.lingma/mcp.json` 的 `aida` server 片段
- 会维护 `.codex/config.toml` 中 `[mcp_servers.aida]` 片段

### `aida merge`

解决以下两个文件里的 git conflict：

- `.aida/rules.json`
- `.aida/skills.json`

等价于：

```bash
aida rules merge
aida skills merge
```

推荐后续动作：

```bash
aida build
aida rules dedupe
```

### `aida migrate`

把旧版 `run.json` schema 迁移到当前 schema。

### `aida migrate-dir`

把旧 `.aidevos` 目录迁到 `.aida`，并替换常见路径引用。

示例：

```bash
aida migrate-dir
```

行为：

- 重命名 `.aidevos -> .aida`
- 重写 `.aida`、`AGENTS.md`、`CLAUDE.md`、`.gitignore` 中的常见路径引用
- 项目已经是 `.aida` 时安全 no-op
- 若 `.aidevos` 和 `.aida` 同时存在，则中止并提示人工处理

### `aida migrate-legacy`

为旧 `.aidevos` 项目提供一键迁移。

示例：

```bash
aida migrate-legacy
aida migrate-legacy cursor
```

行为：

- 执行 `.aidevos -> .aida` 迁移
- 修复旧路径引用
- 导入一个 baseline tool 的本地 rules / skills 进 `.aida/*.json`
- 迁移旧的 run / requirement / analysis 数据到 branch context 和 module memory
- 为所有可发现工具写入 config snapshot
- 重建生成产物并更新 `.gitignore`
- 执行 `aida migrate` 升级历史 run schema

重复执行语义：

- 即使项目已经是 `.aida`，也可以重跑
- 适合“之前包版本有 bug，重新发包后去老项目补齐”的场景
- 主要作用是补建缺失产物，而不是重置真源

推荐后续动作：

```bash
aida status
aida build
```

### `aida start`

创建新的开发 run。

### `aida status`

查看当前 run 状态。

### `aida dashboard`

启动本地 dashboard 服务。

### `aida report`

从记录的 runs 里生成汇总数据。

### `aida memory`

管理 branch context 和 module memory。

示例：

```bash
aida memory rebuild
aida memory rebuild feature/profile
aida memory migrate-legacy
aida memory search "个人中心"
aida memory show profile
aida memory context
aida memory pack
```

行为：

- `rebuild`：从 `run.json` / `requirement.json` / `analysis.md` 推导当前分支上下文和模块记忆
- `migrate-legacy`：批量把现有历史数据迁成 memory JSON 真源
- `build`：从 memory JSON 真源重建 `.md` 视图
- `pack`：查看当前分支上下文 + 相关模块组成的聚合 memory pack
- `search`：编码前检索模块记忆
- `show` / `context`：查看可读视图
- `upsert` / `context-update`：MCP 不可用时写回结构化 memory

### `aida reindex`

根据所有 runs 重建项目级索引。

### `aida mcp`

通过 stdio 启动 MCP server。

## Rules 命令

### `aida rules add`

往 `.aida/rules.json` 新增一条规则。

示例：

```bash
aida rules add "禁止直接修改生成产物文件"
aida rules add "API 请求必须走统一封装" --category api
```

行为：

- 自动生成规则 ID
- 默认 category 是 `general`
- 通过 `fingerprint` 阻止 exact duplicate
- 新增后自动 rebuild 工具侧产物

### `aida rules list`

列出规则。

示例：

```bash
aida rules list
aida rules list --json
```

### `aida rules delete`

按 ID 废弃一条规则。

示例：

```bash
aida rules delete RULE-001
```

行为：

- 不会 hard delete
- 只标记为 `deprecated`
- 自动 rebuild 工具侧产物

### `aida rules build`

从 `.aida/rules.json` 重建：

- `.aida/rules/*.md`
- 工具侧 rule views
- guide reference 中依赖的规则链路

### `aida rules merge`

只解决 `.aida/rules.json` 的 git conflict。

冲突处理逻辑：

- 识别标准 conflict marker 与带缩进 marker
- 支持大数组里多段冲突
- 解析两侧 JSON array / object fragment
- 按 `fingerprint` 合并
- 为新合入项重新分配 ID，避免碰撞

### `aida rules dedupe`

查找并处理重复规则。

行为分两层：

1. exact duplicate
- 以 `fingerprint` 为准
- 会直接从 `.aida/rules.json` 中移除重复项
- 移除后自动 rebuild

2. near duplicate / potential conflict
- 只比较同一 category 下的规则
- 对内容做归一化后切词
- 用 Jaccard 相似度判断
- 相似度 `>= 0.4` 时报告为 potential duplicate
- 这类不会自动合并，只提示人工处理

### `fingerprint` 规则

规则内容会先做规范化：

1. 转小写
2. 多空格 / 换行 / tab 折叠成一个空格
3. 去掉常见中英文标点
4. `trim`
5. 对规范化结果做 `sha256`
6. 取前 12 位作为 `fingerprint`

因此下面这些会被视为同一条规则：

- `禁止任何形式的臆想，不清楚必须询问`
- ` 禁止任何形式的臆想，不清楚必须询问 `
- `禁止任何形式的臆想，不清楚必须询问！`

## Skills 命令

### `aida skills list`

列出技能。

示例：

```bash
aida skills list
aida skills list --json
```

### `aida skills edit`

编辑一个 skill，并写回 `.aida/skills.json`。

示例：

```bash
aida skills edit workflow-orchestrator
aida skills edit workflow-orchestrator --apply
aida skills edit workflow-orchestrator --from-file ./workflow.md
```

行为：

- 使用 whole-document 编辑
- 若存在 `EDITOR`，打开编辑缓冲区
- 否则用户手动改缓冲区并执行 `--apply`
- 保存后自动 build

### `aida skills build`

从 `.aida/skills.json` 重建工具侧 skill 文件。

### `aida skills merge`

只解决 `.aida/skills.json` 的 git conflict。

冲突处理：

- 把两侧解析成 skill array
- 按 fingerprint 合并
- 为新项重新分配 ID
- 支持 `{} vs array`、空内容、单对象、数组片段等边界情况

## 支持的 AI 工具

- `claude-code`
- `cursor`
- `vscode-copilot`
- `lingma`
- `codex`
- `windsurf`

## 构建 / 导入覆盖范围

### Claude Code

构建：

- `.mcp.json`
- `.claude/commands/*.md`
- `.claude/rules/aida/*`
- `CLAUDE.md` 中的 AIDA 区块

导入 baseline：

- `CLAUDE.md`
- `.claude/commands/*.md`
- `.mcp.json`

### Cursor

构建：

- `.cursor/mcp.json`
- `.cursor/skills/*/SKILL.md`
- `.cursor/rules/aida/*`

导入 baseline：

- `.cursor/rules/**/*.md`
- `.cursor/skills/*/SKILL.md`
- `.cursor/mcp.json`

### Codex

构建：

- `.codex/config.toml`
- `.codex/rules/aida/*`
- `.codex/skills/*.md`
- `AGENTS.md` 中的 AIDA 区块

导入 baseline：

- `AGENTS.md`
- codex config snapshot

### Lingma / VS Code Copilot

构建：

- 工具侧 MCP config
- guide / rule reference

导入：

- config snapshot
- Lingma rule import 部分支持

## 重复执行与覆盖边界

### 默认尽量保留用户内容

- `AGENTS.md` / `CLAUDE.md`：只维护 AIDA 注入区块
- `.mcp.json` / `.cursor/mcp.json` / `.lingma/mcp.json`：合并写入 `aida` server
- `.codex/config.toml`：只维护 `[mcp_servers.aida]`
- `.gitignore`：只补缺失条目

### 允许被重建覆盖的目录

以下视为 AIDA 受管生成产物，重复执行 `build` / `repair` / `migrate-legacy` 会重建覆盖：

- `.aida/rules/*.md`
- `.aida/memories/modules/*.md`
- `.aida/runs/*/context.md`
- `.cursor/rules/aida/*`
- `.codex/rules/aida/*`
- `.claude/rules/aida/*`
- `.lingma/rules/*`
- 工具侧由 AIDA 分发的 skill / command 文件

建议：

- 想长期保留的内容写回 `.aida/*.json` 真源
- 不要把人工维护内容放进 AIDA 受管生成目录

## 当前边界

- `rules edit` 还未实现
- `skills edit` 仍是 whole-document 编辑，不是结构化局部编辑
- 目前没有本地 Web editor
- 某些工具导入仍偏 config-first，不是完整语义导入
