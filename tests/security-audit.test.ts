import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureDir, writeJson, writeText } from '../src/utils/fs.js';
import { auditPackageSecurity, auditSkillSecurity, defaultSkillScanPaths } from '../src/services/security-audit.js';

describe('auditPackageSecurity', () => {
  it('should aggregate native audit findings and warn when OSV scanner is unavailable', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-security-'));
    try {
      writeJson(resolve(root, 'package.json'), {
        name: 'security-test',
        version: '1.0.0',
      });
      writeText(resolve(root, 'package-lock.json'), '{}\n');

      const result = auditPackageSecurity(root, (command, args) => {
        if (command === 'npm' && args.join(' ') === 'audit --json') {
          return {
            stdout: JSON.stringify({
              vulnerabilities: {
                lodash: {
                  name: 'lodash',
                  severity: 'high',
                  isDirect: true,
                  fixAvailable: true,
                  via: [
                    {
                      source: 1106913,
                      name: 'lodash',
                      title: 'Prototype Pollution in lodash',
                      severity: 'high',
                    },
                  ],
                },
              },
            }),
            stderr: '',
            status: 1,
          };
        }

        if (command === 'osv-scanner') {
          return {
            stdout: '',
            stderr: '',
            status: 1,
            error: 'ENOENT',
          };
        }

        return {
          stdout: '',
          stderr: '',
          status: 1,
          error: 'unexpected command',
        };
      });

      assert.equal(result.scannedTargets.length, 1);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].packageName, 'lodash');
      assert.equal(result.findings[0].severity, 'high');
      assert.equal(result.findings[0].source, 'npm-audit');
      assert.equal(result.findings[0].direct, true);
      assert.equal(result.osvScanned, false);
      assert.ok(result.warnings.some((warning) => warning.type === 'osv-unavailable'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should warn when package.json exists but no lockfile is present', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-security-'));
    try {
      writeJson(resolve(root, 'package.json'), {
        name: 'security-test',
        version: '1.0.0',
      });

      const result = auditPackageSecurity(root, () => ({
        stdout: '',
        stderr: '',
        status: 0,
      }));

      assert.equal(result.findings.length, 0);
      assert.ok(result.warnings.some((warning) => warning.type === 'missing-lockfile'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('auditSkillSecurity', () => {
  it('should scan registry skills and configured project skill paths for warning signals', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-skill-security-'));
    try {
      ensureDir(resolve(root, '.aida'));
      ensureDir(resolve(root, '.cursor', 'skills', 'external-skill'));
      writeJson(resolve(root, '.aida', 'config.json'), {
        schemaVersion: '2.0',
        project: 'skill-security-test',
        security: {
          skillScanPaths: ['.aida/skills', '.cursor/skills', '.missing/skills'],
        },
      });
      writeJson(resolve(root, '.aida', 'skills.json'), {
        schemaVersion: '2.0',
        updatedAt: '2026-05-14T00:00:00.000Z',
        items: [
          {
            id: 'SKILL-001',
            name: 'team-playbook',
            content: 'Run python audit.py and curl https://example.com/data',
            files: [
              {
                path: 'audit.py',
                content: 'import requests\nrequests.get("https://example.com")\n',
              },
            ],
            fingerprint: 'fp-1',
            source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
            updatedAt: '2026-05-14T00:00:00.000Z',
            status: 'active',
          },
        ],
      });
      writeText(resolve(root, '.cursor', 'skills', 'external-skill', 'SKILL.md'), '# External Skill\n\nUse bash setup.sh and wget https://example.com/pkg\n');
      writeText(resolve(root, '.cursor', 'skills', 'external-skill', 'setup.sh'), '#!/bin/sh\ncurl https://example.com/install\n');

      const result = auditSkillSecurity(root);

      assert.deepEqual(defaultSkillScanPaths().includes('.cursor/skills'), true);
      assert.equal(result.configuredPaths.length, 3);
      assert.equal(result.scannedPaths.includes('.cursor/skills'), true);
      assert.ok(result.warnings.some((warning) => warning.type === 'missing-path'));
      assert.ok(result.findings.some((finding) => finding.skillName === 'team-playbook'));
      assert.ok(result.findings.some((finding) => finding.skillName === 'external-skill'));
      assert.ok(result.findings.some((finding) => finding.issues.some((issue) => issue.type === 'network-request' || issue.type === 'tool-instruction')));
      assert.ok(result.findings.some((finding) => finding.issues.some((issue) => issue.type === 'script-file')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should scan deeply nested skill package files while ignoring non-text assets', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-skill-security-'));
    try {
      ensureDir(resolve(root, '.aida'));
      ensureDir(resolve(root, '.agents', 'skills', 'deep-skill', 'scripts', 'setup'));
      writeJson(resolve(root, '.aida', 'config.json'), {
        schemaVersion: '2.0',
        project: 'skill-security-test',
        security: {
          skillScanPaths: ['.agents/skills'],
        },
      });
      writeText(resolve(root, '.agents', 'skills', 'deep-skill', 'SKILL.md'), '# Deep Skill\n\nSee scripts/setup/bootstrap.sh\n');
      writeText(resolve(root, '.agents', 'skills', 'deep-skill', 'scripts', 'setup', 'bootstrap.sh'), '#!/bin/sh\ncurl https://example.com/bootstrap\n');
      writeText(resolve(root, '.agents', 'skills', 'deep-skill', 'scripts', 'setup', 'diagram.svg'), '<svg></svg>');

      const result = auditSkillSecurity(root);
      const finding = result.findings.find((item) => item.skillName === 'deep-skill');

      assert.ok(finding);
      assert.ok(finding!.issues.some((issue) => issue.filePath.includes('bootstrap.sh') && issue.type === 'script-file'));
      assert.equal(finding!.issues.some((issue) => issue.filePath.includes('diagram.svg')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should warn when skill scan paths are explicitly empty', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-skill-security-'));
    try {
      ensureDir(resolve(root, '.aida'));
      writeJson(resolve(root, '.aida', 'config.json'), {
        schemaVersion: '2.0',
        project: 'skill-security-test',
        security: {
          skillScanPaths: [],
        },
      });

      const result = auditSkillSecurity(root);

      assert.equal(result.scannedPaths.length, 0);
      assert.equal(result.findings.length, 0);
      assert.ok(result.warnings.some((warning) => warning.type === 'empty-scan-paths'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
