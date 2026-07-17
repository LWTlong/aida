import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { readText, writeText } from '../../utils/fs.js';
import { bold, dim, green, yellow } from '../../utils/display.js';

function claudeToCursor(content: string): string {
  return content.replace(/^(---\n[\s\S]*?)^paths:/m, '$1globs:');
}

function cursorToClaude(content: string): string {
  return content.replace(/^(---\n[\s\S]*?)^globs:/m, '$1paths:');
}

function copyRulesDir(
  srcDir: string,
  destDir: string,
  fromExt: string,
  toExt: string,
  transform: (content: string) => string,
): number {
  if (!existsSync(srcDir)) return 0;
  mkdirSync(destDir, { recursive: true });
  let copied = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copied += copyRulesDir(
        resolve(srcDir, entry.name),
        resolve(destDir, entry.name),
        fromExt, toExt, transform,
      );
    } else if (entry.isFile() && extname(entry.name) === fromExt) {
      const destName = basename(entry.name, fromExt) + toExt;
      writeText(resolve(destDir, destName), transform(readText(resolve(srcDir, entry.name))));
      copied++;
    }
  }
  return copied;
}

export function copyAssets(direction: 'to' | 'from', tool: string): void {
  if (tool !== 'cursor') {
    console.error(`  Unsupported tool: "${tool}". Currently supported: cursor`);
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const claudeDir = resolve(projectRoot, '.claude', 'rules');
  const cursorDir = resolve(projectRoot, '.cursor', 'rules');

  const [srcDir, destDir, fromExt, toExt, transform, arrow] = direction === 'to'
    ? [claudeDir, cursorDir, '.md', '.mdc', claudeToCursor, '.claude/rules → .cursor/rules'] as const
    : [cursorDir, claudeDir, '.mdc', '.md', cursorToClaude, '.cursor/rules → .claude/rules'] as const;

  const count = copyRulesDir(srcDir, destDir, fromExt, toExt, transform);
  console.log(`\n  ${green('✓')} Copied ${bold(String(count))} files  ${dim(arrow)}\n`);
  if (count === 0) {
    console.log(`  ${yellow('!')} No ${fromExt} files found in ${srcDir}\n`);
  }
}
