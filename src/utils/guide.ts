/**
 * AIDA Guide — ensures data collection and rule sedimentation guidance
 * is written to AI tool instruction files.
 *
 * Single source of truth: .aidevos/aida-guide.md
 * References: CLAUDE.md (Claude Code) / .cursor/rules/ (Cursor)
 */

import { resolve } from 'node:path';
import { fileExists, readText, writeText, ensureDir } from './fs.js';
import { aidevosDir } from './paths.js';

// ─── Guide Content ──────────────────────────────────────

const GUIDE_FILENAME = 'aida-guide.md';

const GUIDE_CONTENT = `# AIDA 数据采集与规则沉淀指南

> 此文件引导 AI 在开发过程中采集结构化数据并沉淀项目规则。由 AIDA 自动生成，请勿删除。
> **这是强制规范，不是可选建议。**

## 零、已沉淀的项目规则（开发前必读）

**在开始任何开发任务之前**，如果存在 \`.aidevos/rules/_all.md\` 文件，必须先读取该文件了解已沉淀的项目规则，并在后续开发中严格遵守。这些规则是从历次开发偏差中提炼出来的项目级规范，遵守它们可以避免重复犯错。

## 一、数据采集

### 核心原则

每个任务的完整生命周期必须被记录。遗漏数据采集节点等于数据缺失，会导致看板和分析不准确。

### 单个任务的数据采集流程

每接到一个任务/功能/修改，必须按以下顺序调用：

1. **开始前** → 调用 \`aida_task_start\`，传入任务标题和所属模块
2. **编码完成后** → 调用 \`aida_log_files\`，自动扫描 git diff 记录文件变更（无需传参）
3. **自检代码** → 对照项目规范审查自己的产出，调用 \`aida_log_review\` 记录审查结果（pass/fail + 问题列表）
4. **任务完成** → 调用 \`aida_task_done\`，传入任务 ID

### 过程中的事件记录

在开发过程中遇到以下情况时，必须立即记录：

- **发现 Bug** → 调用 \`aida_log_bug\`，传入描述和严重程度（critical/high/medium/low）
- **修复 Bug** → 调用 \`aida_bug_fix\`，传入 Bug ID 和修复方案
- **用户指出偏差**（AI 产出与用户预期不符） → 调用 \`aida_log_deviation\`，传入偏差描述、根因分类（rootCause）和偏差类别（category）
- **值得记录的亮点**（如性能优化、架构改进） → 调用 \`aida_highlight\`

### rootCause 和 category 参数说明

\`aida_log_deviation\` 的 rootCause 可选值：
- \`rule-missing\`：项目规范中缺少对应规则
- \`hallucination\`：AI 臆想了不存在的 API/组件/用法
- \`context-insufficient\`：上下文信息不足导致产出偏差
- \`misunderstanding\`：AI 理解错了用户意图
- \`reference-copy\`：AI 照搬了参考代码但不适用
- \`process-omission\`：AI 跳过了必要的步骤
- \`other\`：其他原因

category 可选值：
- \`ui-spacing\`, \`layout\`, \`component-usage\`, \`i18n\`, \`api\`, \`logic\`, \`architecture\`, \`style\`, \`other\`

### 多任务场景

如果一次需求包含多个子任务，每个子任务都必须单独调用 \`aida_task_start\` 和 \`aida_task_done\`。\`aida_log_files\` 可以在每个任务完成后调用，也可以在一批任务完成后统一调用一次。

### 查看当前状态

随时可以调用 \`aida_status\` 查看当前的任务列表、Bug 数量、进度等信息。

## 二、规则沉淀

当通过 \`aida_log_deviation\` 记录偏差，且 rootCause 为 \`rule-missing\` 时，必须评估是否需要沉淀规则。

### 判断标准（严格执行）

**需要沉淀 — 仅限项目级技术规范：**
- 公共组件的使用方式错误（如：el-dialog 内 Table 必须有 min-height 容器）
- 公共模块/能力的调用方式错误（如：API 请求必须走统一封装层）
- 参数传递错误（如：日期组件必须传 format="YYYY-MM-DD"）
- 代码风格/架构规范（如：状态管理必须使用 Pinia，禁止直接操作 localStorage）

**绝对不沉淀 — 业务逻辑：**
- 特定页面的功能需求（如：用户列表需要显示注册时间）
- 特定业务流程的实现（如：订单状态流转需要通知仓库）
- 一次性的数据处理逻辑

### 执行流程

1. 修复偏差代码后，判断修复方案是否属于上述"需要沉淀"的范围
2. 如果是，**必须询问用户**："这个偏差的修复方案属于项目级规范，沉淀为规则后可以防止同类问题复现。是否沉淀为项目规则？"
3. 用户同意后，调用 \`aida_log_rule\` 工具，传入参数：
   - content: 规则描述
   - category: 分类（可选值：component, api, style, i18n, architecture, state-management, routing, testing, process, general）
   - sourceDeviation: 关联的偏差 ID（如 DEV-01）

### 阶段性回顾

完成一轮开发（多个任务完成）后：
1. 调用 \`aida_status\` 查看当前偏差情况
2. 检查是否有 rootCause 为 \`rule-missing\` 的偏差尚未沉淀对应规则
3. 如果有，汇总这些偏差模式并询问用户是否需要批量沉淀
`;

