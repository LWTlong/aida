import { readdirSync, renameSync, statSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { cyan, green, red, yellow } from '../../utils/display.js';
import { fileExists, readText, writeText } from '../../utils/fs.js';

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.html',
  '.css',
  '.txt',
  '.toml',
  '.yml',
  '.yaml',
]);

function replaceInFile(filePath: string): boolean {
  const ext = extname(filePath);
  const name = basename(filePath);
  if (!TEXT_EXTENSIONS.has(ext) && !['.gitignore', 'AGENTS.md', 'CLAUDE.md'].includes(name)) {
    return false;
  }

  const raw = readText(filePath);
  const next = raw.replace(/\.aidevos/g, '.aida').replace(/aidevos-/g, 'aida-');
  if (next === raw) return false;
  writeText(filePath, next);
  return true;
}

function walkAndReplace(rootDir: string): number {
  if (!fileExists(rootDir)) return 0;

  let updated = 0;
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
      if (replaceInFile(fullPath)) updated++;
    }
  }

  return updated;
}

export async function migrateDir(): Promise<void> {
  const projectRoot = process.cwd();
  const oldDir = resolve(projectRoot, '.aidevos');
  const newDir = resolve(projectRoot, '.aida');

  if (!fileExists(oldDir)) {
    if (fileExists(newDir)) {
      console.log(green('\n  ✓ Project already uses .aida.\n'));
      return;
    }
    console.log(yellow('\n  No .aidevos directory found.\n'));
    return;
  }

  if (fileExists(newDir)) {
    console.log(red('\n  Cannot migrate: both .aidevos and .aida exist.\n'));
    console.log('  Resolve the duplicate directories first, then run `aida migrate-dir` again.\n');
    return;
  }

  console.log(cyan('\n  Migrating project directory: .aidevos -> .aida\n'));
  renameSync(oldDir, newDir);

  let updatedFiles = 0;
  updatedFiles += walkAndReplace(newDir);

  for (const topLevel of ['AGENTS.md', 'CLAUDE.md', '.gitignore']) {
    const target = resolve(projectRoot, topLevel);
    if (fileExists(target) && replaceInFile(target)) {
      updatedFiles++;
    }
  }

  console.log(green('  ✓ Directory renamed') + ': .aida');
  console.log(green('  ✓ Updated references') + `: ${updatedFiles} text file(s)`);
  console.log('\n  Next step: run `aida build` to regenerate local AI tool artifacts.\n');
}
