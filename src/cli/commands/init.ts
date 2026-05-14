import { resolve } from 'node:path';
import {
  ensureDir,
  readText,
  fileExists,
  getProjectName,
  writeJson,
} from '../../utils/fs.js';
import { bold, green, cyan, dim, yellow } from '../../utils/display.js';
import { addRule } from '../../utils/rules.js';
import { ensureGuide, syncGuideReference, updateGuide, updateGuideReferences } from '../../utils/guide.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';
import { detectClosedLoopImportableTools, importExistingToolConfigs, importFromTool, mergeConfiguredTools } from '../../utils/import.js';
import { promptMultiSelect, promptSingleSelect, promptText } from '../../utils/prompt.js';
import type { AiToolChoice } from '../../schemas/aida-project.js';
import { defaultSkillScanPaths } from '../../services/security-audit.js';

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

// ─── Init command ────────────────────────────────────────

export async function init(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aida');

  console.log(`\n  ${bold('AIDA')} - Project AI truth-source setup\n`);

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
    console.log(green('\n  ✓ Built') + ` ${built.tools.join(', ')} artifacts`);
    console.log(green('\n  ✓ Done!') + ' New tool(s) added successfully.\n');
    return;
  }

  const mode = 'collect';

  // Step 1: Select AI tools (multi-select)
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

  // Step 2: Optional AI model
  let aiModel = '';
  console.log('\n  ? Which AI model are you using? (e.g. claude-sonnet-4, gpt-4o)\n');
  console.log(dim('    Press Enter to skip, you can set it later.\n'));
  aiModel = await promptText('  > ');

  console.log(`\n  Initializing AIDA 2.0...\n`);

  // 1. Create directory structure
  ensureDir(aidevos);
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

  // 8. Write config.json
  const projectName = getProjectName();
  const configData: Record<string, any> = {
    schemaVersion: '2.0',
    mode,
    aiTools: selectedTools,
    project: projectName,
    security: {
      skillScanPaths: defaultSkillScanPaths(),
    },
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

  // Done
  console.log(`
  ${green('✓ Done!')} Data collection is ready.

    MCP Server will auto-start when your AI tool loads.
    AI will use rules, memories, and summary as the 2.0 truth sources.

    Refresh generated artifacts anytime: ${cyan('aida sync')}
`);
  printManualUntrackNotice();
}
