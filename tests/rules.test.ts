import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureDir, readJson, fileExists, readText } from '../src/utils/fs.js';
import {
  fingerprint,
  addRule,
  loadRegistry,
  saveRegistry,
  nextRuleId,
  buildRuleViews,
  dedupeExactRules,
  mergeRegistries,
  findSimilarRules,
  registryPath,
} from '../src/utils/rules.js';
import type { RuleRegistryEntry } from '../src/schemas/run-json.js';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aida-rules-'));
  ensureDir(resolve(tmpRoot, '.aida', 'rules'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── fingerprint ──────────────────────────────────────────

describe('fingerprint', () => {
  it('should produce consistent hash for same content', () => {
    const a = fingerprint('el-dialog must have min-height');
    const b = fingerprint('el-dialog must have min-height');
    assert.equal(a, b);
  });

  it('should normalize whitespace', () => {
    const a = fingerprint('rule   with   spaces');
    const b = fingerprint('rule with spaces');
    assert.equal(a, b);
  });

  it('should normalize case', () => {
    const a = fingerprint('MUST use TypeScript');
    const b = fingerprint('must use typescript');
    assert.equal(a, b);
  });

  it('should strip punctuation (CN + EN)', () => {
    const a = fingerprint('禁止使用 any 类型！');
    const b = fingerprint('禁止使用 any 类型');
    assert.equal(a, b);
  });

  it('should produce different hash for different content', () => {
    const a = fingerprint('rule A');
    const b = fingerprint('rule B');
    assert.notEqual(a, b);
  });
});

// ─── nextRuleId ───────────────────────────────────────────

describe('nextRuleId', () => {
  it('should return RULE-001 for empty array', () => {
    assert.equal(nextRuleId([]), 'RULE-001');
  });

  it('should increment from max existing ID', () => {
    const entries = [
      { id: 'RULE-001' },
      { id: 'RULE-003' },
    ] as RuleRegistryEntry[];
    assert.equal(nextRuleId(entries), 'RULE-004');
  });

  it('should pad to 3 digits', () => {
    const entries = Array.from({ length: 9 }, (_, i) => ({
      id: `RULE-00${i + 1}`,
    })) as RuleRegistryEntry[];
    assert.equal(nextRuleId(entries), 'RULE-010');
  });
});

// ─── addRule ──────────────────────────────────────────────

describe('addRule', () => {
  it('should add a new rule and persist to rules.json', () => {
    const { entry, isDuplicate } = addRule(tmpRoot, {
      content: 'API requests must go through the unified wrapper',
      category: 'api',
      branch: 'feat-1',
      deviation: null,
      author: 'test-dev',
      status: 'active',
    });

    assert.equal(isDuplicate, false);
    assert.equal(entry.id, 'RULE-001');
    assert.equal(entry.category, 'api');
    assert.equal(entry.status, 'active');
    assert.ok(entry.fingerprint.length > 0);

    // Verify persisted
    const registry = loadRegistry(tmpRoot);
    assert.equal(registry.length, 1);
    assert.equal(registry[0].id, 'RULE-001');
  });

  it('should detect duplicate by fingerprint', () => {
    addRule(tmpRoot, {
      content: 'Must use TypeScript strict mode',
      category: 'style',
      branch: 'feat-1',
      deviation: null,
      author: 'dev-a',
    });

    const { entry, isDuplicate } = addRule(tmpRoot, {
      content: 'Must use TypeScript strict mode',
      category: 'style',
      branch: 'feat-2',
      deviation: null,
      author: 'dev-b',
    });

    assert.equal(isDuplicate, true);
    assert.equal(entry.id, 'RULE-001'); // Returns existing
    assert.equal(loadRegistry(tmpRoot).length, 1);
  });

  it('should detect duplicate even with different whitespace/case', () => {
    addRule(tmpRoot, {
      content: 'Forbid magic strings',
      category: 'style',
      branch: 'a',
      deviation: null,
      author: 'x',
    });

    const { isDuplicate } = addRule(tmpRoot, {
      content: '  forbid   MAGIC   strings  ',
      category: 'style',
      branch: 'b',
      deviation: null,
      author: 'y',
    });

    assert.equal(isDuplicate, true);
  });

  it('should allow different content', () => {
    addRule(tmpRoot, {
      content: 'Rule A',
      category: 'general',
      branch: 'a',
      deviation: null,
      author: 'x',
    });

    const { isDuplicate, entry } = addRule(tmpRoot, {
      content: 'Rule B',
      category: 'general',
      branch: 'a',
      deviation: null,
      author: 'x',
    });

    assert.equal(isDuplicate, false);
    assert.equal(entry.id, 'RULE-002');
    assert.equal(loadRegistry(tmpRoot).length, 2);
  });

  it('should set pending status when specified', () => {
    const { entry } = addRule(tmpRoot, {
      content: 'Pending rule',
      category: 'component',
      branch: 'a',
      deviation: 'DEV-01',
      author: 'x',
      status: 'pending',
    });

    assert.equal(entry.status, 'pending');
    assert.equal(entry.source.deviation, 'DEV-01');
  });
});

// ─── dedupeExactRules ────────────────────────────────────

describe('dedupeExactRules', () => {
  it('should remove exact duplicates by fingerprint', () => {
    const fp = fingerprint('禁止任何形式的臆想，不清楚必须询问');
    const entries = [
      {
        id: 'RULE-001', category: 'process', content: '禁止任何形式的臆想，不清楚必须询问',
        fingerprint: fp,
        source: { branch: 'a', deviation: null, author: 'x' },
        createdAt: '2024-01-01', status: 'active',
      },
      {
        id: 'RULE-002', category: 'process', content: '禁止任何形式的臆想，不清楚必须询问',
        fingerprint: fp,
        source: { branch: 'b', deviation: null, author: 'y' },
        createdAt: '2024-01-02', status: 'active',
      },
    ] as RuleRegistryEntry[];

    const result = dedupeExactRules(entries);
    assert.equal(result.entries.length, 1);
    assert.equal(result.removed.length, 1);
    assert.equal(result.entries[0].id, 'RULE-001');
  });

  it('should prefer active rules over deprecated duplicates', () => {
    const fp = fingerprint('禁止任何形式的臆想，不清楚必须询问');
    const entries = [
      {
        id: 'RULE-001', category: 'process', content: '禁止任何形式的臆想，不清楚必须询问',
        fingerprint: fp,
        source: { branch: 'a', deviation: null, author: 'x' },
        createdAt: '2024-01-01', status: 'deprecated',
      },
      {
        id: 'RULE-002', category: 'process', content: '禁止任何形式的臆想，不清楚必须询问',
        fingerprint: fp,
        source: { branch: 'b', deviation: null, author: 'y' },
        createdAt: '2024-01-02', status: 'active',
      },
    ] as RuleRegistryEntry[];

    const result = dedupeExactRules(entries);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].id, 'RULE-002');
    assert.equal(result.entries[0].status, 'active');
  });
});

