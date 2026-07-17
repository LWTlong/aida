import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
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
