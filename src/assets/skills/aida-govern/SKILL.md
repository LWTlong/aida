---
name: aida-govern
description: 一站式 AI 资产治理：扫描 → 分析 → 用户确认 → 一次性落盘。当用户说"治理 AI 资产"、"帮我整理规则"、"跑一次完整治理"时触发。
---

# AIDA Govern

## Goal
一次连贯的 AI 资产治理流程。**一站式** —— 不要把子问题推给其他 skill，所有类别的清理都在这一次流程里给出方案。

## Safety Rules
- 先分析，不写文件。
- 用 AskUserQuestion 让用户明确确认后再落盘。
- 所有写操作走 `aida_apply_governance`（journal 内建，出错用 `aida_undo` 一键回滚）。
- 分组要少、要有意义，不要一条规则一个动作。
- **绝不 punt**：识别出的每一类问题都必须给出计划动作，不要说"建议另行 /aida-xxx 处理"。

## Flow

### Phase 1 — 扫描并分析
1. `aida_scan_assets`（`writeIndex: true`, `includeContent: false`）。
2. `aida_list_assets` 汇总类型和工具分布。

3. **准备工作：先读懂项目是什么**。扫一眼根目录（`ls`），读项目的依赖清单（`package.json` / `pom.xml` / `requirements.txt` / `go.mod` / `Cargo.toml`，哪个存在读哪个）。目标是建立"这个项目实际用的技术栈"的认知，供后续判断用。

   **必须逐一检查 `.claude/rules/**/*.md`, `.claude/skills/**/*.md`, `.cursor/rules/**/*.md`, `.codex/rules/**/*.md` 的每一个文件。** 这是主战场，不是可选项。用 `aida_get_asset` 或直接 Read。对每个文件判断：

   | 判断 | 触发条件 | 建议动作 |
   |---|---|---|
   | 聚合镜像 | 文件名 `_` 开头（`_all.md`、`_index.md`）；文件头有 `<!-- AUTO-GENERATED -->`；内容明显是同目录其他 md 的拼接 | **`delete-file`（不要犹豫）** |
   | **无关规则** | 规则里描述的技术/API/框架，在当前项目里**根本不存在**（根据上面读到的项目技术栈判断）。判断标准：如果这条规则在这个项目里 100% 永远不会被触发，它就是无关规则。 | **`remove-lines` 批量删**，把同一来源的无关规则一次删完，不要一条条问 |
   | **Checklist 条目** | 行内容是 `[ ]` 或 `[x]` 开头的清单项（如 `[ ] 命名规范正确`）。这是 PR 审查模板，不是 AI 约束，对 Claude 执行没有任何意义。 | **`remove-lines` 批量删**（全部删，不保留） |
   | 规则过载 | **无关规则和 checklist 删完后**，文件条目仍很多；或规则内容大量是编码样式描述（缩进/引号/换行等格式细节） | `modify-file` 整合：把纯格式类规则合并为一个 `## Style Guide` 段落，保留有实际约束力的硬规则 |
   | **任务型规则（工作流）** | 一组规则放在一起，共同描述一个完整的操作流程（如"新增页面步骤"、"i18n 翻译流程"）。判断标准：这组规则有顺序/依赖关系，或者全部在回答"如何完成 X 任务"，而不是"必须遵守 X 约束"。 | `create-file` 在 `.claude/skills/` 建对应 skill + `remove-lines` 从规则文件删这些行 |
   | 跨工具重复 | `.codex/rules/**` 或 `.cursor/rules/**` 里内容与 `.claude/rules/**` 完全一致 | `delete-file` 删镜像端，保留 `.claude/` |
   | 合并冲突 | 文件里有 `<<<<<<<` 标记 | 提示用户先处理冲突 |
   | AI 生成文档冗余 | `docs/` 或根目录 md 文档，内容过时、与规则冲突、明显是 AI 生成的分析报告 | `delete-file` 或 archive |
   | **2.x 目录嵌套** | `.claude/rules/aida/*.md`（多余的 `aida/` 层级，Claude Code 会加载 `.claude/rules/*.md` 平铺结构） | `create-file` 复制到 `.claude/rules/` 平铺 + `delete-file` 删旧路径。**保留 `.claude/rules/decisions/` 子目录**（MADR 记忆的合法分组）。|

   **必须给出的输出**：每个源规则目录（`.claude/rules/aida/` 等）都要在计划表里出现，即使动作是"保留原样"也要明说，不要静默跳过。

