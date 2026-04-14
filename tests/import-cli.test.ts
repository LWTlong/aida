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
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
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
        resolve(project.root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
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
    } finally {
      project.cleanup();
    }
  });
});
