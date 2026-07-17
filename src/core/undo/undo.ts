import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDir, fileExists, writeText } from '../../utils/fs.js';
import { aidaCacheDir } from '../assets/paths.js';

const JOURNAL_MAX_ENTRIES = 50;

type UndoAction =
  | { kind: 'write-file'; path: string; previousContent: string | null }
  | { kind: 'delete-file'; path: string; content: string };

export interface UndoEntry {
  id: string;
  tool: string;
  description: string;
  createdAt: string;
  actions: UndoAction[];
}

function journalPath(projectRoot: string): string {
  return resolve(aidaCacheDir(projectRoot), 'undo-journal.jsonl');
}

function readJournal(projectRoot: string): UndoEntry[] {
  const path = journalPath(projectRoot);
  if (!fileExists(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UndoEntry);
  } catch {
    return [];
  }
}

function writeJournal(projectRoot: string, entries: UndoEntry[]): void {
  ensureDir(aidaCacheDir(projectRoot));
  writeText(journalPath(projectRoot), entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''));
}

export function appendUndoEntry(projectRoot: string, entry: UndoEntry): void {
  const entries = readJournal(projectRoot);
  entries.push(entry);
  writeJournal(projectRoot, entries.slice(-JOURNAL_MAX_ENTRIES));
}

export function snapshotFileForUndo(projectRoot: string, absPath: string): string | null {
  if (!existsSync(absPath)) return null;
  try { return readFileSync(absPath, 'utf-8'); } catch { return null; }
}

export function listUndoEntries(projectRoot: string): UndoEntry[] {
  return readJournal(projectRoot).slice().reverse();
}

export function applyUndo(projectRoot: string, id?: string): { success: boolean; message: string; entry?: UndoEntry } {
  const entries = readJournal(projectRoot);
  if (!entries.length) return { success: false, message: 'undo journal is empty' };

  const entry = id
    ? entries.find((e) => e.id === id)
    : entries[entries.length - 1];

  if (!entry) return { success: false, message: id ? `entry not found: ${id}` : 'no entries' };

  for (const action of [...entry.actions].reverse()) {
    if (action.kind === 'write-file') {
      if (action.previousContent === null) {
        // File didn't exist before — delete it
        if (existsSync(action.path)) unlinkSync(action.path);
      } else {
        writeText(action.path, action.previousContent);
      }
    } else if (action.kind === 'delete-file') {
      writeText(action.path, action.content);
    }
  }

  writeJournal(projectRoot, entries.filter((e) => e.id !== entry.id));
  return { success: true, message: `undone: ${entry.description}`, entry };
}