3.5. **检查根目录 CLAUDE.md**（如果存在）：

   Claude Code 会自动读根目录 `CLAUDE.md` 作为项目指令。**内容必须与项目当前状态一致**。判断：

   | 触发条件 | 建议动作 |
   |---|---|
   | 提到不存在的 MCP tool（如 `aida_record`、`aida rules add`） | `modify-file` 重写 |
   | 强制读的路径不存在（如 `.aida/aida-guide.md`、`.claude/rules/aida/_all.md` 已被本次治理删除） | `modify-file` 重写 |
   | 引用的规则路径与实际结构不符（例如指向 `aida/` 子目录，但已扁平化） | `modify-file` 重写 |

   3.0 基准 CLAUDE.md 模板（保留项目自定义的其他内容）：
   ```markdown
   # CLAUDE.md

   ## AIDA 使用规范

   - 开发前先跑 `/aida-audit` 了解项目 AI 资产分布。
   - 需要治理规则/skill 时跑 `/aida-govern`（会先分析，用户确认后落盘，可 `/aida-undo` 回滚）。
   - 沉淀"为什么这么写"用 `/aida-remember`（写入 `.claude/rules/decisions/`，Claude Code 会按 `paths` 前置元数据自动加载）。
   - 所有 AIDA 写操作都通过 `aida_apply_governance`，可 `aida_undo` 回滚。
   ```
4. **检测 2.x 遗留物**：
   - `.aida/proposals/*.json` — 旧版审批草稿，3.0 已不使用
   - `.aida/memories/index.json` schemaVersion 为 `2.0` 且 `.aida/memories/modules/` 下有 JSON — 旧版模块记忆
   - `.aida/reports/*.json` — 旧版报告
   - 如发现，作为独立分组"归档 2.x 遗留物"纳入清理清单

5. **检测 3.0 迁移状态（只有检测到 2.x 遗迹时才提示，全新项目跳过）**：

   跑三个检查判断是否处于 2.x → 3.0 迁移期：

   **a. `.aida/` 是否被 git track？**（`git ls-files .aida/` 有输出）
   → 命中 = 2.x 遗留（`.aida` 曾是 canonical store）

   **b. `.claude/` 是否被 git track？**（`git ls-files .claude/` 无输出但目录里有内容）
   → 命中 = 2.x 遗留（`.claude` 曾是投影产物没 track）

   **c. `.gitignore` 是否有 2.x 反模式？**
   - 裸 `.claude/` 或 `.claude/rules/` 被 ignore（无对应 `!` 例外）
   - `.aida/**` + `!.aida/**/*.json` 之类"开洞"写法
   - 重复 ignore（多次列同一路径）

   **判定**：
   - a/b/c 全部未命中 → **不输出"3.0 迁移"分组**，跳过 gitignore 相关动作
   - 任一命中 → 输出"3.0 迁移"分组，包含：
     - `modify-file` `.gitignore` 到 3.0 基准
     - Phase 4 追加手动 `git rm --cached` 收尾指令

   `.gitignore` 3.0 基准模板（保留项目原有的非 AI 部分如 `node_modules/`）：
   ```
   # Build / deps
   node_modules/
   dist/
   ...（保留项目原有的构建产物 ignore）

   # AIDA local cache (not tracked)
   .aida/

   # Per-user config (not tracked, use aida init to generate)
   .mcp.json
   .vscode/mcp.json
   CLAUDE.md
   AGENTS.md
   ```

   **⚠️ 关键：仅改 `.gitignore` 不够 —— 已被 track 的文件不会自动 untrack。**必须让用户在 Phase 4 手动跑 `git rm --cached`（`aida_apply_governance` 不碰 git 索引）。见 Phase 4。

### Phase 2 — 展示分析并请求确认
输出分析结果（见下方 Output Format），然后**调用 AskUserQuestion**（不要用纯文本让用户猜）：

- `header`: "开始治理"
- `question`: "确认后我会直接把这些改动落盘（可用 aida_undo 一键回滚）"
- `options`:
  - `label`: "开始治理"
  - `description`: "执行下列 N 组动作，共约 M 个文件操作。全部通过 aida_apply_governance 落盘，出错可回滚。"
  - `label`: "只看分析"
  - `description`: "停在分析结果，不改任何文件。"

