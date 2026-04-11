import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, basename } from 'node:path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readJson<T = unknown>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

export function readText(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

export function writeText(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8');
}

export function getProjectName(): string {
  try {
    const pkg = readJson<{ name?: string }>(
      resolve(process.cwd(), 'package.json'),
    );
    if (pkg.name) return pkg.name;
  } catch {
    /* no package.json */
  }
  return basename(process.cwd());
}

export function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory();
  });
}

/**
 * Extract ours/theirs sections from a file with git conflict markers.
 * Handles standard format and diff3 format (with ||||||| base section).
 * Returns null if no conflict markers found.
 */
export function extractConflictSections(
  raw: string,
): { ours: string; theirs: string } | null {
  const lines = raw.split('\n');
  type State = 'before' | 'ours' | 'base' | 'theirs';
  let state: State = 'before';
  let hasConflict = false;
  const oursLines: string[] = [];
  const theirsLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      hasConflict = true;
      state = 'ours';
    } else if (line.startsWith('|||||||')) {
      state = 'base'; // diff3 base section — skip
    } else if (line.startsWith('=======')) {
      state = 'theirs';
    } else if (line.startsWith('>>>>>>>')) {
      state = 'before'; // reset after conflict block
    } else {
      if (state === 'ours') oursLines.push(line);
      else if (state === 'theirs') theirsLines.push(line);
    }
  }

  if (!hasConflict) return null;
  return {
    ours: oursLines.join('\n').trim(),
    theirs: theirsLines.join('\n').trim(),
  };
}
