import { resolve } from 'node:path';
import { SKILLS_DIR } from '../../utils/paths.js';
import {
  ensureDir,
  writeText,
  readText,
  fileExists,
  getProjectName,
  writeJson,
} from '../../utils/fs.js';
import { bold, green, cyan, dim, yellow } from '../../utils/display.js';
import { addRule } from '../../utils/rules.js';
import { ensureGuide, syncGuideReference, updateGuide, updateGuideReferences } from '../../utils/guide.js';
import { ensureBundledSkills, seedBundledSkillRegistry, getSkillContent } from '../../utils/skills.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';
import { detectClosedLoopImportableTools, importExistingToolConfigs, importFromTool, mergeConfiguredTools } from '../../utils/import.js';
import { promptMultiSelect, promptSingleSelect, promptText } from '../../utils/prompt.js';
import type { AiToolChoice } from '../../schemas/aida-project.js';

const QUICK_COMMANDS: { name: string; skill: string }[] = [
  { name: 'workflow', skill: 'workflow-orchestrator' },
  { name: 'audit', skill: 'audit' },
  { name: 'deviation', skill: 'deviation-recorder' },
  { name: 'self-reviewer', skill: 'self-reviewer' },
  { name: 'bug-fixer', skill: 'bug-fixer' },
  { name: 'rules-evolver', skill: 'rules-evolver' },
];

const OPTIONAL_COMMANDS: { name: string; skill: string; desc: string }[] = [
  { name: 'commit-code', skill: 'commit-code', desc: 'Git commit assistant' },
  { name: 'docx-to-markdown', skill: 'docx-to-markdown', desc: 'Convert DOCX to Markdown' },
];

const ALL_SKILLS = [
  'workflow-orchestrator',
  'requirement-analyzer',
  'task-splitter',
  'code-generator',
  'self-reviewer',
  'bug-fixer',
  'deviation-recorder',
  'dashboard-generator',
  'commit-code',
  'docx-to-markdown',
  'mcp-reviewer',
  'rules-evolver',
  'dev-flower',
  'audit',
];

const IRON_RULES_APPEND = `

## AIDevOS Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
4. 只有当修改实际落到项目仓库代码或配置后，才进入 AIDA task flow；纯调查、只读分析、聊天、git 历史排查、本地环境操作、不会落库的实验都不记录 task/context/memory
5. 当用户直接要求沉淀项目级技术规范，或识别到 rule-missing 需要沉淀规则时，必须通过 AIDA MCP 的 aida_log_rule 写入 .aida/rules.json，不要只修改本地规则说明文件
`;

function printManualUntrackNotice(): void {
  console.log(dim('  Note: If any ignored AI files were already tracked by git before init, untrack them manually.'));
  console.log(dim('        Example: git rm --cached .mcp.json AGENTS.md CLAUDE.md\n'));
}

function toolLabel(tool: AiToolChoice): string {
  const labels: Record<AiToolChoice, string> = {
    'claude-code': 'Claude Code',
    cursor: 'Cursor',
    'vscode-copilot': 'VS Code + Copilot',
    windsurf: 'Windsurf',
    lingma: 'Lingma',
    codex: 'Codex',
  };
  return labels[tool];
}

function toolOptions(tools: AiToolChoice[]) {
  return tools.map((tool) => ({ value: tool, label: toolLabel(tool) }));
}

function copyOptionalCommands(projectRoot: string, tools: AiToolChoice[], commands: { name: string; skill: string }[]): number {
  let copied = 0;

  if (tools.includes('claude-code')) {
    const cmdDir = resolve(projectRoot, '.claude', 'commands');
    ensureDir(cmdDir);
    for (const cmd of commands) {
      const content = getSkillContent(projectRoot, cmd.skill);
      if (!content) continue;
      writeText(resolve(cmdDir, `${cmd.name}.md`), content);
      copied++;
    }
  }

  if (tools.includes('cursor')) {
    for (const cmd of commands) {
      const content = getSkillContent(projectRoot, cmd.skill);
      if (!content) continue;
      const destDir = resolve(projectRoot, '.cursor', 'skills', cmd.name);
      ensureDir(destDir);
      writeText(resolve(destDir, 'SKILL.md'), content);
      copied++;
    }
  }

  return copied;
}

// ─── Init command ────────────────────────────────────────

