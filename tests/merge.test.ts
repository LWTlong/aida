import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { extractConflictSections, parseConflictJsonArray, readJson, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput, readRuleRegistryItems, readSkillRegistryItems } from './helpers.js';

describe('parseConflictJsonArray', () => {
  it('should normalize empty object to empty array', () => {
    assert.deepEqual(parseConflictJsonArray('{}'), []);
  });

  it('should parse a single object into a one-item array', () => {
    const parsed = parseConflictJsonArray<{ id: string }>('{ "id": "RULE-001" }');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, 'RULE-001');
  });

  it('should parse object fragments extracted from array conflicts', () => {
    const parsed = parseConflictJsonArray<{ id: string }>('{ "id": "RULE-001" }, { "id": "RULE-002" }');
    assert.equal(parsed.length, 2);
    assert.equal(parsed[1].id, 'RULE-002');
  });

  it('should preserve shared lines when extracting interleaved conflict sections', () => {
    const sections = extractConflictSections(`[
  {
    "id": "RULE-001",
<<<<<<< HEAD
    "content": "Rule A"
=======
    "content": "Rule B"
>>>>>>> branch-b
  },
  {
    "id": "RULE-002",
    "content": "Rule C"
  }
]`);

    assert.ok(sections);
    const ours = parseConflictJsonArray<{ id: string; content: string }>(sections!.ours);
    const theirs = parseConflictJsonArray<{ id: string; content: string }>(sections!.theirs);
    assert.equal(ours.length, 2);
    assert.equal(theirs.length, 2);
    assert.equal(ours[0].content, 'Rule A');
    assert.equal(theirs[0].content, 'Rule B');
    assert.equal(ours[1].content, 'Rule C');
  });

  it('should preserve shared object lines across multiple conflict blocks', () => {
    const sections = extractConflictSections(`{
  "branch": "main",
<<<<<<< HEAD
  "summary": "Branch A summary",
=======
  "summary": "Branch B summary",
>>>>>>> branch-b
  "modules": [
    "CLI"
  ],
<<<<<<< HEAD
  "risks": ["Risk A"],
=======
  "risks": ["Risk B"],
>>>>>>> branch-b
  "updatedAt": "2026-04-28T00:00:00.000Z"
}`);

    assert.ok(sections);
    const ours = JSON.parse(sections!.ours);
    const theirs = JSON.parse(sections!.theirs);
    assert.equal(ours.summary, 'Branch A summary');
    assert.equal(theirs.summary, 'Branch B summary');
    assert.deepEqual(ours.modules, ['CLI']);
    assert.deepEqual(theirs.modules, ['CLI']);
    assert.deepEqual(ours.risks, ['Risk A']);
    assert.deepEqual(theirs.risks, ['Risk B']);
  });
});

