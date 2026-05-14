import { buildProjectArtifacts, readConfiguredTools } from '../utils/ai-build.js';
import { buildMemoryViews, loadMemoryIndex } from '../utils/memory.js';
import { loadSummary } from '../internal/runtime/summary.js';

export function buildProject(projectRoot: string, targets?: string[]) {
  const configured = readConfiguredTools(projectRoot);
  if (configured.length === 0) {
    return {
      configured,
      targets: [],
      result: null,
    };
  }

  const effectiveTargets = targets && targets.length > 0 ? targets : configured;
  return {
    configured,
    targets: effectiveTargets,
    result: buildProjectArtifacts(projectRoot, effectiveTargets),
  };
}

export function syncProject(projectRoot: string, targets?: string[]) {
  const views = buildMemoryViews(projectRoot);
  const memoryIndex = loadMemoryIndex(projectRoot);
  const summary = loadSummary(projectRoot);
  const build = buildProject(projectRoot, targets);

  return {
    views,
    memoryIndex,
    summary,
    build,
  };
}
