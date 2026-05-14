import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { configPath } from '../utils/paths.js';
import { fileExists, readJson, readText } from '../utils/fs.js';
import { loadSkillRegistry, type SkillCompanionFile } from '../utils/skills.js';
import type { AidaConfig } from '../schemas/aida-project.js';

const DEFAULT_SKILL_SCAN_PATHS = [
  '.aida/skills',
  '.cursor/skills',
  '.claude/skills',
  '.codex/skills',
  '.kiro/skills',
  '.agent/skills',
  '.agents/skills',
];

export function defaultSkillScanPaths(): string[] {
  return [...DEFAULT_SKILL_SCAN_PATHS];
}

const SCRIPT_FILE_PATTERN = /\.(?:sh|bash|zsh|py|js|cjs|mjs|ts)$/i;
const AUDITABLE_SKILL_FILE_PATTERN = /\.(?:md|txt|py|sh|bash|zsh|js|cjs|mjs|ts|json|yaml|yml|toml)$/i;
const NETWORK_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /\bcurl\b/i, signal: 'curl' },
  { pattern: /\bwget\b/i, signal: 'wget' },
  { pattern: /\bfetch\s*\(/i, signal: 'fetch()' },
  { pattern: /\baxios\./i, signal: 'axios' },
  { pattern: /\brequests\.(get|post|put|delete|request)\b/i, signal: 'requests' },
  { pattern: /\bhttpx\.(get|post|put|delete|request)\b/i, signal: 'httpx' },
  { pattern: /\burllib\.request\b/i, signal: 'urllib.request' },
  { pattern: /\bhttps?\.request\s*\(/i, signal: 'http(s).request()' },
  { pattern: /\bXMLHttpRequest\b/i, signal: 'XMLHttpRequest' },
];
const EXEC_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /\bexec(File)?\s*\(/i, signal: 'exec()/execFile()' },
  { pattern: /\bspawn\s*\(/i, signal: 'spawn()' },
  { pattern: /\bsubprocess\.(run|Popen|call|check_output|check_call)\b/i, signal: 'subprocess' },
  { pattern: /\bos\.system\s*\(/i, signal: 'os.system()' },
  { pattern: /\bchild_process\b/i, signal: 'child_process' },
  { pattern: /\bProcessBuilder\b/i, signal: 'ProcessBuilder' },
  { pattern: /\bbash\b/i, signal: 'bash' },
  { pattern: /\bsh\b/i, signal: 'sh' },
];
const DOWNLOAD_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /\bdownload(File|String)?\b/i, signal: 'download' },
  { pattern: /\bgit\s+clone\b/i, signal: 'git clone' },
  { pattern: /\bnpm\s+install\b/i, signal: 'npm install' },
  { pattern: /\bpnpm\s+add\b/i, signal: 'pnpm add' },
  { pattern: /\byarn\s+add\b/i, signal: 'yarn add' },
  { pattern: /\bpip\s+install\b/i, signal: 'pip install' },
];

const DIRECTORY_SKIP_NAMES = new Set([
  '.git',
  '.aida',
  '.cursor',
  '.claude',
  '.codex',
  '.agent',
  '.agents',
  '.kiro',
  '.lingma',
  '.vscode',
  'node_modules',
  'dist',
  'dist-test',
  'build',
  'coverage',
]);

export type SecurityCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => { stdout: string; stderr: string; status: number; error?: string };

export interface PackageAuditFinding {
  source: 'npm-audit' | 'pnpm-audit' | 'yarn-audit' | 'osv'
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'osv'
  packageName: string
  severity: string
  title: string
  id: string
  dependencyPath?: string
  fixAvailable: boolean
  direct: boolean
  workspacePath: string
}

export interface PackageAuditWarning {
  type: 'missing-lockfile' | 'multiple-lockfiles' | 'command-missing' | 'command-failed' | 'osv-unavailable' | 'empty-project'
  message: string
  workspacePath?: string
}