describe('aida merge', () => {
  it('should merge rules.json when one side is {} and the other has entries', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'rules.json'),
        `<<<<<<< HEAD
[
  {
    "id": "RULE-001",
    "category": "process",
    "content": "Rule A",
    "fingerprint": "fp-rule-a",
    "source": { "branch": "feat-a", "deviation": null, "author": "dev-a" },
    "createdAt": "2026-04-13T00:00:00.000Z",
    "status": "active"
  }
]
=======
{}
>>>>>>> uat
`,
      );

      const stdout = runCliOutput(project, 'merge');
      const merged = readRuleRegistryItems(project.root);

      assert.ok(stdout.includes('AIDA merge completed'));
      assert.equal(merged.length, 1);
      assert.equal(merged[0].content, 'Rule A');
    } finally {
      project.cleanup();
    }
  });

  it('should merge both rules.json and skills.json in one command', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'rules.json'),
        `<<<<<<< HEAD
[
  {
    "id": "RULE-001",
    "category": "process",
    "content": "Rule A",
    "fingerprint": "fp-rule-a",
    "source": { "branch": "feat-a", "deviation": null, "author": "dev-a" },
    "createdAt": "2026-04-13T00:00:00.000Z",
    "status": "active"
  }
]
=======
[
  {
    "id": "RULE-001",
    "category": "api",
    "content": "Rule B",
    "fingerprint": "fp-rule-b",
    "source": { "branch": "feat-b", "deviation": null, "author": "dev-b" },
    "createdAt": "2026-04-13T00:00:00.000Z",
    "status": "active"
  }
]
>>>>>>> uat
`,
      );

      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        `<<<<<<< HEAD
[
  {
    "id": "SKILL-001",
    "name": "workflow-orchestrator",
    "content": "Workflow content",
    "fingerprint": "fp-skill-a",
    "source": { "kind": "bundled", "path": "a" },
    "updatedAt": "2026-04-13T00:00:00.000Z",
    "status": "active"
  }
]
=======
{}
>>>>>>> uat
`,
      );

      const stdout = runCliOutput(project, 'merge');
      const mergedRules = readRuleRegistryItems(project.root);
      const mergedSkills = readSkillRegistryItems(project.root);

      assert.ok(stdout.includes('rules.json: merged'));
      assert.equal(mergedRules.length, 2);
      assert.equal(mergedSkills.length, 1);
      assert.equal(mergedSkills[0].name, 'workflow-orchestrator');
    } finally {
      project.cleanup();
    }
  });

  it('should merge 2.0 envelope conflicts for rules.json and skills.json', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'rules.json'),
        `<<<<<<< HEAD
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-05-08T10:00:00.000Z",
  "items": [
    {
      "id": "RULE-001",
      "category": "process",
      "content": "Rule A",
      "fingerprint": "fp-rule-a",
      "source": { "branch": "feat-a", "deviation": null, "author": "dev-a" },
      "createdAt": "2026-04-13T00:00:00.000Z",
      "status": "active"
    }
  ]
}
=======
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-05-08T10:01:00.000Z",
  "items": [
    {
      "id": "RULE-001",
      "category": "api",
      "content": "Rule B",
      "fingerprint": "fp-rule-b",
      "source": { "branch": "feat-b", "deviation": null, "author": "dev-b" },
      "createdAt": "2026-04-13T00:00:00.000Z",
      "status": "active"
    }
  ]
}
>>>>>>> uat
`,
      );

      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        `<<<<<<< HEAD
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-05-08T10:00:00.000Z",
  "items": [
    {
      "id": "SKILL-001",
      "name": "workflow-orchestrator",
      "content": "Workflow content",
      "fingerprint": "fp-skill-a",
      "source": { "kind": "bundled", "path": "a" },
      "updatedAt": "2026-04-13T00:00:00.000Z",
      "status": "active"
    }
  ]
}
=======
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-05-08T10:01:00.000Z",
  "items": [
    {
      "id": "SKILL-001",
      "name": "rules-evolver",
      "content": "Rules content",
      "fingerprint": "fp-skill-b",
      "source": { "kind": "bundled", "path": "b" },
      "updatedAt": "2026-04-13T00:00:00.000Z",
      "status": "active"
    }
  ]
}
>>>>>>> uat
`,
      );

      const stdout = runCliOutput(project, 'merge');
      const mergedRulesRaw = readJson<any>(resolve(project.root, '.aida', 'rules.json'));
      const mergedSkillsRaw = readJson<any>(resolve(project.root, '.aida', 'skills.json'));
      const mergedRules = readRuleRegistryItems(project.root);
      const mergedSkills = readSkillRegistryItems(project.root);

      assert.ok(stdout.includes('rules.json: merged'));
      assert.ok(stdout.includes('skills.json: merged'));
      assert.equal(mergedRulesRaw.schemaVersion, '2.0');
      assert.equal(mergedSkillsRaw.schemaVersion, '2.0');
      assert.equal(mergedRules.length, 2);
      assert.equal(mergedSkills.length, 2);
      assert.ok(mergedRules.some((entry) => entry.content === 'Rule A'));
      assert.ok(mergedRules.some((entry) => entry.content === 'Rule B'));
      assert.ok(mergedSkills.some((entry) => entry.name === 'workflow-orchestrator'));
      assert.ok(mergedSkills.some((entry) => entry.name === 'rules-evolver'));
    } finally {
      project.cleanup();
    }
  });

  it('should merge AIDA JSON data conflicts through the main merge command', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'runs', 'test-branch', 'context.json'),
        `<<<<<<< HEAD
{
  "branch": "test-branch",
  "title": "Profile",
  "summary": "Older summary",
  "currentPhase": "In Progress",
  "modules": ["Profile"],
  "completed": ["Task A"],
  "inProgress": ["Task B"],
  "next": [],
  "decisions": [],
  "constraints": [],
  "keyFiles": ["src/profile/index.tsx"],
  "risks": ["Risk A"],
  "updatedAt": "2026-04-28T00:00:00.000Z"
}
=======
{
  "branch": "test-branch",
  "title": "Profile",
  "summary": "Newer summary",
  "currentPhase": "Completed",
  "modules": ["Profile", "Settings"],
  "completed": ["Task C"],
  "inProgress": [],
  "next": ["Task D"],
  "decisions": [],
  "constraints": [],
  "keyFiles": ["src/profile/store.ts"],
  "risks": ["Risk B"],
  "updatedAt": "2026-04-28T01:00:00.000Z"
}
>>>>>>> uat
`,
      );

      const stdout = runCliOutput(project, 'merge');
      const context = readJson<any>(resolve(project.root, '.aida', 'runs', 'test-branch', 'context.json'));

      assert.ok(stdout.includes('AIDA merge completed'));
      assert.ok(stdout.includes('branch contexts: merged'));
      assert.equal(context.summary, 'Newer summary');
      assert.deepEqual(context.modules, ['Profile', 'Settings']);
    } finally {
      project.cleanup();
    }
  });
});
