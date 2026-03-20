import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve, dirname } from 'node:path';
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
import { addRule, buildRuleViews } from '../../utils/rules.js';

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
`;

export async function init(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aidevos');

  console.log(`\n  ${bold('AIDevOS')} - AI Development Observability Platform\n`);

  // Check if already initialized
  if (fileExists(resolve(aidevos, 'config.json'))) {
    console.log(
      yellow('  AIDevOS is already initialized in this project.'),
    );
    console.log(
      dim('  To reinitialize, delete the .aidevos directory first.\n'),
    );
    return;
  }

  // Select AI tool
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log('  ? Select your AI tool:\n');
  console.log('    1) Claude Code');
  console.log('    2) Cursor\n');

  let tool: 'claude-code' | 'cursor';
  while (true) {
    const answer = (await rl.question('  > ')).trim();
    if (answer === '1') {
      tool = 'claude-code';
      break;
    }
    if (answer === '2') {
      tool = 'cursor';
      break;
    }
    console.log(yellow('  Please enter 1 or 2'));
  }

  // Ask for AI model
  console.log('\n  ? Which AI model are you using? (e.g. claude-sonnet-4, gpt-4o)\n');
  console.log(dim('    Press Enter to skip, you can set it later.\n'));
  const aiModel = (await rl.question('  > ')).trim();

  // Ask for optional tools
  console.log('\n  ? Optional tools (comma-separated numbers, or press Enter to skip):\n');
  OPTIONAL_COMMANDS.forEach((cmd, i) => {
    console.log(`    ${i + 1}) ${cmd.name} - ${cmd.desc}`);
  });
  console.log('');
  const optionsInput = (await rl.question('  > ')).trim();
  const selectedOptional: typeof OPTIONAL_COMMANDS = [];
  if (optionsInput) {
    const indices = optionsInput.split(',').map((s) => parseInt(s.trim())).filter(n => n > 0 && n <= OPTIONAL_COMMANDS.length);
    for (const idx of indices) {
      selectedOptional.push(OPTIONAL_COMMANDS[idx - 1]);
    }
  }

  rl.close();

  console.log(`\n  Initializing AIDevOS...\n`);

  // 1. Create directory structure
  ensureDir(resolve(aidevos, 'skills'));
  ensureDir(resolve(aidevos, 'rules'));
  ensureDir(resolve(aidevos, 'runs'));
  console.log(green('  ✓ Created') + ' .aidevos/');

  // 2. Copy all 14 skills to .aidevos/skills/
  for (const skill of ALL_SKILLS) {
    const src = resolve(SKILLS_DIR, `${skill}.md`);
    const destDir = resolve(aidevos, 'skills', skill);
    ensureDir(destDir);
    writeText(resolve(destDir, 'SKILL.md'), readText(src));
  }
  console.log(
    green('  ✓ Created') +
      ` .aidevos/skills/          (${ALL_SKILLS.length} skills)`,
  );

  // 3. Seed iron rules into rules.json registry
  const ironRules = [
    '禁止任何形式的臆想，不清楚必须询问',
    '禁止随意生成文档，如需生成文档，必须询问用户是否需要',
    '生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽',
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
  buildRuleViews(projectRoot);
  console.log(
    green('  ✓ Created') + ' .aidevos/rules.json       (with 3 iron rules)',
  );
  console.log(
    green('  ✓ Built')   + ' .aidevos/rules/*.md       (auto-generated views)',
  );

  // 4. Copy quick commands + optional tools to tool directory
  const allCommands = [...QUICK_COMMANDS, ...selectedOptional];
  if (tool === 'claude-code') {
    const cmdDir = resolve(projectRoot, '.claude', 'commands');
    ensureDir(cmdDir);
    for (const cmd of allCommands) {
      const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
      writeText(resolve(cmdDir, `${cmd.name}.md`), readText(src));
    }
    console.log(green('\n  ✓ Copied') + ' skills to .claude/commands/');
  } else {
    for (const cmd of allCommands) {
      const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
      const destDir = resolve(
        projectRoot,
        '.cursor',
        'skills',
        cmd.name,
      );
      ensureDir(destDir);
      writeText(resolve(destDir, 'SKILL.md'), readText(src));
    }
    console.log(green('\n  ✓ Copied') + ' skills to .cursor/skills/');
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

  // 5. Sync iron rules to tool config
  syncIronRules(projectRoot, tool);

  // 6. Write config.json
  const projectName = getProjectName();
  const configData: Record<string, string> = {
    schemaVersion: '1.0',
    aiTool: tool,
    project: projectName,
  };
  if (aiModel) {
    configData.aiModel = aiModel;
  }
  writeJson(resolve(aidevos, 'config.json'), configData);

  console.log(`
  ${green('✓ Done!')} Next steps:

    1. Run ${cyan('/audit')} to generate project-specific rules
    2. Run ${cyan('aidevos start')} to begin a development run
    3. Run ${cyan('/workflow')} to start the AI development loop
`);
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
    // Cursor: write to .cursor/rules/aidevos/iron-rules.md
    const rulesDir = resolve(projectRoot, '.cursor', 'rules', 'aidevos');
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
