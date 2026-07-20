import { createHash } from 'node:crypto';

export function isoNow(): string {
  return new Date().toISOString();
}

export function sha256Short(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex').slice(0, 16)}`;
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'asset';
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function excerpt(content: string, max = 600): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}