export async function init(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aida');

  console.log(`\n  ${bold('AIDA')} - AI Development Observability Platform\n`);

  // Check if already initialized
  if (fileExists(resolve(aidevos, 'config.json'))) {
    console.log(yellow('  AIDA is already initialized in this project.\n'));
    const choice = await promptSingleSelect(
      'What would you like to do?',
      [
        { value: 'add', label: 'Add a new AI tool' },
        { value: 'repair', label: 'Repair missing generated files', hint: 'guide, MCP config, .gitignore' },
        { value: 'exit', label: 'Exit' },
      ],
      { allowSkip: true },
    );

    if (choice === 'exit' || choice === null) {
      console.log(dim('\n  No changes made.\n'));
      return;
    }

    // Load existing config
    const existingConfig = JSON.parse(readText(resolve(aidevos, 'config.json')));
    const existingTools: AiToolChoice[] = existingConfig.aiTools || [];

    // ── Option 2: Repair missing files ──────────────────
    if (choice === 'repair') {
      console.log('\n  Repairing...\n');
      ensureDir(resolve(aidevos, 'runs'));
      const repaired = buildProjectArtifacts(projectRoot, existingTools);
      updateGuide(projectRoot);
      updateGuideReferences(projectRoot, existingTools);
      console.log(green('  ✓ Rebuilt') + ` core artifacts for ${repaired.tools.join(', ') || 'configured tools'}`);

      console.log(green('\n  ✓ Done!') + ' Missing files have been filled in.\n');
      return;
    }

    // ── Option 1: Add a new AI tool ──────────────────────
    const candidates = (['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex'] as AiToolChoice[])
      .filter((tool) => !existingTools.includes(tool));
    if (candidates.length === 0) {
      console.log(yellow('\n  All supported AI tools are already configured.\n'));
      return;
    }
    const newTools = await promptMultiSelect(
      'Select AI tool(s) to add:',
      toolOptions(candidates),
      { required: true },
    );

    // Update config.json
    existingConfig.aiTools = [...existingTools, ...newTools];
    writeJson(resolve(aidevos, 'config.json'), existingConfig);
    const built = buildProjectArtifacts(projectRoot, newTools);
    if (existingConfig.mode === 'full') {
      seedBundledSkillRegistry(projectRoot);
    }
    console.log(green('\n  ✓ Built') + ` ${built.tools.join(', ')} artifacts`);
    console.log(green('\n  ✓ Done!') + ' New tool(s) added successfully.\n');
    return;
  }

  // Step 1: Select mode
  const mode = await promptSingleSelect(
    'Select mode:',
    [
      { value: 'collect', label: 'Data collection only', hint: 'MCP, recommended for existing workflows' },
      { value: 'full', label: 'Full workflow', hint: 'MCP + Skills + slash commands' },
    ],
  );
  if (!mode) {
    console.log(dim('\n  No changes made.\n'));
    return;
  }

  // Step 2: Select AI tools (multi-select)
  const selectedTools = await promptMultiSelect(
    'Which AI tools do you use?',
    toolOptions(['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex']),
    { required: true },
  );

  const importableTools = detectClosedLoopImportableTools(projectRoot, selectedTools);
  let baselineTool: AiToolChoice | null = null;
  if (importableTools.length > 0) {
    baselineTool = await promptSingleSelect(
      'Found existing closed-loop tool rules/skills/config. Choose one baseline tool to import into AIDA JSON:',
      toolOptions(importableTools),
      { allowSkip: true },
    );
  }

  // Step 3: AI model (only for full mode)
  let aiModel = '';
  if (mode === 'full') {
    console.log('\n  ? Which AI model are you using? (e.g. claude-sonnet-4, gpt-4o)\n');
    console.log(dim('    Press Enter to skip, you can set it later.\n'));
    aiModel = await promptText('  > ');
  }

  // Step 4: Optional tools (only for full mode)
  const selectedOptional: typeof OPTIONAL_COMMANDS = [];
  if (mode === 'full') {
    const optionalValues = await promptMultiSelect(
      'Optional tools:',
      OPTIONAL_COMMANDS.map((cmd) => ({ value: cmd.name, label: cmd.name, hint: cmd.desc })),
      { required: false },
    );
    for (const cmd of OPTIONAL_COMMANDS) {
      if (optionalValues.includes(cmd.name)) selectedOptional.push(cmd);
    }
  }
  console.log(`\n  Initializing AIDevOS...\n`);

  // 1. Create directory structure
  ensureDir(resolve(aidevos, 'runs'));
  console.log(green('  ✓ Created') + ' .aida/');

  // 3. Seed iron rules into rules.json registry
  const ironRules = [
    '禁止任何形式的臆想，不清楚必须询问',
    '禁止随意生成文档，如需生成文档，必须询问用户是否需要',
    '生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽',
    '只有当修改实际落到项目仓库代码或配置后，才进入 AIDA task flow；纯调查、只读分析、聊天、git 历史排查、本地环境操作、不会落库的实验都不记录 task/context/memory',
  ];
  for (const content of ironRules) {
    addRule(projectRoot, {
      content,
      category: 'process',
      branch: 'init',
      deviation: null,
      author: 'system',
      status: 'active',
    });
  }
  console.log(
    green('  ✓ Created') + ' .aida/rules.json       (with 4 iron rules)',
  );

  // 6. Full mode: copy skills + slash commands
  if (mode === 'full') {
    if (baselineTool) {
      const bundled = ensureBundledSkills(projectRoot);
      console.log(
        green('  ✓ Synced') + ` bundled skills into skills.json (+${bundled.added})`,
      );
    } else {
      seedBundledSkillRegistry(projectRoot);
      console.log(
        green('  ✓ Created') + ' .aida/skills.json     (skills source of truth)',
      );
    }
  }

  // 8. Write config.json
  const projectName = getProjectName();
  const configData: Record<string, any> = {
    schemaVersion: '1.0',
    mode,
    aiTools: selectedTools,
    project: projectName,
  };
  if (aiModel) configData.aiModel = aiModel;
  if (baselineTool) configData.baselineTool = baselineTool;
  writeJson(resolve(aidevos, 'config.json'), configData);

  if (baselineTool) {
    const imported = importFromTool(projectRoot, baselineTool);
    const snapshot = importExistingToolConfigs(projectRoot);
    mergeConfiguredTools(projectRoot, snapshot.tools.filter((tool) => selectedTools.includes(tool)));
    console.log(
      green('  ✓ Imported') +
      ` baseline tool ${toolLabel(baselineTool)} → ${imported.rulesImported} rules, ${imported.skillsImported} skills`,
    );
  }

  const built = buildProjectArtifacts(projectRoot, selectedTools);
  ensureGuide(projectRoot);
  syncGuideReference(projectRoot, selectedTools);
  console.log(green('  ✓ Built') + ` core artifacts for ${built.tools.join(', ')}`);

  if (mode === 'full') {
    const optionalCopied = copyOptionalCommands(projectRoot, selectedTools, selectedOptional);
    if (optionalCopied > 0) {
      console.log(green('  ✓ Copied') + ` ${optionalCopied} optional command files`);
    }

    for (const cmd of QUICK_COMMANDS) {
      console.log(dim(`    - /${cmd.name}`));
    }
    if (selectedOptional.length > 0) {
      console.log(dim(`  Optional:`));
      for (const cmd of selectedOptional) {
        console.log(dim(`    - /${cmd.name}`));
      }
    }

    const primaryTool = selectedTools.includes('claude-code') ? 'claude-code' : 'cursor';
    if (primaryTool === 'claude-code' || primaryTool === 'cursor') {
      syncIronRules(projectRoot, primaryTool);
    }
  }

  // Done
  if (mode === 'collect') {
    console.log(`
  ${green('✓ Done!')} Data collection is ready.

    MCP Server will auto-start when your AI tool loads.
    AI will silently collect data during development.

    View data anytime: ${cyan('aida dashboard')}
`);
    printManualUntrackNotice();
  } else {
    console.log(`
  ${green('✓ Done!')} Next steps:

    1. Run ${cyan('/audit')} to generate project-specific rules
    2. Start coding — AI will auto-collect data via MCP
    3. Run ${cyan('/workflow')} for the full AI development loop
    4. View data: ${cyan('aida dashboard')}
`);
    printManualUntrackNotice();
  }
}

function syncIronRules(
  projectRoot: string,
  tool: 'claude-code' | 'cursor',
): void {
  const marker = '## AIDevOS Iron Rules';

  if (tool === 'claude-code') {
    const file = resolve(projectRoot, 'CLAUDE.md');
    if (fileExists(file)) {
      const content = readText(file);
      if (content.includes(marker)) return;
      writeText(file, content + IRON_RULES_APPEND);
    } else {
      writeText(file, IRON_RULES_APPEND.trim() + '\n');
    }
  } else {
    // Cursor: write to .cursor/rules/aida/iron-rules.md
    const rulesDir = resolve(projectRoot, '.cursor', 'rules', 'aida');
    ensureDir(rulesDir);
    const file = resolve(rulesDir, 'iron-rules.md');
    if (fileExists(file)) {
      const content = readText(file);
      if (content.includes(marker)) return;
      writeText(file, content + IRON_RULES_APPEND);
    } else {
      writeText(file, IRON_RULES_APPEND.trim() + '\n');
    }
  }
}