// ─── CLAUDE.md reference ────────────────────────────────

const CLAUDE_MARKER = '.aidevos/aida-guide.md';

const CLAUDE_REFERENCE = `

## AIDA

本项目使用 AIDA 进行开发数据采集与规则沉淀，开发过程中必须遵循 \`.aidevos/aida-guide.md\` 中的数据采集和规则沉淀规范。如果存在 \`.aidevos/rules/_all.md\`，请在开始开发前读取该文件了解已沉淀的项目规则。
`;

// ─── Cursor rule frontmatter ────────────────────────────

const CURSOR_FRONTMATTER = `---
description: AIDA 数据采集与规则沉淀规范
globs: ['**/*']
---

`;

// ─── Lingma rule frontmatter ──────────────────────────

const LINGMA_FRONTMATTER = `---
description: AIDA 数据采集与规则沉淀规范
globs: ['**/*']
---

`;

// ─── Public API ─────────────────────────────────────────

export function guidePath(projectRoot: string): string {
  return resolve(aidevosDir(projectRoot), GUIDE_FILENAME);
}

/**
 * Write .aidevos/aida-guide.md if it doesn't exist.
 */
export function ensureGuide(projectRoot: string): void {
  const p = guidePath(projectRoot);
  if (fileExists(p)) return;
  ensureDir(aidevosDir(projectRoot));
  writeText(p, GUIDE_CONTENT);
}

/**
 * Add guide reference to AI tool instruction files.
 * Called by init (with explicit tool list) or ensureRunJson (auto-detect).
 */
export function syncGuideReference(projectRoot: string, tools?: string[]): void {
  const detected = tools || detectAiTools(projectRoot);
  for (const tool of detected) {
    switch (tool) {
      case 'claude-code':
        addClaudeReference(projectRoot);
        break;
      case 'cursor':
        addCursorReference(projectRoot);
        break;
      case 'lingma':
        addLingmaReference(projectRoot);
        break;
    }
  }
}

// ─── Internal ───────────────────────────────────────────

function detectAiTools(projectRoot: string): string[] {
  const tools: string[] = [];
  if (fileExists(resolve(projectRoot, '.mcp.json'))) tools.push('claude-code');
  if (fileExists(resolve(projectRoot, '.cursor', 'mcp.json'))) tools.push('cursor');
  if (fileExists(resolve(projectRoot, '.lingma', 'mcp.json'))) tools.push('lingma');
  return tools;
}

function addClaudeReference(projectRoot: string): void {
  const file = resolve(projectRoot, 'CLAUDE.md');
  if (fileExists(file)) {
    const content = readText(file);
    if (content.includes(CLAUDE_MARKER)) return;
    writeText(file, content + CLAUDE_REFERENCE);
  } else {
    writeText(file, CLAUDE_REFERENCE.trim() + '\n');
  }
}

function addCursorReference(projectRoot: string): void {
  const rulesDir = resolve(projectRoot, '.cursor', 'rules', 'aidevos');
  ensureDir(rulesDir);
  const file = resolve(rulesDir, 'aida-guide.md');
  if (fileExists(file)) return;
  writeText(file, CURSOR_FRONTMATTER + GUIDE_CONTENT);
}

function addLingmaReference(projectRoot: string): void {
  const rulesDir = resolve(projectRoot, '.lingma', 'rules');
  ensureDir(rulesDir);
  const file = resolve(rulesDir, 'aida-guide.md');
  if (fileExists(file)) return;
  writeText(file, LINGMA_FRONTMATTER + GUIDE_CONTENT);
}
