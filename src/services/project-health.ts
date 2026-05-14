import { inspectProjectHealth, normalizeProjectTruthSources } from '../utils/project-health.js';
import { findSimilarRules, loadRegistry } from '../utils/rules.js';
import { auditPackageSecurity, auditSkillSecurity } from './security-audit.js';

export function inspectProject(projectRoot: string) {
  return {
    report: inspectProjectHealth(projectRoot),
    similarRules: findSimilarRules(loadRegistry(projectRoot)).slice(0, 10),
  };
}

export function normalizeProject(projectRoot: string) {
  return normalizeProjectTruthSources(projectRoot);
}

export function inspectSecurity(projectRoot: string, mode: 'all' | 'npm' | 'skills' = 'all') {
  return {
    packageAudit: mode === 'all' || mode === 'npm' ? auditPackageSecurity(projectRoot) : null,
    skillAudit: mode === 'all' || mode === 'skills' ? auditSkillSecurity(projectRoot) : null,
  };
}
