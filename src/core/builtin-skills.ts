import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDir, fileExists, readText, writeJson, writeText } from '../utils/fs.js';
import { isoNow } from './shared.js';

export const BUILTIN_AIDA_SKILLS = [
  'aida-analyze',
  'aida-audit',
  'aida-govern',
  'aida-help',
  'aida-import',
  'aida-pkg',
  'aida-recall',
  'aida-remember',
  'aida-remember-branch',
  'aida-resolve',
  'aida-sync',
  'aida-ui',
  'aida-undo',
];

function assetSkillsRoot(): string {
  return resolve(import.meta.dirname, '..', 'assets', 'skills');
}

function copyDir(source: string, target: string): number {
  ensureDir(target);
  let count = 0;
  for (const name of readdirSync(source)) {
    const src = resolve(source, name);
    const dest = resolve(target, name);
    const stat = statSync(src);
    if (stat.isDirectory()) count += copyDir(src, dest);
    else {
      writeText(dest, readText(src));
      count++;
    }
  }
  return count;
}

export function buildSelfPlugin(outputDir: string, version: string): { outputPath: string; skills: string[]; files: number } {
  ensureDir(outputDir);
  const sourceRoot = assetSkillsRoot();
  const installed: string[] = [];
  let files = 0;

  for (const skill of BUILTIN_AIDA_SKILLS) {
    const source = resolve(sourceRoot, skill);
    if (!fileExists(resolve(source, 'SKILL.md'))) continue;
    const target = resolve(outputDir, 'skills', skill);
    files += copyDir(source, target);
    installed.push(skill);
  }

  const manifest = {
    schemaVersion: '3.0',
    name: 'aida',
    title: 'AIDA — Local AI Asset Manager',
    description: 'Built-in AIDA 3.0 skills for governance, memory, cleanup, analysis, and plugin packaging.',
    version,
    builtAt: isoNow(),
    skills: installed,
  };
  writeJson(resolve(outputDir, 'plugin.json'), manifest);
  files++;

  return { outputPath: outputDir, skills: installed, files };
}

