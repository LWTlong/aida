import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileExists, readJson, writeJson } from '../src/utils/fs.js';
import { createTestProject, readRegistryItems, runCliOutput } from './helpers.js';

describe('aida migrate', () => {
  it('should migrate legacy run.json and normalize 2.0 truth sources', () => {
    const project = createTestProject();

    try {
      writeJson(project.runJsonPath, {
        meta: {
          runId: project.branch,
          project: 'test-project',
          developer: project.dev,
          branch: project.branch,
          aiModel: 'claude',
          aiTool: 'claude-code',
          startTime: '2026-05-01T10:00:00.000Z',
          status: 'running',
          prdPhases: [],
        },
        summary: {},
        context: { currentStage: 'Auth', currentTaskId: null, lastUpdated: '2026-05-01T10:00:00.000Z' },
        tasks: [],
        bugs: [],
        deviations: [],
        reviews: [],
        rules: [],
        files: [],
        timeline: [],
        workflow: [],
        events: [],
      });
      writeJson(resolve(project.root, '.aida', 'rules.json'), []);
      writeJson(resolve(project.root, '.aida', 'skills.json'), []);

      const stdout = runCliOutput(project, 'migrate');

      assert.ok(stdout.includes('Migration complete'));
      assert.ok(stdout.includes('Truth sources normalized'));

      const rules = readJson<any>(resolve(project.root, '.aida', 'rules.json'));
      const skills = readJson<any>(resolve(project.root, '.aida', 'skills.json'));
      const summary = readRegistryItems<any>(resolve(project.root, '.aida', 'summary.json'));

      assert.equal(fileExists(resolve(project.root, '.aida', 'runs')), false);
      assert.equal(rules.schemaVersion, '2.0');
      assert.equal(skills.schemaVersion, '2.0');
      assert.equal(summary.length, 1);
    } finally {
      project.cleanup();
    }
  });
});
