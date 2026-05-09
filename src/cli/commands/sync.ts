import { green, red, yellow } from '../../utils/display.js';
import { buildProjectArtifacts, readConfiguredTools } from '../../utils/ai-build.js';
import { buildMemoryViews, loadMemoryIndex } from '../../utils/memory.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { loadSummary } from '../../utils/summary.js';

function requestedTools(): string[] {
  return process.argv.slice(3).map((item) => item.trim()).filter(Boolean);
}

export async function sync(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const views = buildMemoryViews(projectRoot);
  const memoryIndex = loadMemoryIndex(projectRoot);
  const summary = loadSummary(projectRoot);

  const configured = readConfiguredTools(projectRoot);
  let buildResult: ReturnType<typeof buildProjectArtifacts> | null = null;
  if (configured.length > 0) {
    const targets = requestedTools();
    buildResult = buildProjectArtifacts(projectRoot, targets.length > 0 ? targets : configured);
  }

  console.log(green('\n  ✓ AIDA sync completed'));
  console.log(`    Memories: ${memoryIndex.items.length} modules`);
  console.log(`    Memory views: ${views.moduleViews} modules`);
  console.log(`    Summary: ${summary.length} entries`);
  if (buildResult) {
    console.log(`    Tool build: ${buildResult.tools.join(', ') || '-'} (${buildResult.ruleFiles} rule files, ${buildResult.skillFiles} skill files)`);
  } else {
    console.log(yellow('    Tool build: skipped (no configured AI tools)'));
  }
  console.log('');
}