export interface PackageAuditResult {
  findings: PackageAuditFinding[]
  warnings: PackageAuditWarning[]
  scannedTargets: Array<{ packageManager: 'npm' | 'pnpm' | 'yarn'; workspacePath: string }>
  osvScanned: boolean
}

export interface SkillAuditIssue {
  type: 'script-file' | 'command-exec' | 'network-request' | 'download-remote' | 'tool-instruction'
  filePath: string
  signal: string
  sample?: string
}

export interface SkillAuditFinding {
  skillName: string
  sourcePath: string
  issues: SkillAuditIssue[]
}

export interface SkillAuditWarning {
  type: 'empty-scan-paths' | 'missing-path'
  message: string
  path?: string
}

export interface SkillAuditResult {
  configuredPaths: string[]
  scannedPaths: string[]
  warnings: SkillAuditWarning[]
  findings: SkillAuditFinding[]
  scannedSkills: number
}

function defaultCommandRunner(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 1,
    error: result.error?.message,
  };
}

function loadConfig(projectRoot: string): AidaConfig {
  if (!fileExists(configPath(projectRoot))) return {};
  try {
    return readJson<AidaConfig>(configPath(projectRoot));
  } catch {
    return {};
  }
}

function parseJsonLoose(raw: string): any | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseNdjson(raw: string): any[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseJsonLoose(line))
    .filter((line) => line !== null);
}

function normalizeSeverity(value: string | undefined): string {
  const normalized = (value || 'unknown').toLowerCase();
  if (['critical', 'high', 'moderate', 'medium', 'low', 'info'].includes(normalized)) {
    return normalized === 'medium' ? 'moderate' : normalized;
  }
  return 'unknown';
}

function severityFromCvssScore(score: number | undefined): string {
  if (!score || Number.isNaN(score)) return 'unknown';
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'moderate';
  if (score > 0) return 'low';
  return 'unknown';
}

function safeRelative(projectRoot: string, targetPath: string): string {
  const rel = relative(projectRoot, targetPath).replace(/\\/g, '/');
  return rel || '.';
}

function discoverAuditTargets(projectRoot: string): {
  targets: Array<{ packageManager: 'npm' | 'pnpm' | 'yarn'; workspacePath: string; fullPath: string }>
  warnings: PackageAuditWarning[]
} {
  const found = new Map<string, { packageManager: 'npm' | 'pnpm' | 'yarn'; workspacePath: string; fullPath: string }>();
  const packageJsonDirs = new Set<string>();
  const lockfileHits = new Map<string, string[]>();
  const stack = [projectRoot];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      if (DIRECTORY_SKIP_NAMES.has(name)) continue;
      const fullPath = resolve(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (name === 'package.json') {
        packageJsonDirs.add(current);
      }

      let packageManager: 'npm' | 'pnpm' | 'yarn' | null = null;
      if (name === 'package-lock.json' || name === 'npm-shrinkwrap.json') packageManager = 'npm';
      if (name === 'pnpm-lock.yaml') packageManager = 'pnpm';
      if (name === 'yarn.lock') packageManager = 'yarn';
      if (!packageManager) continue;

      const workspacePath = safeRelative(projectRoot, current);
      const key = `${packageManager}:${workspacePath}`;
      found.set(key, { packageManager, workspacePath, fullPath: current });
      const existing = lockfileHits.get(workspacePath) || [];
      existing.push(name);
      lockfileHits.set(workspacePath, existing);
    }
  }

  const warnings: PackageAuditWarning[] = [];
  if (found.size === 0) {
    if (packageJsonDirs.size > 0) {
      warnings.push({
        type: 'missing-lockfile',
        message: 'No supported lockfile found. Add package-lock.json, pnpm-lock.yaml, or yarn.lock for higher-confidence dependency auditing.',
      });
    } else {
      warnings.push({
        type: 'empty-project',
        message: 'No package.json or supported lockfile found. Skipping package security audit.',
      });
    }
  }

  for (const [workspacePath, names] of lockfileHits) {
    if (names.length > 1) {
      warnings.push({
        type: 'multiple-lockfiles',
        workspacePath,
        message: `Multiple lockfiles detected in ${workspacePath}: ${names.join(', ')}. Review each package manager result separately.`,
      });
    }
  }

  return {
    targets: [...found.values()].sort((a, b) => a.workspacePath.localeCompare(b.workspacePath) || a.packageManager.localeCompare(b.packageManager)),
    warnings,
  };
}

