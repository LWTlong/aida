import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { parseConflictJsonArray, readJson, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput } from './helpers.js';

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
      const merged = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));

      assert.ok(stdout.includes('Registry merge completed'));
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
      const mergedRules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));
      const mergedSkills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));

      assert.ok(stdout.includes('rules.json: merged'));
      assert.ok(stdout.includes('skills.json: merged'));
      assert.equal(mergedRules.length, 2);
      assert.equal(mergedSkills.length, 1);
      assert.equal(mergedSkills[0].name, 'workflow-orchestrator');
    } finally {
      project.cleanup();
    }
  });
});
