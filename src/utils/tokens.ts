/**
 * Token usage collection from AI tool session files.
 *
 * Currently supports: Claude Code
 * Data source: ~/.claude/projects/{project-hash}/{session}.jsonl
 */

import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

/**
 * Convert a project root path to Claude Code's project directory name.
 * /Users/foo/my-project → -Users-foo-my-project
 */
function projectPathToClaudeDir(projectRoot: string): string {
  return projectRoot.replace(/\//g, '-');
}

/**
 * Find the Claude Code project session directory.
 */
function getClaudeProjectDir(projectRoot: string): string | null {
  const claudeDir = resolve(homedir(), '.claude', 'projects');
  if (!existsSync(claudeDir)) return null;

  const dirName = projectPathToClaudeDir(projectRoot);
  const fullPath = resolve(claudeDir, dirName);
  if (!existsSync(fullPath)) return null;

  return fullPath;
}

/**
 * Find the most recently modified .jsonl session file in a Claude project dir.
 */
function findLatestSessionFile(projectDir: string): string | null {
  const files = readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: resolve(projectDir, f),
      mtime: statSync(resolve(projectDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

/**
 * Parse token usage from a Claude Code session .jsonl file.
 *
 * @param sessionFile - Path to the .jsonl file
 * @param sinceTimestamp - Only count messages after this ISO timestamp (optional)
 * @returns Accumulated token usage
 */
function parseSessionTokens(sessionFile: string, sinceTimestamp?: string): TokenUsage {
  const usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
  };

  const sinceMs = sinceTimestamp ? new Date(sinceTimestamp).getTime() : 0;

  // Read file in chunks from the end if we have a timestamp filter
  // For simplicity, read the whole file (session files are typically < 50MB)
  let content: string;
  try {
    content = readFileSync(sessionFile, 'utf-8');
  } catch {
    return usage;
  }

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Only process assistant messages (they contain usage data)
    if (entry.type !== 'assistant') continue;

    // Filter by timestamp if specified
    if (sinceMs > 0 && entry.timestamp) {
      const msgMs = new Date(entry.timestamp).getTime();
      if (msgMs < sinceMs) continue;
    }

    const msgUsage = entry.message?.usage;
    if (!msgUsage) continue;

    usage.inputTokens += msgUsage.input_tokens || 0;
    usage.outputTokens += msgUsage.output_tokens || 0;
    usage.cacheCreationTokens += msgUsage.cache_creation_input_tokens || 0;
    usage.cacheReadTokens += msgUsage.cache_read_input_tokens || 0;
  }

  usage.totalTokens = usage.inputTokens + usage.outputTokens
    + usage.cacheCreationTokens + usage.cacheReadTokens;

  return usage;
}

/**
 * Collect token usage from Claude Code for the current project.
 *
 * @param projectRoot - Project root directory
 * @param sinceTimestamp - Only count tokens after this ISO timestamp
 * @returns Token usage, or null if Claude Code data not found
 */
export function collectClaudeTokens(
  projectRoot: string,
  sinceTimestamp?: string,
): TokenUsage | null {
  const projectDir = getClaudeProjectDir(projectRoot);
  if (!projectDir) return null;

  const sessionFile = findLatestSessionFile(projectDir);
  if (!sessionFile) return null;

  return parseSessionTokens(sessionFile, sinceTimestamp);
}

/**
 * Collect token usage between two timestamps (for a specific task).
 */
export function collectClaudeTokensBetween(
  projectRoot: string,
  startTime: string,
  endTime: string,
): TokenUsage | null {
  const projectDir = getClaudeProjectDir(projectRoot);
  if (!projectDir) return null;

  const sessionFile = findLatestSessionFile(projectDir);
  if (!sessionFile) return null;

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  const usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
  };

  let content: string;
  try {
    content = readFileSync(sessionFile, 'utf-8');
  } catch {
    return null;
  }

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'assistant') continue;
    if (!entry.timestamp) continue;

    const msgMs = new Date(entry.timestamp).getTime();
    if (msgMs < startMs || msgMs > endMs) continue;

    const msgUsage = entry.message?.usage;
    if (!msgUsage) continue;

    usage.inputTokens += msgUsage.input_tokens || 0;
    usage.outputTokens += msgUsage.output_tokens || 0;
    usage.cacheCreationTokens += msgUsage.cache_creation_input_tokens || 0;
    usage.cacheReadTokens += msgUsage.cache_read_input_tokens || 0;
  }

  usage.totalTokens = usage.inputTokens + usage.outputTokens
    + usage.cacheCreationTokens + usage.cacheReadTokens;

  return usage;
}