function normalizeAuditPayload(raw: string): any | null {
  const parsed = parseJsonLoose(raw);
  if (parsed) return parsed;

  const lines = parseNdjson(raw);
  if (lines.length === 0) return null;

  const advisories = lines
    .filter((entry) => entry?.type === 'auditAdvisory' && entry?.data?.advisory)
    .map((entry) => entry.data.advisory);
  if (advisories.length > 0) {
    return { advisories };
  }

  return lines[lines.length - 1];
}

function parseNativeAuditFindings(
  payload: any,
  source: 'npm-audit' | 'pnpm-audit' | 'yarn-audit',
  packageManager: 'npm' | 'pnpm' | 'yarn',
  workspacePath: string,
): PackageAuditFinding[] {
  const findings: PackageAuditFinding[] = [];
  const seen = new Set<string>();

  const advisories = payload?.advisories && typeof payload.advisories === 'object'
    ? Object.values(payload.advisories)
    : [];
  for (const advisory of advisories as any[]) {
    const pkg = advisory?.module_name || advisory?.name || 'unknown-package';
    const id = String(advisory?.id || advisory?.url || `${pkg}:advisory`);
    const key = `${workspacePath}:${pkg}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      source,
      packageManager,
      packageName: pkg,
      severity: normalizeSeverity(advisory?.severity),
      title: advisory?.title || advisory?.overview || 'Known vulnerability',
      id,
      dependencyPath: Array.isArray(advisory?.findings) ? advisory.findings[0]?.paths?.[0] : undefined,
      fixAvailable: Boolean(advisory?.recommendation || advisory?.fix_available),
      direct: false,
      workspacePath,
    });
  }

  const vulnerabilities = payload?.vulnerabilities && typeof payload.vulnerabilities === 'object'
    ? Object.entries(payload.vulnerabilities)
    : [];
  for (const [pkg, vulnerability] of vulnerabilities as Array<[string, any]>) {
    const viaObjects = Array.isArray(vulnerability?.via)
      ? vulnerability.via.filter((item: any) => item && typeof item === 'object')
      : [];
    if (viaObjects.length === 0) {
      const id = String(vulnerability?.name || `${pkg}:vulnerability`);
      const key = `${workspacePath}:${pkg}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        source,
        packageManager,
        packageName: pkg,
        severity: normalizeSeverity(vulnerability?.severity),
        title: vulnerability?.title || `Known vulnerability in ${pkg}`,
        id,
        dependencyPath: vulnerability?.nodes?.[0],
        fixAvailable: Boolean(vulnerability?.fixAvailable),
        direct: Boolean(vulnerability?.isDirect),
        workspacePath,
      });
      continue;
    }

    for (const item of viaObjects) {
      const id = String(item?.source || item?.name || `${pkg}:via`);
      const key = `${workspacePath}:${pkg}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        source,
        packageManager,
        packageName: pkg,
        severity: normalizeSeverity(item?.severity || vulnerability?.severity),
        title: item?.title || item?.name || `Known vulnerability in ${pkg}`,
        id,
        dependencyPath: vulnerability?.nodes?.[0],
        fixAvailable: Boolean(vulnerability?.fixAvailable),
        direct: Boolean(vulnerability?.isDirect),
        workspacePath,
      });
    }
  }

  return findings;
}

function parseOsvFindings(payload: any, projectRoot: string): PackageAuditFinding[] {
  const findings: PackageAuditFinding[] = [];
  const seen = new Set<string>();

  for (const result of Array.isArray(payload?.results) ? payload.results : []) {
    const workspacePath = result?.source?.path
      ? safeRelative(projectRoot, resolve(projectRoot, result.source.path))
      : '.';
    for (const pkgEntry of Array.isArray(result?.packages) ? result.packages : []) {
      const pkg = pkgEntry?.package?.name || 'unknown-package';
      for (const vuln of Array.isArray(pkgEntry?.vulnerabilities) ? pkgEntry.vulnerabilities : []) {
        const id = String(vuln?.id || `${pkg}:osv`);
        const key = `${workspacePath}:${pkg}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const score = Array.isArray(vuln?.severity)
          ? Number.parseFloat(String(vuln.severity[0]?.score || ''))
          : Number.NaN;
        findings.push({
          source: 'osv',
          packageManager: 'osv',
          packageName: pkg,
          severity: severityFromCvssScore(score),
          title: vuln?.summary || vuln?.details || `Known vulnerability in ${pkg}`,
          id,
          dependencyPath: result?.source?.path ? safeRelative(projectRoot, resolve(result.source.path)) : undefined,
          fixAvailable: Array.isArray(vuln?.affected)
            ? vuln.affected.some((affected: any) => Array.isArray(affected?.ranges) && affected.ranges.length > 0)
            : false,
          direct: false,
          workspacePath,
        });
      }
    }
  }

  return findings;
}