如果用户选"只看分析"：结束，给一句"如需执行，再说 /aida-govern"。
如果用户选"开始治理"：继续 Phase 3。

### Phase 3 — 构造并执行 apply_governance
把每组动作拆成 `aida_apply_governance` 的 `operations`。可用 op 类型：

| op | 用途 |
|----|------|
| `remove-lines` | 删指定行号（`lines: number[]`） |
| `modify-file` | 用 `content` 整体覆盖文件（合并重复规则、拆分过长规则、重写文件） |
| `create-file` | 用 `content` 新建文件（比如把一组任务型规则提取成新 skill） |
| `delete-file` | 删除文件（遗留物归档、无用聚合镜像） |

**规则粒度问题的处理**（避免 punt）：
- 如果某个规则文件条目数 > 200，检查是否是**聚合镜像**（内容来自其他源文件拼接）
  - 是 → `delete-file` 删镜像，保留源
  - 否 → 分析规则内容，把编码风格类样板规则整合为一个 style-guide 章节（`modify-file`），保留有编号的硬约束
- 冲突/重复行：`remove-lines`
- 任务型规则：`create-file` 建 skill + `remove-lines` 从规则文件删

**提取 skill 的文件格式**（`create-file` 时用此格式）：
```markdown
---
name: skill-name
description: 一句话，描述触发场景
---

# Skill Title

## Goal
一句话目标

## Steps
1. 步骤一
2. 步骤二
...
```
skill 文件路径：`.claude/skills/<name>.md`

**批次策略**：
- 每批 ≤ 20 个 op（保持 undo 粒度可控）
- 每批一个明确的 `description`
- 大批治理拆多次 `aida_apply_governance` 调用

### Phase 4 — 汇报结果 + 3.0 迁移收尾指令
一句话结论 + 一张结果表。**不要提 Dashboard**（3.0 无治理审批 UI）。给出 undo 提示。

**只有 Phase 1 步骤 5 检测到 2.x 遗迹时，才追加"3.0 迁移收尾"段落**。全新项目或已经在 3.0 基准的项目跳过这一段。命中时让用户手动跑：

```bash
# 1) 从 git 索引移除 .aida/（本地文件保留，git 不再跟踪）
git rm -r --cached .aida/ 2>/dev/null

# 2) 首次把 .claude/ 加入 git（团队协作源头）
git add .claude/

# 3) 提交
git commit -m "chore: 迁移到 AIDA 3.0 gitignore 基准"
```

明确告诉用户：**这三行只需要跑一次**（3.0 迁移期），之后的正常 `aida-govern` 都不会再输出这段。

## Response Style
- 短。结论优先。数字进表格。
- 分析阶段：至多 3 条重点问题。
- 确认阶段：一次 AskUserQuestion。
- 执行后：一句下一步提示。
- 不要提"Dashboard 审核"、"proposal"、"草稿"。
- **绝对禁止**说"建议另行 /aida-xxx 处理" —— 本 skill 就要处理完。

## Output Format

### 分析阶段

#### 结论
一句话，总结健康度 + 待处理项数。**不要 punt**。

#### 关键数据
| 指标 | 数量 |
|---|---:|
| 总资产 | ... |
| 规则 | ... |
| Skill | ... |
| 重复组 | ... |
| 聚合镜像 | ... |
| 2.x 遗留物 | ... |
| .gitignore 策略问题 | ... |

#### 计划动作
覆盖所有识别出的问题，每一类都有对应的行：

| 分组 | 动作 | 影响文件数 |
|---|---|---:|
| A. 删除聚合镜像 | 删除 .claude/rules/aida/_all.md | 1 |
| B. 归档 2.x 遗留 | 删除 .aida/proposals/*.json 等 | 3 |
| C. 修复 .gitignore | 让 .claude/ 被 track、.aida/ 整目录 ignore | 1 |
| D. 整合样板规则 | 把 general.md 里 440 条编码风格规则合并为 style-guide 章节 | 1 |
| ... | ... | ... |

#### 确认
调用 AskUserQuestion（不要输出纯文本选项）。

### 执行阶段

#### 结论
一句话，例如："完成 5 组治理动作，共写入 27 个文件。"

#### 结果
| 分组 | 状态 | Undo ID |
|---|---|---|
| A. 去重规则行 | ✅ | undo-1 |
| B. 归档 2.x 遗留 | ✅ | undo-2 |

#### 下一步
```text
如需回滚，运行 /aida-undo
```
