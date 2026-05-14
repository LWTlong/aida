import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ensureDir, fileExists, listDirs, readText, resetDir, writeText, extractConflictSections } from './fs.js';
import { aidaDir } from './paths.js';
import { readRegistryEnvelope, writeRegistryEnvelope } from './registry.js';
import { parseConflictRegistryItems } from './registry.js';

export interface SkillCompanionFile {
  path: string
  content: string
}

export interface SkillRegistryEntry {
  id: string
  name: string
  content: string
  fingerprint: string
  files?: SkillCompanionFile[]
  source: {
    kind: 'local'
    path?: string
  }
  updatedAt: string
  status: 'active' | 'deprecated'
}

export function skillsRegistryPath(projectRoot: string): string {
  return resolve(aidaDir(projectRoot), 'skills.json');
}

export function skillsViewDir(projectRoot: string): string {
  return resolve(aidaDir(projectRoot), 'skills');
}

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, ' ')
    .trim();
}

function normalizeSkillFiles(files: SkillCompanionFile[] = []): SkillCompanionFile[] {
  return [...files]
    .filter((file) => file.path && !file.path.startsWith('../'))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => ({ path: file.path.replace(/\\/g, '/'), content: file.content }));
}

function isSupportedSkillAsset(path: string): boolean {
  const lowered = path.toLowerCase();
  return lowered.endsWith('.md')
    || lowered.endsWith('.txt')
    || lowered.endsWith('.py')
    || lowered.endsWith('.sh')
    || lowered.endsWith('.js')
    || lowered.endsWith('.ts')
    || lowered.endsWith('.cjs')
    || lowered.endsWith('.mjs')
    || lowered.endsWith('.json')
    || lowered.endsWith('.yaml')
    || lowered.endsWith('.yml')
    || lowered.endsWith('.toml');
}

function collectSkillPackage(skillDir: string): { content: string; files: SkillCompanionFile[] } | null {
  const mainFile = resolve(skillDir, 'SKILL.md');
  if (!fileExists(mainFile)) return null;

  const content = readText(mainFile);
  const files: SkillCompanionFile[] = [];
  const stack = [skillDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const fullPath = resolve(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (fullPath === mainFile) continue;
      const relPath = relative(skillDir, fullPath).replace(/\\/g, '/');
      if (!isSupportedSkillAsset(relPath)) continue;
      files.push({
        path: relPath,
        content: readText(fullPath),
      });
    }
  }

  return {
    content,
    files: normalizeSkillFiles(files),
  };
}

export function skillFingerprint(content: string, files: SkillCompanionFile[] = []): string {
  const payload = JSON.stringify({
    content: normalize(content),
    files: normalizeSkillFiles(files).map((file) => ({
      path: file.path,
      content: normalize(file.content),
    })),
  });
  return createHash('sha256').update(payload).digest('hex').substring(0, 12);
}