function dedupePackageFindings(findings: PackageAuditFinding[]): PackageAuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = [
      finding.source,
      finding.workspacePath,
      finding.packageName,
      finding.id,
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function auditPackageSecurity(
  projectRoot: string,
  runner: SecurityCommandRunner = defaultCommandRunner,
): PackageAuditResult {
  const { targets, warnings } = discoverAuditTargets(projectRoot);
  const findings: PackageAuditFinding[] = [];

  for (const target of targets) {
    const commandSets: Array<{ source: 'npm-audit' | 'pnpm-audit' | 'yarn-audit'; args: string[]; packageManager: 'npm' | 'pnpm' | 'yarn'; command: string }> = [];
    if (target.packageManager === 'npm') {
      commandSets.push({ source: 'npm-audit', packageManager: 'npm', command: 'npm', args: ['audit', '--json'] });
    } else if (target.packageManager === 'pnpm') {
      commandSets.push({ source: 'pnpm-audit', packageManager: 'pnpm', command: 'pnpm', args: ['audit', '--json'] });
    } else if (target.packageManager === 'yarn') {
      commandSets.push({ source: 'yarn-audit', packageManager: 'yarn', command: 'yarn', args: ['npm', 'audit', '--all', '--recursive', '--json'] });
      commandSets.push({ source: 'yarn-audit', packageManager: 'yarn', command: 'yarn', args: ['audit', '--json'] });
    }

    let handled = false;
    for (const commandSet of commandSets) {
      const result = runner(commandSet.command, commandSet.args, target.fullPath);
      if (result.error && /ENOENT/i.test(result.error)) {
        warnings.push({
          type: 'command-missing',
          workspacePath: target.workspacePath,
          message: `Could not run ${commandSet.command} for ${target.workspacePath}. Install the package manager locally to enable native audit output.`,
        });
        handled = true;
        break;
      }

      const payload = normalizeAuditPayload(result.stdout || result.stderr);
      if (!payload) {
        if (commandSet.packageManager === 'yarn' && commandSet.args[0] === 'npm') {
          continue;
        }
        warnings.push({
          type: 'command-failed',
          workspacePath: target.workspacePath,
          message: `${commandSet.command} ${commandSet.args.join(' ')} did not return parseable audit output for ${target.workspacePath}.`,
        });
        handled = true;
        break;
      }

      findings.push(...parseNativeAuditFindings(payload, commandSet.source, commandSet.packageManager, target.workspacePath));
      handled = true;
      break;
    }

    if (!handled) {
      warnings.push({
        type: 'command-failed',
        workspacePath: target.workspacePath,
        message: `No usable native audit command succeeded for ${target.workspacePath}.`,
      });
    }
  }

  let osvScanned = false;
  const osvVersion = runner('osv-scanner', ['--version'], projectRoot);
  if (!osvVersion.error || osvVersion.status === 0 || osvVersion.stdout.trim() || osvVersion.stderr.trim()) {
    const osvResult = runner('osv-scanner', ['scan', '--format', 'json', '-r', projectRoot], projectRoot);
    const payload = normalizeAuditPayload(osvResult.stdout);
    if (payload) {
      findings.push(...parseOsvFindings(payload, projectRoot));
      osvScanned = true;
    } else {
      warnings.push({
        type: 'command-failed',
        message: 'osv-scanner was detected but did not return parseable JSON output.',
      });
    }
  } else {
    warnings.push({
      type: 'osv-unavailable',
      message: 'OSV enhanced scanning is not enabled because osv-scanner is not installed locally.',
    });
  }

  return {
    findings: dedupePackageFindings(findings),
    warnings,
    scannedTargets: targets.map((target) => ({
      packageManager: target.packageManager,
      workspacePath: target.workspacePath,
    })),
    osvScanned,
  };
}

function firstMatchingSample(content: string, pattern: RegExp): string | undefined {
  for (const line of content.split('\n')) {
    if (pattern.test(line)) return line.trim().slice(0, 200);
  }
  return undefined;
}

function analyzeSkillFile(filePath: string, content: string, issueTypeForMarkdown: SkillAuditIssue['type'] = 'tool-instruction'): SkillAuditIssue[] {
  const issues: SkillAuditIssue[] = [];

  if (SCRIPT_FILE_PATTERN.test(filePath)) {
    issues.push({
      type: 'script-file',
      filePath,
      signal: 'script file detected',
    });
  }

  for (const candidate of NETWORK_PATTERNS) {
    if (candidate.pattern.test(content)) {
      issues.push({
        type: filePath.endsWith('SKILL.md') || filePath.toLowerCase().endsWith('.md') ? issueTypeForMarkdown : 'network-request',
        filePath,
        signal: candidate.signal,
        sample: firstMatchingSample(content, candidate.pattern),
      });
    }
  }

  for (const candidate of EXEC_PATTERNS) {
    if (candidate.pattern.test(content)) {
      issues.push({
        type: filePath.endsWith('SKILL.md') || filePath.toLowerCase().endsWith('.md') ? issueTypeForMarkdown : 'command-exec',
        filePath,
        signal: candidate.signal,
        sample: firstMatchingSample(content, candidate.pattern),
      });
    }
  }

  for (const candidate of DOWNLOAD_PATTERNS) {
    if (candidate.pattern.test(content)) {
      issues.push({
        type: filePath.endsWith('SKILL.md') || filePath.toLowerCase().endsWith('.md') ? issueTypeForMarkdown : 'download-remote',
        filePath,
        signal: candidate.signal,
        sample: firstMatchingSample(content, candidate.pattern),
      });
    }
  }

  const deduped = new Map<string, SkillAuditIssue>();
  for (const issue of issues) {
    deduped.set(`${issue.type}:${issue.filePath}:${issue.signal}`, issue);
  }
  return [...deduped.values()];
}

function collectSkillDirectoryFiles(rootDir: string): SkillCompanionFile[] {
  const files: SkillCompanionFile[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const fullPath = resolve(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');
      if (!AUDITABLE_SKILL_FILE_PATTERN.test(relPath) && relPath !== 'SKILL.md') continue;
      files.push({
        path: relPath,
        content: readText(fullPath),
      });
    }
  }

  return files;
}

function discoverSkillPackages(skillRoot: string): Array<{ name: string; sourcePath: string; files: SkillCompanionFile[]; content: string }> {
  if (!fileExists(skillRoot)) return [];
  const packages: Array<{ name: string; sourcePath: string; files: SkillCompanionFile[]; content: string }> = [];
  const seen = new Set<string>();

  const stack = [skillRoot];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current);
    if (entries.includes('SKILL.md')) {
      const sourcePath = resolve(current, 'SKILL.md');
      if (!seen.has(sourcePath)) {
        seen.add(sourcePath);
        packages.push({
          name: relative(skillRoot, current).replace(/\\/g, '/') || current.split('/').pop() || 'unnamed-skill',
          sourcePath,
          content: readText(sourcePath),
          files: collectSkillDirectoryFiles(current).filter((file) => file.path !== 'SKILL.md'),
        });
      }
      continue;
    }

    for (const name of entries) {
      const fullPath = resolve(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!AUDITABLE_SKILL_FILE_PATTERN.test(name)) continue;
      if (seen.has(fullPath)) continue;
      seen.add(fullPath);
      packages.push({
        name: name.replace(/\.md$/, ''),
        sourcePath: fullPath,
        content: readText(fullPath),
        files: [],
      });
    }
  }

  return packages;
}

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function configuredSkillScanPaths(projectRoot: string): {
  paths: string[]
  mode: 'default' | 'custom'
} {
  const config = loadConfig(projectRoot);
  const explicit = config.security?.skillScanPaths;
  if (Array.isArray(explicit)) {
    const normalized = [...new Set(explicit.map((item) => String(item).trim()).filter(Boolean))];
    return {
      paths: normalized,
      mode: sameStringArray(normalized, DEFAULT_SKILL_SCAN_PATHS) ? 'default' : 'custom',
    };
  }
  return {
    paths: DEFAULT_SKILL_SCAN_PATHS,
    mode: 'default',
  };
}

