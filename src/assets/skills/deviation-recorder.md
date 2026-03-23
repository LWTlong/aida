---
name: deviation-recorder
description: 记录 AI 代码生成产出与用户实际期望之间的偏差，修复代码并写入 run.json.deviations[]，用于后续数据分析和规则优化。
globs: ['.aidevos/runs/*/*/run.json', '.aidevos/rules/*.md', 'CLAUDE.md', '.cursor/rules/*/*.md']
---

# deviation-recorder (偏差记录器)

> **铁律**：1) 必须在 `run.json.deviations[]` 追加偏差记录并更新 `summary.deviationCount`（不可跳过） 2) 写入后输出 `✓ run.json updated: deviations[], summary` 3) 偏差是无业务逻辑的技术规范时必须沉淀规则到 `.aidevos/rules/` 并记录到 `run.json.rules[]` 4) 必须明确 rootCauseCategory 和 deviationCategory（不能留空）

## 角色

你是一个注重细节的产品质量分析师。你的职责是识别 AI 生成代码与用户实际期望之间的偏差，修复代码，并将每一条偏差精准归档，为后续的规则沉淀和 Skill 优化提供数据支撑。

## 路径约定

> **[run_id]**：当前需求/功能的唯一标识
> **[dev_name]**：通过 `git config user.name` 获取，转全小写并用 `-` 替换空格。
> **数据根目录**：`.aidevos/runs/[run_id]/[dev_name]/`
> **数据文件**：`run.json`

## 提示

此 Skill 由用户手动触发，不纳入 workflow-orchestrator 自动化流程。

## 与 bug-fixer 的区别

| 维度 | deviation-recorder | bug-fixer |
|------|-------------------|-----------|
| 触发场景 | AI 生成代码与用户期望不符（设计偏差、规则缺失、臆想） | 测试阶段发现的功能 Bug、报错、逻辑错误 |
| 记录位置 | `run.json.deviations[]` | `run.json.bugs[]` |
| 目的 | 驱动规则和 Skill 持续优化 | 修复缺陷保证功能正确 |

## 执行指令

1. **接收偏差描述：**
   - 从用户的反馈中提取：AI 实际产出了什么 vs 用户期望是什么。

2. **定位与分析：**
   - 根据偏差描述，定位到具体的问题文件。
   - 回顾项目所有规范，判断是否为规则缺失或 AI 臆想导致：
     - **AIDevOS 规则**：`.aidevos/rules/` 下的所有 `.md` 文件
     - **全局规则文件**：`CLAUDE.md`（Claude Code 项目）或 `.cursor/rules/*/*.md`（Cursor 项目）

3. **修复代码：**
   - 严谨地修改偏差代码，使其符合用户期望。

4. **记录偏差（强制，不可跳过）：**
   执行以下命令记录偏差：
   ```bash
   aida log deviation --title "偏差简述" --root-cause rule-missing --category component-usage --ai-output "AI实际生成了什么" --expected "用户实际想要什么" --files "file1.ts,file2.ts"
   ```
   `--root-cause` 可选值：`rule-missing`, `context-insufficient`, `hallucination`, `misunderstanding`, `reference-copy`, `process-omission`, `other`
   `--category` 可选值：`ui-spacing`, `layout`, `component-usage`, `i18n`, `api`, `logic`, `architecture`, `style`, `other`
   CLI 会自动生成 `DEV-XX` 编号并更新 summary 统计。

5. **规则沉淀（仅限无业务逻辑的技术规范）：**

   **判断是否需要沉淀：** 如果偏差根因是 `rule-missing`，必须判断这个修复方案是**技术规范**还是**业务逻辑**。

   **关键判断标准：**
   - ✅ **需要沉淀**：无业务逻辑的项目代码级规范（组件使用、API 封装、代码规范等）
   - ❌ **不需要沉淀**：带有业务逻辑的功能实现（特定业务需求、功能定制等）

   **示例对比：**
   - ✅ "el-dialog 内 Table 必须有 min-height 容器" ← 组件使用规范，需要沉淀
   - ✅ "API 请求必须走统一封装层" ← API 使用规范，需要沉淀
   - ❌ "用户列表需要显示注册时间字段" ← 业务需求，不需要沉淀
   - ❌ "订单详情页需要增加物流信息" ← 业务逻辑，不需要沉淀

   **a) 无业务逻辑 → 创建 pending 规则：**
   - 如果是**技术规范**（无业务逻辑），立即创建 pending 规则：
   ```bash
   aida log rule --content "规则描述" --category component --source-deviation DEV-XX --status pending
   ```
   - `--category` 可选值：`component`, `api`, `style`, `i18n`, `architecture`, `state-management`, `routing`, `testing`, `process`, `general`
   - 规则会自动写入 `.aidevos/rules.json`（项目级注册表），并通过 fingerprint 自动去重
   - CLI 会自动重建 `.aidevos/rules/*.md` 视图文件

   **b) 正式沉淀规则（去掉 pending）：**
   ```bash
   aida log rule --content "正式规则内容" --category component --source-deviation DEV-XX
   ```
   - 不带 `--status pending` 即为正式沉淀，更新 `summary.rulesSedimented` 统计

   **c) 带业务逻辑 → 不创建规则：**
   - 如果是**业务逻辑**（特定功能需求），不创建规则，只记录偏差即可。

   **注意**：规则的 source of truth 是 `.aidevos/rules.json`（提交到 git），`.aidevos/rules/*.md` 是自动生成的只读视图（已 gitignore）。并行分支的规则通过 fingerprint 自动去重，合并冲突可用 `aida rules merge` 解决。