export function nextSkillId(entries: SkillRegistryEntry[]): string {
  const nums = entries
    .map((entry) => {
      const match = entry.id.match(/^SKILL-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `SKILL-${String(max + 1).padStart(3, '0')}`;
}

export function loadSkillRegistry(projectRoot: string): SkillRegistryEntry[] {
  const p = skillsRegistryPath(projectRoot);
  if (!fileExists(p)) return [];
  try {
    return readRegistryEnvelope<SkillRegistryEntry>(p).items;
  } catch {
    return [];
  }
}

export function activeSkills(entries: SkillRegistryEntry[]): SkillRegistryEntry[] {
  return entries.filter((entry) => entry.status === 'active');
}

export function skillFiles(entries: SkillRegistryEntry[]): Array<{ name: string; content: string }> {
  return activeSkills(entries).map((entry) => ({ name: entry.name, content: entry.content }));
}

export function saveSkillRegistry(projectRoot: string, entries: SkillRegistryEntry[]): void {
  writeRegistryEnvelope(skillsRegistryPath(projectRoot), entries);
}

export function mergeSkillRegistry(projectRoot: string): { status: 'merged' | 'no-conflict' | 'missing' | 'error'; added?: number; total?: number } {
  const regPath = skillsRegistryPath(projectRoot);

  if (!fileExists(regPath)) {
    return { status: 'missing' };
  }

  const raw = readText(regPath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) {
    return { status: 'no-conflict' };
  }

  const sections = extractConflictSections(raw);
  if (!sections) {
    return { status: 'error' };
  }

  const ours = parseConflictRegistryItems<SkillRegistryEntry>(sections.ours);
  const theirs = parseConflictRegistryItems<SkillRegistryEntry>(sections.theirs);
  const { merged, added } = mergeSkillRegistries(ours, theirs);
  saveSkillRegistry(projectRoot, merged);

  return { status: 'merged', added, total: merged.length };
}

export function bootstrapSkillRegistry(projectRoot: string): SkillRegistryEntry[] {
  const existing = loadSkillRegistry(projectRoot);
  if (existing.length > 0) return existing;

  const localSkillDir = skillsViewDir(projectRoot);
  const localSkills = listDirs(localSkillDir)
    .map((name) => ({
      name,
      path: resolve(localSkillDir, name, 'SKILL.md'),
    }))
    .filter((entry) => fileExists(entry.path));

  if (localSkills.length === 0) {
    saveSkillRegistry(projectRoot, []);
    return [];
  }

  const now = new Date().toISOString();
  const entries = localSkills
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry, index) => {
      const collected = collectSkillPackage(resolve(localSkillDir, entry.name));
      const content = collected?.content || readText(entry.path);
      const files = collected?.files || [];
      return {
        id: `SKILL-${String(index + 1).padStart(3, '0')}`,
        name: entry.name,
        content,
        files,
        fingerprint: skillFingerprint(content, files),
        source: {
          kind: 'local' as const,
          path: `.aida/skills/${entry.name}/SKILL.md`,
        },
        updatedAt: now,
        status: 'active' as const,
      };
    });

  saveSkillRegistry(projectRoot, entries);
  return entries;
}

export function importSkillsFromViews(projectRoot: string): { entries: SkillRegistryEntry[]; imported: number } {
  const existing = loadSkillRegistry(projectRoot);
  const now = new Date().toISOString();
  const byName = new Map(existing.map((entry) => [entry.name, entry]));
  const byFingerprint = new Map(existing.map((entry) => [entry.fingerprint, entry]));
  const localSkillDir = skillsViewDir(projectRoot);
  const localSkills = listDirs(localSkillDir)
    .map((name) => ({
      name,
      path: resolve(localSkillDir, name, 'SKILL.md'),
    }))
    .filter((entry) => fileExists(entry.path))
    .sort((a, b) => a.name.localeCompare(b.name));

  let imported = 0;
  const merged = [...existing];

  for (const skill of localSkills) {
    const collected = collectSkillPackage(resolve(localSkillDir, skill.name));
    const content = collected?.content || readText(skill.path);
    const files = collected?.files || [];
    const fp = skillFingerprint(content, files);
    const named = byName.get(skill.name);

    if (named) {
      if (named.fingerprint !== fp || named.content !== content || JSON.stringify(named.files || []) !== JSON.stringify(files) || named.status !== 'active') {
        named.content = content;
        named.files = files;
        named.fingerprint = fp;
        named.updatedAt = now;
        named.status = 'active';
        named.source = {
          kind: 'local',
          path: `.aida/skills/${skill.name}/SKILL.md`,
        };
        imported++;
      }
      byFingerprint.set(fp, named);
      continue;
    }

    const sameContent = byFingerprint.get(fp);
    if (sameContent) continue;

    const entry: SkillRegistryEntry = {
      id: nextSkillId(merged),
      name: skill.name,
      content,
      files,
      fingerprint: fp,
      source: {
        kind: 'local',
        path: `.aida/skills/${skill.name}/SKILL.md`,
      },
      updatedAt: now,
      status: 'active',
    };
    merged.push(entry);
    byName.set(entry.name, entry);
    byFingerprint.set(fp, entry);
    imported++;
  }

  if (imported > 0 || existing.length === 0) {
    saveSkillRegistry(projectRoot, merged);
  }

  return { entries: merged, imported };
}

export function buildSkillViews(projectRoot: string): number {
  const entries = bootstrapSkillRegistry(projectRoot);
  const viewDir = skillsViewDir(projectRoot);
  resetDir(viewDir);

  let written = 0;
  for (const entry of activeSkills(entries)) {
    const destDir = resolve(viewDir, entry.name);
    ensureDir(destDir);
    writeText(resolve(destDir, 'SKILL.md'), entry.content);
    for (const file of normalizeSkillFiles(entry.files || [])) {
      const fullPath = resolve(destDir, file.path);
      ensureDir(resolve(fullPath, '..'));
      writeText(fullPath, file.content);
      written++;
    }
    written++;
  }

  return written;
}

export function updateSkillContent(
  projectRoot: string,
  skillName: string,
  content: string,
): SkillRegistryEntry | null {
  const entries = bootstrapSkillRegistry(projectRoot);
  const entry = entries.find((item) => item.name === skillName);
  if (!entry) return null;

  entry.content = content;
  entry.fingerprint = skillFingerprint(content, entry.files || []);
  entry.updatedAt = new Date().toISOString();
  saveSkillRegistry(projectRoot, entries);
  return entry;
}

export function mergeSkillRegistries(
  base: SkillRegistryEntry[],
  incoming: SkillRegistryEntry[],
): { merged: SkillRegistryEntry[]; added: number } {
  const fpSet = new Set(base.map((entry) => entry.fingerprint));
  const merged = [...base];
  let added = 0;

  for (const entry of incoming) {
    if (fpSet.has(entry.fingerprint)) continue;
    merged.push({
      ...entry,
      id: nextSkillId(merged),
    });
    fpSet.add(entry.fingerprint);
    added++;
  }

  return { merged, added };
}