export function auditSkillSecurity(projectRoot: string): SkillAuditResult {
  const { paths: configuredPaths, mode } = configuredSkillScanPaths(projectRoot);
  const warnings: SkillAuditWarning[] = [];
  if (configuredPaths.length === 0) {
    warnings.push({
      type: 'empty-scan-paths',
      message: 'Skill scan paths are empty. Configure .aida/config.json > security.skillScanPaths before running skill security audit.',
    });
    return {
      configuredPaths,
      scannedPaths: [],
      warnings,
      findings: [],
      scannedSkills: 0,
    };
  }

  const findings: SkillAuditFinding[] = [];
  const scannedSkillKeys = new Set<string>();
  const registryEntries = loadSkillRegistry(projectRoot);
  const registrySourcePaths = new Set(
    registryEntries
      .map((entry) => entry.source.path)
      .filter((path): path is string => Boolean(path))
      .map((path) => path.replace(/\\/g, '/')),
  );

  for (const entry of registryEntries) {
    scannedSkillKeys.add(`registry:${entry.source.path || entry.name}`);
    const issues = [
      ...analyzeSkillFile(entry.source.path || `${entry.name}/SKILL.md`, entry.content),
      ...(entry.files || []).flatMap((file) => analyzeSkillFile(file.path, file.content)),
    ];
    if (issues.length > 0) {
      findings.push({
        skillName: entry.name,
        sourcePath: entry.source.path || `.aida/skills.json#${entry.id}`,
        issues,
      });
    }
  }

  const scannedPaths: string[] = [];
  for (const skillPath of configuredPaths) {
    const fullPath = resolve(projectRoot, skillPath);
    if (!fileExists(fullPath)) {
      if (mode === 'custom') {
        warnings.push({
          type: 'missing-path',
          path: skillPath,
          message: `Configured skill scan path does not exist: ${skillPath}`,
        });
      }
      continue;
    }
    scannedPaths.push(skillPath);

    for (const discovered of discoverSkillPackages(fullPath)) {
      const relSourcePath = safeRelative(projectRoot, discovered.sourcePath);
      if (registrySourcePaths.has(relSourcePath)) continue;
      scannedSkillKeys.add(`path:${relSourcePath}`);
      const issues = [
        ...analyzeSkillFile(relSourcePath, discovered.content),
        ...discovered.files.flatMap((file) => analyzeSkillFile(`${relSourcePath.replace(/SKILL\.md$/u, '')}${file.path}`, file.content)),
      ];
      if (issues.length === 0) continue;
      findings.push({
        skillName: discovered.name,
        sourcePath: relSourcePath,
        issues,
      });
    }
  }

  return {
    configuredPaths,
    scannedPaths,
    warnings,
    findings,
    scannedSkills: scannedSkillKeys.size,
  };
}
