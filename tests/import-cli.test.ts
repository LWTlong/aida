import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, fileExists, readJson, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput } from './helpers.js';
import { detectImportableTools, importFromTool } from '../src/utils/import.js';

describe('aida import', () => {
  it('should reverse-read existing rules, skills, and tool configs into JSON sources', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.aida', 'skills', 'workflow-orchestrator'));
      writeText(
        resolve(project.root, '.aida', 'skills', 'workflow-orchestrator', 'SKILL.md'),
        '# Workflow\n\nImported skill content\n',
      );
      writeText(
        resolve(project.root, '.aida', 'skills', 'workflow-orchestrator', 'run.py'),
        'print("hello")\n',
      );
      writeText(
        resolve(project.root, '.aida', 'rules', '_all.md'),
        `<!-- AUTO-GENERATED from rules.json - DO NOT EDIT -->
# All Project Rules

## Process

- [RULE-001] Imported rule content
`,
      );
      ensureDir(resolve(project.root, '.cursor'));
      writeText(
        resolve(project.root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['-y', '--registry=https://registry.npmjs.org/', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
      );

      const output = runCliOutput(project, 'import');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));
      const toolConfigs = readJson<{ tools: string[] }>(resolve(project.root, '.aida', 'tool-configs.json'));
      const config = readJson<{ aiTools: string[] }>(resolve(project.root, '.aida', 'config.json'));

      assert.ok(output.includes('Existing project sources imported'));
      assert.equal(rules.length, 1);
      assert.equal(rules[0].content, 'Imported rule content');
      assert.equal(skills.length, 1);
      assert.equal(skills[0].name, 'workflow-orchestrator');
      assert.equal(skills[0].files.length, 1);
      assert.equal(skills[0].files[0].path, 'run.py');
      assert.ok(toolConfigs.tools.includes('cursor'));
      assert.ok(config.aiTools.includes('cursor'));
      assert.ok(fileExists(resolve(project.root, '.gitignore')));
    } finally {
      project.cleanup();
    }
  });

  it('should import rules and skills from the chosen baseline tool', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.cursor', 'rules'));
      ensureDir(resolve(project.root, '.cursor', 'skills', 'custom-flow'));
      writeText(
        resolve(project.root, '.cursor', 'rules', 'team.md'),
        '# Team Rules\n\n- Imported cursor rule\n- API requests must go through shared client\n',
      );
      writeText(
        resolve(project.root, '.cursor', 'skills', 'custom-flow', 'SKILL.md'),
        '# Custom Flow\n\nImported from cursor\n',
      );
      writeText(
        resolve(project.root, '.cursor', 'skills', 'custom-flow', 'run.py'),
        'print("cursor skill")\n',
      );
      writeText(
        resolve(project.root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['-y', '--registry=https://registry.npmjs.org/', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
      );

      const importable = detectImportableTools(project.root, ['cursor', 'claude-code']);
      const result = importFromTool(project.root, 'cursor');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));

      assert.deepEqual(importable, ['cursor']);
      assert.equal(result.rulesImported, 2);
      assert.equal(result.skillsImported, 1);
      assert.ok(rules.some((entry) => entry.content === 'Imported cursor rule'));
      assert.ok(skills.some((entry) => entry.name === 'custom-flow'));
      assert.equal(skills.find((entry) => entry.name === 'custom-flow')?.files?.[0]?.path, 'run.py');
    } finally {
      project.cleanup();
    }
  });

  it('should import packaged skills from Claude and prefer the package over same-name flat markdown', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.claude', 'skills', 'custom-flow'));
      writeText(
        resolve(project.root, '.claude', 'skills', 'custom-flow', 'SKILL.md'),
        '# Custom Flow\n\nPackaged Claude skill\n',
      );
      writeText(
        resolve(project.root, '.claude', 'skills', 'custom-flow', 'run.py'),
        'print("claude package")\n',
      );
      writeText(
        resolve(project.root, '.claude', 'skills', 'custom-flow.md'),
        '# Custom Flow\n\nFlat Claude skill that should be ignored\n',
      );

      const result = importFromTool(project.root, 'claude-code');
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));
      const customFlow = skills.find((entry) => entry.name === 'custom-flow');

      assert.equal(result.skillsImported, 1);
      assert.equal(customFlow.content, '# Custom Flow\n\nPackaged Claude skill\n');
      assert.equal(customFlow.files[0].path, 'run.py');
    } finally {
      project.cleanup();
    }
  });

  it('should import packaged skills from Codex with companion files', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.codex', 'skills', 'custom-flow'));
      writeText(
        resolve(project.root, '.codex', 'skills', 'custom-flow', 'SKILL.md'),
        '# Custom Flow\n\nPackaged Codex skill\n',
      );
      writeText(
        resolve(project.root, '.codex', 'skills', 'custom-flow', 'run.js'),
        'console.log("codex package");\n',
      );

      const result = importFromTool(project.root, 'codex');
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));
      const customFlow = skills.find((entry) => entry.name === 'custom-flow');

      assert.equal(result.skillsImported, 1);
      assert.equal(customFlow.content, '# Custom Flow\n\nPackaged Codex skill\n');
      assert.equal(customFlow.files[0].path, 'run.js');
    } finally {
      project.cleanup();
    }
  });

  it('should be idempotent when importing the same packaged skill twice', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.codex', 'skills', 'custom-flow'));
      writeText(
        resolve(project.root, '.codex', 'skills', 'custom-flow', 'SKILL.md'),
        '# Custom Flow\n\nPackaged Codex skill\n',
      );
      writeText(
        resolve(project.root, '.codex', 'skills', 'custom-flow', 'run.js'),
        'console.log("codex package");\n',
      );

      const first = importFromTool(project.root, 'codex');
      const firstRegistry = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));
      const firstSnapshot = JSON.stringify(firstRegistry);

      const second = importFromTool(project.root, 'codex');
      const secondRegistry = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));

      assert.equal(first.skillsImported, 1);
      assert.equal(second.skillsImported, 0);
      assert.equal(second.rulesImported, 0);
      assert.equal(secondRegistry.length, 1);
      assert.equal(JSON.stringify(secondRegistry), firstSnapshot);
    } finally {
      project.cleanup();
    }
  });

  it('should ignore generated cursor rule files and map quick commands back to bundled skills', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.cursor', 'rules', 'aidevos'));
      ensureDir(resolve(project.root, '.cursor', 'skills', 'workflow'));
      writeText(
        resolve(project.root, '.cursor', 'rules', 'aidevos', 'aida-guide.md'),
        `---
description: AIDA 数据采集与规则沉淀规范
---

# AIDA 数据采集与规则沉淀指南
`,
      );
      writeText(
        resolve(project.root, '.cursor', 'rules', 'team.md'),
        '# Team Rules\n\n- Imported cursor rule\n',
      );
      writeText(
        resolve(project.root, '.cursor', 'skills', 'workflow', 'SKILL.md'),
        '# Workflow\n\nGenerated workflow command content\n',
      );

      const result = importFromTool(project.root, 'cursor');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));

      assert.equal(result.rulesImported, 1);
      assert.ok(rules.some((entry) => entry.content === 'Imported cursor rule'));
      assert.ok(!rules.some((entry) => String(entry.content).includes('AIDA 数据采集与规则沉淀指南')));
      assert.ok(skills.some((entry) => entry.name === 'workflow-orchestrator'));
      assert.ok(!skills.some((entry) => entry.name === 'workflow'));
    } finally {
      project.cleanup();
    }
  });

  it('should accept a baseline tool argument from the CLI', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.cursor', 'rules'));
      ensureDir(resolve(project.root, '.cursor', 'skills', 'custom-flow'));
      ensureDir(resolve(project.root, '.cursor'));
      writeText(
        resolve(project.root, '.cursor', 'rules', 'team.md'),
        '# Team Rules\n\n- Imported cursor rule\n',
      );
      writeText(
        resolve(project.root, '.cursor', 'skills', 'custom-flow', 'SKILL.md'),
        '# Custom Flow\n\nImported from cursor\n',
      );
      writeText(
        resolve(project.root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['-y', '--registry=https://registry.npmjs.org/', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
      );

      const output = runCliOutput(project, 'import cursor');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));

      assert.ok(output.includes('Baseline: cursor'));
      assert.ok(rules.some((entry) => entry.content === 'Imported cursor rule'));
      assert.ok(skills.some((entry) => entry.name === 'custom-flow'));
    } finally {
      project.cleanup();
    }
  });

  it('should reject baseline tools that are not closed-loop for import', () => {
    const project = createTestProject();

    try {
      const output = runCliOutput(project, 'import lingma');
      assert.ok(output.includes('Unsupported baseline tool for import'));
      assert.ok(output.includes('claude-code, cursor, codex'));
    } finally {
      project.cleanup();
    }
  });
});
