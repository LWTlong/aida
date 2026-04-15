import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDir, fileExists, listDirs, readJson, readText, writeJson, writeText } from './fs.js';
import { aidaDir, SKILLS_DIR } from './paths.js';

export interface SkillRegistryEntry {
  id: string
  name: string
  content: string
  fingerprint: string
  source: {
    kind: 'bundled' | 'local'
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

export function skillFingerprint(content: string): string {
  return createHash('sha256').update(normalize(content)).digest('hex').substring(0, 12);
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
    const data = readJson<SkillRegistryEntry[]>(p);
    return Array.isArray(data) ? data : [];
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
  writeJson(skillsRegistryPath(projectRoot), entries);
}

function bundledSkillNames(): string[] {
  return readdirSync(SKILLS_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))
    .sort();
}

export function isBundledSkillName(name: string): boolean {
  return bundledSkillNames().includes(name);
}

export function bundledSkillEntries(): SkillRegistryEntry[] {
  const now = new Date().toISOString();
  return bundledSkillNames().map((name, index) => {
    const content = readText(resolve(SKILLS_DIR, `${name}.md`));
    return {
      id: `SKILL-${String(index + 1).padStart(3, '0')}`,
      name,
      content,
      fingerprint: skillFingerprint(content),
      source: {
        kind: 'bundled' as const,
        path: `src/assets/skills/${name}.md`,
      },
      updatedAt: now,
      status: 'active' as const,
    };
  });
}

export function seedBundledSkillRegistry(projectRoot: string): SkillRegistryEntry[] {
  const entries = bundledSkillEntries();
  saveSkillRegistry(projectRoot, entries);
  return entries;
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
    return seedBundledSkillRegistry(projectRoot);
  }

  const now = new Date().toISOString();
  const entries = localSkills
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry, index) => {
      const content = readText(entry.path);
      return {
        id: `SKILL-${String(index + 1).padStart(3, '0')}`,
        name: entry.name,
        content,
        fingerprint: skillFingerprint(content),
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
    const content = readText(skill.path);
    const fp = skillFingerprint(content);
    const named = byName.get(skill.name);

    if (named) {
      if (named.fingerprint !== fp || named.content !== content || named.status !== 'active') {
        named.content = content;
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
  ensureDir(viewDir);

  let written = 0;
  for (const entry of skillFiles(entries)) {
    const destDir = resolve(viewDir, entry.name);
    ensureDir(destDir);
    writeText(resolve(destDir, 'SKILL.md'), entry.content);
    written++;
  }

  return written;
}

export function getSkillContent(projectRoot: string, skillName: string): string | null {
  const entry = bootstrapSkillRegistry(projectRoot).find((item) => item.name === skillName && item.status === 'active');
  return entry?.content || null;
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
  entry.fingerprint = skillFingerprint(content);
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

export function ensureBundledSkills(projectRoot: string): { total: number; added: number } {
  const existing = loadSkillRegistry(projectRoot);
  if (existing.length === 0) {
    const seeded = seedBundledSkillRegistry(projectRoot);
    return { total: seeded.length, added: seeded.length };
  }

  const bundled = bundledSkillEntries();
  const { merged, added } = mergeSkillRegistries(existing, bundled);
  if (added > 0) {
    saveSkillRegistry(projectRoot, merged);
  }
  return { total: merged.length, added };
}