// ─── buildRuleViews ───────────────────────────────────────

describe('buildRuleViews', () => {
  it('should generate per-category .md files', () => {
    addRule(tmpRoot, { content: 'API rule', category: 'api', branch: 'a', deviation: null, author: 'x' });
    addRule(tmpRoot, { content: 'Style rule', category: 'style', branch: 'a', deviation: null, author: 'x' });
    addRule(tmpRoot, { content: 'Another API rule', category: 'api', branch: 'a', deviation: null, author: 'x' });

    const count = buildRuleViews(tmpRoot);

    // 2 categories + 1 _all.md = 3
    assert.equal(count, 3);

    const rulesDir = resolve(tmpRoot, '.aida', 'rules');
    assert.ok(fileExists(resolve(rulesDir, 'api.md')));
    assert.ok(fileExists(resolve(rulesDir, 'style.md')));
    assert.ok(fileExists(resolve(rulesDir, '_all.md')));
  });

  it('should include AUTO-GENERATED header', () => {
    addRule(tmpRoot, { content: 'Test rule', category: 'general', branch: 'a', deviation: null, author: 'x' });
    buildRuleViews(tmpRoot);

    const content = readText(resolve(tmpRoot, '.aida', 'rules', 'general.md'));
    assert.ok(content.includes('AUTO-GENERATED'));
    assert.ok(content.includes('RULE-001'));
    assert.ok(content.includes('Test rule'));
  });

  it('should skip deprecated rules', () => {
    addRule(tmpRoot, { content: 'Active rule', category: 'general', branch: 'a', deviation: null, author: 'x' });

    // Manually set one to deprecated
    const registry = loadRegistry(tmpRoot);
    registry[0].status = 'deprecated';
    saveRegistry(tmpRoot, registry);

    buildRuleViews(tmpRoot);

    const allPath = resolve(tmpRoot, '.aida', 'rules', '_all.md');
    // _all.md should not be generated since all rules are deprecated
    assert.equal(fileExists(allPath), false);
  });
});

