import { green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { syncProject } from '../../services/project-build.js';

function requestedTools(): string[] {
  return process.argv.slice(3).map((item) => item.trim()).filter(Boolean);
}

export async function sync(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const result = syncProject(projectRoot, requestedTools());
  const buildResult = result.build.result;

  console.log(green('\n  ✓ AIDA sync completed'));
  console.log(`    Memories: ${result.memoryIndex.items.length} modules`);
  console.log(`    Memory views: ${result.views.moduleViews} modules`);
  console.log(`    Summary: ${result.summary.length} entries`);
  if (buildResult) {
    console.log(`    Tool build: ${buildResult.tools.join(', ') || '-'} (${buildResult.ruleFiles} rule files, ${buildResult.skillFiles} skill files)`);
  } else {
    console.log(yellow('    Tool build: skipped (no configured AI tools)'));
  }
  console.log('');
}
