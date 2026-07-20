import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { ensureDir, fileExists, readText, writeText } from '../../utils/fs.js';
import { slugify } from '../shared.js';

export interface DecisionMeta {
  slug: string;
  title: string;
  paths?: string[];
  status: 'accepted' | 'deprecated' | 'superseded';
  date: string;
  tags?: string[];
}

export interface Decision extends DecisionMeta {
  context: string;
  decision: string;
  consequences?: string;
  filePath: string;
}

function decisionsDir(projectRoot: string): string {
  return resolve(projectRoot, '.claude', 'rules', 'decisions');
}

type RawMeta = Record<string, string | string[]>;

function parseFrontmatter(content: string): { meta: RawMeta; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta: RawMeta = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val.startsWith('[')) {
      try { meta[key] = JSON.parse(val) as string[]; } catch { meta[key] = val; }
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: match[2] };
}

function serializeFrontmatter(meta: DecisionMeta): string {
  const lines = [
    `name: ${meta.slug}`,
    `title: "${meta.title}"`,
    meta.paths?.length ? `paths: ${JSON.stringify(meta.paths)}` : '',
    `status: ${meta.status}`,
    `date: ${meta.date}`,
    meta.tags?.length ? `tags: ${JSON.stringify(meta.tags)}` : '',
  ].filter(Boolean);
  return `---\n${lines.join('\n')}\n---\n`;
}

function renderDecision(meta: DecisionMeta, context: string, decision: string, consequences?: string): string {
  const fm = serializeFrontmatter(meta);
  const parts = [
    fm,
    `# ${meta.title}\n`,
    `## Context\n\n${context.trim()}\n`,
    `## Decision\n\n${decision.trim()}\n`,
    consequences ? `## Consequences\n\n${consequences.trim()}\n` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

export function writeDecision(projectRoot: string, input: {
  title: string;
  context: string;
  decision: string;
  consequences?: string;
  paths?: string[];
  tags?: string[];
  slug?: string;
}): Decision {
  const dir = decisionsDir(projectRoot);
  ensureDir(dir);

  const slug = input.slug || slugify(input.title) || createHash('sha1').update(input.title).digest('hex').slice(0, 8);
  const date = new Date().toISOString().slice(0, 10);
  const meta: DecisionMeta = {
    slug,
    title: input.title,
    paths: input.paths,
    status: 'accepted',
    date,
    tags: input.tags,
  };

  const content = renderDecision(meta, input.context, input.decision, input.consequences);
  const filePath = resolve(dir, `${slug}.md`);
  writeText(filePath, content);

  return { ...meta, context: input.context, decision: input.decision, consequences: input.consequences, filePath };
}

export function listDecisions(projectRoot: string): Decision[] {
  const dir = decisionsDir(projectRoot);
  if (!existsSync(dir)) return [];
  const results: Decision[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const filePath = resolve(dir, name);
    if (!statSync(filePath).isFile()) continue;
    try {
      const content = readText(filePath);
      const { meta, body } = parseFrontmatter(content);
      const slug = basename(name, '.md');
      // Extract sections from body
      const contextMatch = body.match(/## Context\n+([\s\S]*?)(?=\n## |\n$|$)/);
      const decisionMatch = body.match(/## Decision\n+([\s\S]*?)(?=\n## |\n$|$)/);
      const consequencesMatch = body.match(/## Consequences\n+([\s\S]*?)(?=\n## |\n$|$)/);
      results.push({
        slug,
        title: typeof meta.title === 'string' ? meta.title : slug,
        paths: Array.isArray(meta.paths) ? meta.paths : undefined,
        status: (typeof meta.status === 'string' ? meta.status : 'accepted') as DecisionMeta['status'],
        date: typeof meta.date === 'string' ? meta.date : '',
        tags: Array.isArray(meta.tags) ? meta.tags : undefined,
        context: contextMatch?.[1]?.trim() || '',
        decision: decisionMatch?.[1]?.trim() || '',
        consequences: consequencesMatch?.[1]?.trim(),
        filePath,
      });
    } catch {
      // skip unparseable files
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

export function getDecision(projectRoot: string, slug: string): Decision | null {
  const dir = decisionsDir(projectRoot);
  const filePath = resolve(dir, `${slug}.md`);
  if (!fileExists(filePath)) return null;
  try {
    const content = readText(filePath);
    const { meta, body } = parseFrontmatter(content);
    const contextMatch = body.match(/## Context\n+([\s\S]*?)(?=\n## |\n$|$)/);
    const decisionMatch = body.match(/## Decision\n+([\s\S]*?)(?=\n## |\n$|$)/);
    const consequencesMatch = body.match(/## Consequences\n+([\s\S]*?)(?=\n## |\n$|$)/);
    return {
      slug,
      title: typeof meta.title === 'string' ? meta.title : slug,
      paths: Array.isArray(meta.paths) ? meta.paths : undefined,
      status: (typeof meta.status === 'string' ? meta.status : 'accepted') as DecisionMeta['status'],
      date: typeof meta.date === 'string' ? meta.date : '',
      tags: Array.isArray(meta.tags) ? meta.tags : undefined,
      context: contextMatch?.[1]?.trim() || '',
      decision: decisionMatch?.[1]?.trim() || '',
      consequences: consequencesMatch?.[1]?.trim(),
      filePath,
    };
  } catch {
    return null;
  }
}