// ─── mergeRegistries ──────────────────────────────────────

describe('mergeRegistries', () => {
  it('should merge two registries by union (no duplicates)', () => {
    const base: RuleRegistryEntry[] = [
      {
        id: 'RULE-001', category: 'api', content: 'Base rule A',
        fingerprint: fingerprint('Base rule A'),
        source: { branch: 'a', deviation: null, author: 'x' },
        createdAt: '2024-01-01', status: 'active',
      },
    ];

    const incoming: RuleRegistryEntry[] = [
      {
        id: 'RULE-001', category: 'style', content: 'Incoming rule B',
        fingerprint: fingerprint('Incoming rule B'),
        source: { branch: 'b', deviation: null, author: 'y' },
        createdAt: '2024-01-02', status: 'active',
      },
    ];

    const { merged, added } = mergeRegistries(base, incoming);
    assert.equal(merged.length, 2);
    assert.equal(added, 1);
    // Incoming should get re-ID'd to avoid collision
    assert.equal(merged[1].id, 'RULE-002');
  });

  it('should skip duplicates (same fingerprint)', () => {
    const fp = fingerprint('Same rule');
    const base: RuleRegistryEntry[] = [
      {
        id: 'RULE-001', category: 'api', content: 'Same rule',
        fingerprint: fp,
        source: { branch: 'a', deviation: null, author: 'x' },
        createdAt: '2024-01-01', status: 'active',
      },
    ];

    const incoming: RuleRegistryEntry[] = [
      {
        id: 'RULE-001', category: 'api', content: 'Same rule',
        fingerprint: fp,
        source: { branch: 'b', deviation: null, author: 'y' },
        createdAt: '2024-01-02', status: 'active',
      },
    ];

    const { merged, added } = mergeRegistries(base, incoming);
    assert.equal(merged.length, 1);
    assert.equal(added, 0);
  });
});

// ─── findSimilarRules ─────────────────────────────────────

describe('findSimilarRules', () => {
  it('should detect similar rules in same category', () => {
    const entries: RuleRegistryEntry[] = [
      {
        id: 'RULE-001', category: 'component', content: 'el-dialog must have min-height container for table',
        fingerprint: 'fp1',
        source: { branch: 'a', deviation: null, author: 'x' },
        createdAt: '2024-01-01', status: 'active',
      },
      {
        id: 'RULE-002', category: 'component', content: 'el-dialog table must have min-height wrapper container',
        fingerprint: 'fp2',
        source: { branch: 'b', deviation: null, author: 'y' },
        createdAt: '2024-01-02', status: 'active',
      },
    ];

    const similar = findSimilarRules(entries);
    assert.ok(similar.length > 0);
    assert.ok(similar[0].similarity >= 0.4);
  });

  it('should NOT match rules in different categories', () => {
    const entries: RuleRegistryEntry[] = [
      {
        id: 'RULE-001', category: 'component', content: 'use strict TypeScript mode always',
        fingerprint: 'fp1',
        source: { branch: 'a', deviation: null, author: 'x' },
        createdAt: '2024-01-01', status: 'active',
      },
      {
        id: 'RULE-002', category: 'api', content: 'use strict TypeScript mode always',
        fingerprint: 'fp2',
        source: { branch: 'b', deviation: null, author: 'y' },
        createdAt: '2024-01-02', status: 'active',
      },
    ];

    const similar = findSimilarRules(entries);
    assert.equal(similar.length, 0);
  });
});
