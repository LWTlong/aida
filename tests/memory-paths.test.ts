import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  memoryIndexPath,
  moduleMemoryPath,
  moduleMemoryViewPath,
  runContextPath,
  runContextViewPath,
  runMemoryPackViewPath,
} from '../src/utils/paths.js';
import { normalizeModuleKey } from '../src/utils/memory.js';

describe('memory path helpers', () => {
  it('should normalize module keys for stable storage', () => {
    assert.equal(normalizeModuleKey(' Personal Center '), 'personal-center');
    assert.equal(normalizeModuleKey('order/detail'), 'order/detail');
  });

  it('should build memory and context paths under .aida', () => {
    const root = '/tmp/example-project';

    assert.equal(memoryIndexPath(root), '/tmp/example-project/.aida/memories/index.json');
    assert.equal(moduleMemoryPath(root, 'profile'), '/tmp/example-project/.aida/memories/modules/profile.json');
    assert.equal(moduleMemoryViewPath(root, 'profile'), '/tmp/example-project/.aida/memories/modules/profile.md');
    assert.equal(runContextPath(root, 'feature/profile'), '/tmp/example-project/.aida/runs/feature-profile/context.json');
    assert.equal(runContextViewPath(root, 'feature/profile'), '/tmp/example-project/.aida/runs/feature-profile/context.md');
    assert.equal(runMemoryPackViewPath(root, 'feature/profile'), '/tmp/example-project/.aida/runs/feature-profile/memory.md');
  });
});
