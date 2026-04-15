import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readJson, readText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput } from './helpers.js';

describe('aida rules add/delete', () => {
  it('should add a rule with default category and rebuild tool rule files', () => {
    const project = createTestProject();
    try {
      const stdout = runCliOutput(project, 'rules add "禁止直接修改生成产物文件"');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));
      const allRules = readText(resolve(project.root, '.claude', 'rules', 'aida', '_all.md'));

      assert.ok(stdout.includes('Rule added'));
      assert.equal(rules.length, 1);
      assert.equal(rules[0].category, 'general');
      assert.equal(rules[0].content, '禁止直接修改生成产物文件');
      assert.ok(allRules.includes('禁止直接修改生成产物文件'));
    } finally {
      project.cleanup();
    }
  });

  it('should add a rule with explicit category', () => {
    const project = createTestProject();
    try {
      const stdout = runCliOutput(project, 'rules add "API 请求必须走统一封装" --category api');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));

      assert.ok(stdout.includes('Rule added'));
      assert.equal(rules[0].category, 'api');
    } finally {
      project.cleanup();
    }
  });

  it('should deprecate a rule by id', () => {
    const project = createTestProject();
    try {
      runCliOutput(project, 'rules add "禁止直接修改生成产物文件"');
      const stdout = runCliOutput(project, 'rules delete RULE-001');
      const rules = readJson<any[]>(resolve(project.root, '.aida', 'rules.json'));

      assert.ok(stdout.includes('Rule deprecated'));
      assert.equal(rules[0].status, 'deprecated');
    } finally {
      project.cleanup();
    }
  });

  it('should output rules as json', () => {
    const project = createTestProject();
    try {
      runCliOutput(project, 'rules add "禁止直接修改生成产物文件"');
      const stdout = runCliOutput(project, 'rules list --json');
      const parsed = JSON.parse(stdout);

      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].content, '禁止直接修改生成产物文件');
    } finally {
      project.cleanup();
    }
  });
});
