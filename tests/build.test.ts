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
  ensureDir(resolve(tmpRoot, '.aida'));
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
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'team-playbook');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Team Playbook\n\nTest content\n');
    writeText(resolve(skillDir, 'run.py'), 'print("hello")\n');

    const entries = bootstrapSkillRegistry(tmpRoot);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'team-playbook');
    assert.equal(entries[0].files?.length, 1);
    assert.equal(entries[0].files?.[0].path, 'run.py');
    assert.ok(fileExists(skillsRegistryPath(tmpRoot)));
    const raw = readJson<any>(skillsRegistryPath(tmpRoot));
    assert.equal(raw.schemaVersion, '2.0');
    assert.equal(Array.isArray(raw.items), true);
  });
});

describe('bootstrapRuleRegistry', () => {
  it('should create rules.json from existing generated rule views', () => {
    ensureDir(resolve(tmpRoot, '.aida', 'rules'));
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
  it('should build rules, skills, tool outputs and gitignore entries', () => {
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'custom-flow');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Custom Flow\n\nTest content\n');
    writeText(resolve(skillDir, 'run.py'), 'print("hello")\n');

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
    assert.ok(fileExists(resolve(tmpRoot, '.claude', 'rules', 'aida', '_all.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.cursor', 'rules', 'aida', '_all.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.claude', 'skills', 'custom-flow.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.claude', 'skills', 'custom-flow', 'SKILL.md')));
    assert.ok(fileExists(resolve(tmpRoot, '.claude', 'skills', 'custom-flow', 'run.py')));
    assert.ok(fileExists(resolve(tmpRoot, '.mcp.json')));
    assert.ok(fileExists(resolve(tmpRoot, '.cursor', 'mcp.json')));
    assert.ok(fileExists(resolve(tmpRoot, '.cursor', 'skills', 'custom-flow', 'run.py')));

    const gitignore = readText(resolve(tmpRoot, '.gitignore'));
    assert.ok(gitignore.includes('.claude/'));
    assert.ok(gitignore.includes('.cursor/'));
    assert.ok(gitignore.includes('.aida/**'));
    assert.ok(gitignore.includes('!.aida/**/*.json'));
    assert.ok(gitignore.includes('.aida/bootstrap-state.local.json'));
    assert.ok(gitignore.includes('.kiro/'));
    assert.ok(gitignore.includes('AGENTS.md'));
    assert.ok(gitignore.includes('CLAUDE.md'));
  });

  it('should use configured tools when build is called with all', () => {
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'custom-flow');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Custom Flow\n\nTest content\n');

    addRule(tmpRoot, {
      content: 'Forbid direct fetch calls in feature modules',
      category: 'api',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });

    const result = buildProjectArtifacts(tmpRoot, ['all']);
    const mcp = readJson<{ mcpServers: { aida: { command: string; args: string[] } } }>(resolve(tmpRoot, '.mcp.json'));

    assert.deepEqual(result.tools, ['claude-code', 'cursor']);
    assert.equal(mcp.mcpServers.aida.command, 'npx');
    assert.deepEqual(mcp.mcpServers.aida.args, ['-y', '--registry=https://registry.npmjs.org/', 'ai-dev-analytics', 'mcp']);
  });

  it('should generate Codex config snippet when codex is configured', () => {
    const originalHome = process.env.HOME;
    const fakeHome = mkdtempSync(join(tmpdir(), 'aida-home-'));
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['codex'],
    });
    const skillDir = resolve(tmpRoot, '.aida', 'skills', 'custom-flow');
    ensureDir(skillDir);
    writeText(resolve(skillDir, 'SKILL.md'), '# Custom Flow\n\nTest content\n');
    writeText(resolve(skillDir, 'run.py'), 'print("hello")\n');
    writeText(resolve(tmpRoot, 'AGENTS.md'), '# Project Agents\n');
    process.env.HOME = fakeHome;

    try {
      const result = buildProjectArtifacts(tmpRoot);
      const codexConfig = readText(resolve(tmpRoot, '.codex', 'config.toml'));
      const agents = readText(resolve(tmpRoot, 'AGENTS.md'));

      assert.deepEqual(result.tools, ['codex']);
      assert.ok(codexConfig.includes('[mcp_servers.aida]'));
      assert.ok(agents.includes('.aida/aida-guide.md'));
      assert.ok(readText(resolve(tmpRoot, '.codex', 'config.toml')).includes('[mcp_servers.aida]'));
      assert.ok(fileExists(resolve(tmpRoot, '.codex', 'skills', 'custom-flow.md')));
      assert.ok(fileExists(resolve(tmpRoot, '.codex', 'skills', 'custom-flow', 'SKILL.md')));
      assert.ok(fileExists(resolve(tmpRoot, '.codex', 'skills', 'custom-flow', 'run.py')));
      assert.equal(fileExists(resolve(fakeHome, '.codex', 'config.toml')), false);
    } finally {
      process.env.HOME = originalHome;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('should keep exactly one aida MCP block in codex config across repeated builds', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['codex'],
    });
    ensureDir(resolve(tmpRoot, '.codex'));
    writeText(resolve(tmpRoot, '.codex', 'config.toml'), `[profiles.default]
model = "gpt-5"

[mcp_servers.aida]
command = "npx"
args = ["-y", "--registry=https://registry.npmjs.org/", "ai-dev-analytics", "mcp"]
`);

    buildProjectArtifacts(tmpRoot);
    buildProjectArtifacts(tmpRoot);

    const codexConfig = readText(resolve(tmpRoot, '.codex', 'config.toml'));
    assert.equal((codexConfig.match(/\[mcp_servers\.aida\]/g) || []).length, 1);
    assert.ok(codexConfig.includes('[profiles.default]'));
  });

  it('should collapse duplicate aida MCP blocks in codex config while preserving other sections', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['codex'],
    });
    ensureDir(resolve(tmpRoot, '.codex'));
    writeText(resolve(tmpRoot, '.codex', 'config.toml'), `[profiles.default]
model = "gpt-5"

[mcp_servers.aida]
command = "old-aida"
args = ["stale"]

[sandbox]
network_access = false

[mcp_servers.aida]
command = "older-aida"
args = ["staler"]
`);

    buildProjectArtifacts(tmpRoot);

    const codexConfig = readText(resolve(tmpRoot, '.codex', 'config.toml'));
    assert.equal((codexConfig.match(/\[mcp_servers\.aida\]/g) || []).length, 1);
    assert.ok(codexConfig.includes('[profiles.default]'));
    assert.ok(codexConfig.includes('[sandbox]'));
    assert.ok(codexConfig.includes('command = "npx"'));
    assert.ok(codexConfig.includes('args = ["-y", "--registry=https://registry.npmjs.org/", "ai-dev-analytics", "mcp"]'));
  });

  it('should fully rebuild managed rules and skill package outputs without leaving stale files', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['claude-code', 'cursor', 'codex'],
    });
    ensureDir(resolve(tmpRoot, '.aida'));
    writeJson(resolve(tmpRoot, '.aida', 'skills.json'), [
      {
        id: 'SKILL-001',
        name: 'custom-flow',
        content: '# Custom Flow\n\nFresh content\n',
        files: [
          { path: 'run.py', content: 'print("fresh")\n' },
        ],
        fingerprint: 'fp-fresh',
        source: { kind: 'local', path: '.aida/skills/custom-flow/SKILL.md' },
        updatedAt: '2026-04-27T00:00:00.000Z',
        status: 'active',
      },
    ]);
    writeJson(resolve(tmpRoot, '.aida', 'rules.json'), [
      {
        id: 'RULE-001',
        category: 'api',
        content: 'Use shared API client',
        fingerprint: 'fp-rule-api',
        source: { branch: 'main', deviation: null, author: 'test' },
        createdAt: '2026-04-27T00:00:00.000Z',
        status: 'active',
      },
    ]);

    ensureDir(resolve(tmpRoot, '.aida', 'skills', 'custom-flow'));
    writeText(resolve(tmpRoot, '.aida', 'skills', 'custom-flow', 'stale.sh'), 'echo stale\n');
    ensureDir(resolve(tmpRoot, '.aida', 'rules'));
    writeText(resolve(tmpRoot, '.aida', 'rules', 'process.md'), '# stale\n');
    ensureDir(resolve(tmpRoot, '.claude', 'skills', 'custom-flow'));
    writeText(resolve(tmpRoot, '.claude', 'skills', 'custom-flow', 'stale.sh'), 'echo stale\n');
    ensureDir(resolve(tmpRoot, '.claude', 'commands'));
    writeText(resolve(tmpRoot, '.claude', 'commands', 'stale.md'), '# stale\n');
    ensureDir(resolve(tmpRoot, '.cursor', 'skills', 'custom-flow'));
    writeText(resolve(tmpRoot, '.cursor', 'skills', 'custom-flow', 'stale.sh'), 'echo stale\n');
    ensureDir(resolve(tmpRoot, '.cursor', 'rules', 'aida'));
    writeText(resolve(tmpRoot, '.cursor', 'rules', 'aida', 'stale.md'), '# stale\n');
    ensureDir(resolve(tmpRoot, '.codex', 'skills', 'custom-flow'));
    writeText(resolve(tmpRoot, '.codex', 'skills', 'custom-flow', 'stale.sh'), 'echo stale\n');
    ensureDir(resolve(tmpRoot, '.codex', 'rules', 'aida'));
    writeText(resolve(tmpRoot, '.codex', 'rules', 'aida', 'stale.md'), '# stale\n');

    buildProjectArtifacts(tmpRoot);

    assert.equal(fileExists(resolve(tmpRoot, '.aida', 'skills', 'custom-flow', 'stale.sh')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.aida', 'rules', 'process.md')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.claude', 'skills', 'custom-flow', 'stale.sh')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.claude', 'commands', 'stale.md')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.cursor', 'skills', 'custom-flow', 'stale.sh')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.cursor', 'rules', 'aida', 'stale.md')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.codex', 'skills', 'custom-flow', 'stale.sh')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.codex', 'rules', 'aida', 'stale.md')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.cursor', 'skills', 'custom-flow', 'run.py')), true);
    assert.equal(fileExists(resolve(tmpRoot, '.claude', 'skills', 'custom-flow', 'run.py')), true);
    assert.equal(fileExists(resolve(tmpRoot, '.codex', 'skills', 'custom-flow', 'run.py')), true);
    assert.equal(fileExists(resolve(tmpRoot, '.aida', 'rules', 'api.md')), true);
  });

  it('should upgrade a legacy AGENTS marker line into the full AIDA section', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['codex'],
    });
    addRule(tmpRoot, {
      content: 'Keep rules in the registry',
      category: 'process',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });
    writeText(resolve(tmpRoot, 'AGENTS.md'), '# Agents\n\nRead .aida/aida-guide.md first\n');

    buildProjectArtifacts(tmpRoot);

    const agents = readText(resolve(tmpRoot, 'AGENTS.md'));
    assert.ok(agents.includes('## AIDA'));
    assert.ok(agents.includes('.aida/rules/_all.md'));
  });

  it('should collapse duplicated leading AIDA sections in AGENTS.md during build', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['codex'],
    });
    addRule(tmpRoot, {
      content: 'Keep rules in the registry',
      category: 'process',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });
    writeText(resolve(tmpRoot, 'AGENTS.md'), [
      '## AIDA',
      '',
      '## AIDA',
      '',
      'Read .aida/aida-guide.md first',
      '',
    ].join('\n'));

    buildProjectArtifacts(tmpRoot);

    const agents = readText(resolve(tmpRoot, 'AGENTS.md'));
    assert.equal((agents.match(/^## AIDA$/gm) || []).length, 1);
    assert.ok(agents.includes('.codex/rules/aida/_all.md'));
  });

  it('should prune stale codex root artifacts when codex is not configured', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['cursor', 'claude-code'],
    });
    writeText(resolve(tmpRoot, 'AGENTS.md'), 'legacy codex instructions\n');
    ensureDir(resolve(tmpRoot, '.codex'));
    writeText(resolve(tmpRoot, '.codex', 'config.toml'), '[mcp_servers.aida]\ncommand = "old"\n');

    buildProjectArtifacts(tmpRoot);

    assert.equal(fileExists(resolve(tmpRoot, 'AGENTS.md')), false);
    assert.equal(fileExists(resolve(tmpRoot, '.codex')), false);
    assert.equal(fileExists(resolve(tmpRoot, 'CLAUDE.md')), true);
  });

  it('should replace stale legacy CLAUDE template content with the current AIDA top section', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['claude-code'],
    });
    addRule(tmpRoot, {
      content: 'Keep rules in the registry',
      category: 'process',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });
    writeText(resolve(tmpRoot, 'CLAUDE.md'), [
      '# CLAUDE.md',
      '',
      '## AIDA',
      '',
      'Read .aida/aida-guide.md first',
      '',
      '## Project Overview',
      '',
      '**AIDA** (AI Development Analytics) is an open-source AI Development Observability Platform.',
      '',
      '## CLI Commands',
      '',
      'aida update',
      '',
      '## AIDevOS Iron Rules',
      '',
      '1. legacy',
      '',
    ].join('\n'));

    buildProjectArtifacts(tmpRoot);

    const claude = readText(resolve(tmpRoot, 'CLAUDE.md'));
    assert.ok(claude.includes('.claude/rules/aida/_all.md'));
    assert.equal(claude.includes('## CLI Commands'), false);
    assert.equal(claude.includes('open-source AI Development Observability Platform'), false);
    assert.equal(claude.includes('## AIDevOS Iron Rules'), false);
  });

  it('should add .claude/ when .gitignore only contains .claude/settings.local.json', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['claude-code'],
    });
    addRule(tmpRoot, {
      content: 'Keep rules in the registry',
      category: 'process',
      branch: 'main',
      deviation: null,
      author: 'test',
      status: 'active',
    });
    writeText(resolve(tmpRoot, '.gitignore'), 'node_modules\n.claude/settings.local.json\n');

    buildProjectArtifacts(tmpRoot);

    const gitignore = readText(resolve(tmpRoot, '.gitignore'));
    assert.ok(gitignore.includes('.claude/settings.local.json'));
    assert.ok(gitignore.includes('.claude/'));
  });

  it('should still add managed tool directories when .gitignore already contains specific generated files', () => {
    writeJson(resolve(tmpRoot, '.aida', 'config.json'), {
      schemaVersion: '1.0',
      project: 'build-test',
      aiTools: ['cursor', 'lingma', 'codex'],
    });
    writeJson(resolve(tmpRoot, '.aida', 'rules.json'), []);
    writeJson(resolve(tmpRoot, '.aida', 'skills.json'), []);
    writeText(
      resolve(tmpRoot, '.gitignore'),
      [
        'node_modules',
        '.cursor/mcp.json',
        '.lingma/mcp.json',
        '.codex/config.toml',
      ].join('\n') + '\n',
    );

    buildProjectArtifacts(tmpRoot);

    const gitignore = readText(resolve(tmpRoot, '.gitignore'));
    assert.ok(gitignore.includes('.cursor/mcp.json'));
    assert.ok(gitignore.includes('.cursor/'));
    assert.ok(gitignore.includes('.lingma/mcp.json'));
    assert.ok(gitignore.includes('.lingma/'));
    assert.ok(gitignore.includes('.codex/config.toml'));
    assert.ok(gitignore.includes('.codex/'));
  });
});

describe('mergeSkillRegistries', () => {
  it('should merge by fingerprint and reassign ids', () => {
    const base: SkillRegistryEntry[] = [
      {
        id: 'SKILL-001',
        name: 'team-playbook',
        content: 'Playbook content',
        fingerprint: 'fp-1',
        source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'active',
      },
    ];
    const incoming: SkillRegistryEntry[] = [
      {
        id: 'SKILL-001',
        name: 'custom-flow',
        content: 'Custom flow content',
        fingerprint: 'fp-2',
        source: { kind: 'local', path: '.aida/skills/custom-flow/SKILL.md' },
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
