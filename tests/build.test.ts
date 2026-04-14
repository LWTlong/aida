import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from '../src/utils/fs.js';
import { buildProjectArtifacts } from '../src/utils/ai-build.js';
import { addRule, bootstrapRuleRegistry } from '../src/utils/rules.js';
import { bootstrapSkillRegistry, mergeSkillRegistries, skillsRegistryPath, type SkillRegistryEntry } from '../src/utils/skills.js';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aida-build-'));
  ensureDir(resolve(tmpRoot, '.aida', 'rules'));
  writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
    schemaVersion: '1.0',
    project: 'build-test',
    aiTools: ['claude-code', 'cursor'],
  });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('bootstrapSkillRegistry', () => {
  it('should create skills.json from existing .aida/skills content', () => {
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'workflow-orchestrator');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Workflow\n\nTest content\n');

    const entries = bootstrapSkillRegistry(tmpRoot);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'workflow-orchestrator');
    assert.ok(fileExists(skillsRegistryPath(tmpRoot)));
  });
});

describe('bootstrapRuleRegistry', () => {
  it('should create rules.json from existing generated rule views', () => {
    writeText(resolve(tmpRoot, '.aida', 'rules', '_all.md'), `<!-- AUTO-GENERATED from rules.json - DO NOT EDIT -->
# All Project Rules

## Process

- [RULE-001] Existing rule from markdown
`);

    const entries = bootstrapRuleRegistry(tmpRoot);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].content, 'Existing rule from markdown');
    assert.ok(fileExists(resolve(tmpRoot, '.aida', 'rules.json')));
  });
});

describe('buildProjectArtifacts', () => {
  it('should build rules, skills, tool configs and gitignore entries', () => {
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'workflow-orchestrator');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Workflow\n\nTest content\n');

    addRule(tmpRoot, {
      content: 'API requests must use the shared client',
      category: 'api',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });

    const result = buildProjectArtifacts(tmpRoot);

    assert.deepEqual(result.tools, ['claude-code', 'cursor']);
    assert.ok(fileExists(resolve(tmpRoot, '.aida', 'rules', '_all.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.aida', 'skills', 'workflow-orchestrator', 'SKILL.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.mcp.json')));
    assert.ok(fileExists(resolve(tmpRoot, '.cursor', 'mcp.json')));
    assert.ok(fileExists(resolve(tmpRoot, '.claude', 'commands', 'workflow.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.cursor', 'skills', 'workflow', 'SKILL.md')));

    const gitignore = readText(resolve(tmpRoot, '.gitignore'));
    assert.ok(gitignore.includes('.aida/skills/*/SKILL.md'));
    assert.ok(gitignore.includes('.claude/commands/*.md'));
    assert.ok(gitignore.includes('.cursor/skills/'));
  });

  it('should use configured tools when build is called with all', () => {
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'workflow-orchestrator');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Workflow\n\nTest content\n');

    addRule(tmpRoot, {
      content: 'Forbid direct fetch calls in feature modules',
      category: 'api',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });

    const result = buildProjectArtifacts(tmpRoot, ['all']);
    const mcp = readJson<{ mcpServers: { aida: { command: string } } }>(resolve(tmpRoot, '.mcp.json'));

    assert.deepEqual(result.tools, ['claude-code', 'cursor']);
    assert.equal(mcp.mcpServers.aida.command, 'npx');
  });

  it('should generate Codex config snippet when codex is configured', () => {
    const originalHome = process.env.HOME;
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['codex'],
    });
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'workflow-orchestrator');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Workflow\n\nTest content\n');
    writeText(resolve(tmpRoot, 'AGENTS.md'), '# Project Agents\n');
    process.env.HOME = tmpRoot;

    try {
      const result = buildProjectArtifacts(tmpRoot);
      const codexConfig = readText(resolve(tmpRoot, '.aida', 'codex', 'config.toml'));
      const agents = readText(resolve(tmpRoot, 'AGENTS.md'));

      assert.deepEqual(result.tools, ['codex']);
      assert.ok(codexConfig.includes('[mcp_servers.aida]'));
      assert.ok(agents.includes('.aida/aida-guide.md'));
      assert.ok(readText(resolve(tmpRoot, '.codex', 'config.toml')).includes('[mcp_servers.aida]'));
    } finally {
      process.env.HOME = originalHome;
    }
  });
});

describe('mergeSkillRegistries', () => {
  it('should merge by fingerprint and reassign ids', () => {
    const base: SkillRegistryEntry[] = [
      {
        id: 'SKILL-001',
        name: 'workflow-orchestrator',
        content: 'Workflow content',
        fingerprint: 'fp-1',
        source: { kind: 'bundled', path: 'a' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'active',
      },
    ];
    const incoming: SkillRegistryEntry[] = [
      {
        id: 'SKILL-001',
        name: 'audit',
        content: 'Audit content',
        fingerprint: 'fp-2',
        source: { kind: 'bundled', path: 'b' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'active',
      },
    ];

    const { merged, added } = mergeSkillRegistries(base, incoming);

    assert.equal(added, 1);
    assert.equal(merged.length, 2);
    assert.equal(merged[1].id, 'SKILL-002');
  });
});
