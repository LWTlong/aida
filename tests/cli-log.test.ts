import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '../src/utils/fs.js';
import { createTestProject, runCli, type TestProject } from './helpers.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject();
});

afterEach(() => {
  project.cleanup();
});

// ─── log task ─────────────────────────────────────────────

describe('aidevos log task', () => {
  it('should create a task with TASK-01 ID', () => {
    const data = runCli(project, 'log task --title "Create API layer" --stage "Infrastructure" --prd-phase "PRD1"');
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].taskId, 'TASK-01');
    assert.equal(data.tasks[0].title, 'Create API layer');
    assert.equal(data.tasks[0].stageName, 'Infrastructure');
    assert.equal(data.tasks[0].prdPhase, 'PRD1');
    assert.equal(data.tasks[0].status, 'pending');
    assert.equal(data.summary.totalTasks, 1);
  });

  it('should auto-increment task IDs', () => {
    runCli(project, 'log task --title "Task 1" --stage "A"');
    const data = runCli(project, 'log task --title "Task 2" --stage "B"');
    assert.equal(data.tasks.length, 2);
    assert.equal(data.tasks[0].taskId, 'TASK-01');
    assert.equal(data.tasks[1].taskId, 'TASK-02');
    assert.equal(data.summary.totalTasks, 2);
  });
});

// ─── log task-start / task-done ───────────────────────────

describe('aidevos log task-start / task-done', () => {
  it('should set status to in-progress and record startedAt', () => {
    runCli(project, 'log task --title "Test task" --stage "A"');
    const data = runCli(project, 'log task-start --id TASK-01');
    assert.equal(data.tasks[0].status, 'in-progress');
    assert.ok(data.tasks[0].startedAt);
    assert.equal(data.context.currentTaskId, 'TASK-01');
  });

  it('should set status to done and record completedAt', () => {
    runCli(project, 'log task --title "Test task" --stage "A"');
    runCli(project, 'log task-start --id TASK-01');
    const data = runCli(project, 'log task-done --id TASK-01');
    assert.equal(data.tasks[0].status, 'done');
    assert.ok(data.tasks[0].completedAt);
    assert.equal(data.summary.completedTasks, 1);
  });

  it('should backfill startedAt if task-done called without task-start', () => {
    runCli(project, 'log task --title "Quick task" --stage "A"');
    const data = runCli(project, 'log task-done --id TASK-01');
    assert.ok(data.tasks[0].startedAt, 'startedAt should be backfilled');
  });
});

// ─── log bug / bug-fix ────────────────────────────────────

describe('aidevos log bug / bug-fix', () => {
  it('should create a bug with correct fields', () => {
    const data = runCli(project, 'log bug --title "Type mismatch" --severity high --source self-review --files "a.ts,b.ts"');
    assert.equal(data.bugs.length, 1);
    assert.equal(data.bugs[0].bugId, 'BUG-01');
    assert.equal(data.bugs[0].title, 'Type mismatch');
    assert.equal(data.bugs[0].severity, 'high');
    assert.equal(data.bugs[0].source, 'self-review');
    assert.deepEqual(data.bugs[0].files, ['a.ts', 'b.ts']);
    assert.equal(data.bugs[0].status, 'open');
    assert.equal(data.summary.bugCount, 1);
  });

  it('should mark bug as fixed', () => {
    runCli(project, 'log bug --title "Error" --severity medium');
    const data = runCli(project, 'log bug-fix --id BUG-01 --fix "Fixed the type"');
    assert.equal(data.bugs[0].status, 'fixed');
    assert.equal(data.bugs[0].fix, 'Fixed the type');
    assert.ok(data.bugs[0].fixedAt);
  });

  it('should validate severity enum', () => {
    const data = runCli(project, 'log bug --title "Bad" --severity extreme');
    // Should not create a bug with invalid severity
    assert.equal(data.bugs.length, 0);
  });

  it('should validate source enum', () => {
    const data = runCli(project, 'log bug --title "Bad" --source invalid-source');
    assert.equal(data.bugs.length, 0);
  });
});

// ─── log deviation ────────────────────────────────────────

describe('aidevos log deviation', () => {
  it('should create a deviation with correct fields', () => {
    const data = runCli(project,
      'log deviation --title "Wrong component" --root-cause rule-missing --category component-usage --ai-output "Used div" --expected "Use Drawer" --files "view.tsx"');
    assert.equal(data.deviations.length, 1);
    assert.equal(data.deviations[0].deviationId, 'DEV-01');
    assert.equal(data.deviations[0].title, 'Wrong component');
    assert.equal(data.deviations[0].rootCauseCategory, 'rule-missing');
    assert.equal(data.deviations[0].deviationCategory, 'component-usage');
    assert.equal(data.deviations[0].aiOutput, 'Used div');
    assert.equal(data.deviations[0].expectedOutput, 'Use Drawer');
    assert.deepEqual(data.deviations[0].files, ['view.tsx']);
    assert.equal(data.summary.deviationCount, 1);
  });

  it('should validate root-cause enum', () => {
    const data = runCli(project, 'log deviation --title "Bad" --root-cause bad-cause');
    assert.equal(data.deviations.length, 0);
  });

  it('should validate category enum', () => {
    const data = runCli(project, 'log deviation --title "Bad" --root-cause other --category bad-cat');
    assert.equal(data.deviations.length, 0);
  });
});

// ─── log review ───────────────────────────────────────────

describe('aidevos log review', () => {
  it('should create a pass review', () => {
    const data = runCli(project, 'log review --task-id TASK-01 --result pass --scope "src/api/"');
    assert.equal(data.reviews.length, 1);
    assert.equal(data.reviews[0].reviewId, 'REV-01');
    assert.equal(data.reviews[0].result, 'pass');
    assert.equal(data.reviews[0].taskId, 'TASK-01');
    assert.equal(data.reviews[0].scope, 'src/api/');
    assert.equal(data.summary.reviewCount, 1);
    assert.equal(data.summary.reviewPassCount, 1);
    assert.equal(data.summary.reviewFailCount, 0);
  });

  it('should create a fail review with issues list', () => {
    const data = runCli(project, 'log review --result fail --scope "src/" --issues "Missing i18n,Bad import path"');
    assert.equal(data.reviews[0].result, 'fail');
    assert.equal(data.reviews[0].issueCount, 2);
    assert.deepEqual(data.reviews[0].issues, ['Missing i18n', 'Bad import path']);
    assert.equal(data.summary.reviewFailCount, 1);
  });

  it('should track pass/fail counts across multiple reviews', () => {
    runCli(project, 'log review --result pass --scope "a"');
    runCli(project, 'log review --result fail --scope "b"');
    const data = runCli(project, 'log review --result pass --scope "c"');
    assert.equal(data.summary.reviewCount, 3);
    assert.equal(data.summary.reviewPassCount, 2);
    assert.equal(data.summary.reviewFailCount, 1);
  });
});

// ─── log rule ─────────────────────────────────────────────

describe('aidevos log rule', () => {
  it('should create a rule in run.json and registry', () => {
    const data = runCli(project, 'log rule --content "Use Drawer for detail views" --category component --source-deviation DEV-01');
    assert.equal(data.rules.length, 1);
    assert.equal(data.rules[0].ruleId, 'RULE-001');
    assert.ok(data.rules[0].content.includes('Use Drawer'));
    assert.equal(data.rules[0].sourceDeviation, 'DEV-01');
    assert.ok(data.rules[0].sedimentedAt); // Not pending, so has timestamp
    assert.equal(data.summary.rulesSedimented, 1);

    // Check registry file also exists
    const registry = readJson<any[]>(project.root + '/.aida/rules.json');
    assert.equal(registry.length, 1);
    assert.equal(registry[0].category, 'component');
  });

  it('should create a pending rule', () => {
    const data = runCli(project, 'log rule --content "Pending rule" --category api --status pending');
    assert.equal(data.rules[0].status, 'pending');
    assert.equal(data.rules[0].sedimentedAt, null);
    assert.equal(data.summary.rulesSedimented, 0); // Pending doesn't count
  });

  it('should validate category enum', () => {
    const data = runCli(project, 'log rule --content "Bad category" --category invalid-cat');
    assert.equal(data.rules.length, 0);
  });

  it('should use 3-digit padding for rule IDs', () => {
    runCli(project, 'log rule --content "Rule 1" --category general');
    const data = runCli(project, 'log rule --content "Rule 2" --category general');
    assert.equal(data.rules[0].ruleId, 'RULE-001');
    assert.equal(data.rules[1].ruleId, 'RULE-002');
  });
});

// ─── log file ─────────────────────────────────────────────

describe('aidevos log file', () => {
  it('should record a file change', () => {
    const data = runCli(project, 'log file --path "src/api/user.ts" --change-type created --lines-added 50');
    assert.equal(data.files.length, 1);
    assert.equal(data.files[0].path, 'src/api/user.ts');
    assert.equal(data.files[0].changeType, 'created');
    assert.equal(data.files[0].linesAdded, 50);
    assert.equal(data.files[0].changeCount, 1);
    assert.equal(data.summary.filesChanged, 1);
    assert.equal(data.summary.linesAdded, 50);
  });

  it('should increment changeCount on duplicate file path', () => {
    runCli(project, 'log file --path "src/a.ts" --change-type modified --lines-added 10');
    const data = runCli(project, 'log file --path "src/a.ts" --change-type modified --lines-added 5 --lines-removed 2');
    assert.equal(data.files.length, 1); // Same file, not duplicated
    assert.equal(data.files[0].changeCount, 2);
    assert.equal(data.files[0].linesAdded, 15); // 10 + 5
    assert.equal(data.files[0].linesRemoved, 2);
    assert.equal(data.summary.filesChanged, 1);
    assert.equal(data.summary.linesAdded, 15);
  });

  it('should validate change-type enum', () => {
    const data = runCli(project, 'log file --path "a.ts" --change-type renamed');
    assert.equal(data.files.length, 0);
  });
});

// ─── log cost ─────────────────────────────────────────────

describe('aidevos log cost', () => {
  it('should record token cost', () => {
    const data = runCli(project, 'log cost --tokens 100000 --stage "requirement-analysis"');
    assert.equal(data.cost.totalTokens, 100000);
    assert.equal(data.cost.tokenBreakdown.length, 1);
    assert.equal(data.cost.tokenBreakdown[0].stage, 'requirement-analysis');
    assert.equal(data.cost.tokenBreakdown[0].tokens, 100000);
  });

  it('should accumulate tokens for same stage', () => {
    runCli(project, 'log cost --tokens 50000 --stage "code-gen"');
    const data = runCli(project, 'log cost --tokens 30000 --stage "code-gen"');
    assert.equal(data.cost.totalTokens, 80000);
    assert.equal(data.cost.tokenBreakdown.length, 1);
    assert.equal(data.cost.tokenBreakdown[0].tokens, 80000);
  });

  it('should record estimated hours', () => {
    const data = runCli(project, 'log cost --estimated-hours 40 --actual-hours 18');
    assert.equal(data.cost.estimatedManualHours, 40);
    assert.equal(data.cost.actualHours, 18);
  });
});

// ─── log highlight ────────────────────────────────────────

describe('aidevos log highlight', () => {
  it('should record a highlight', () => {
    const data = runCli(project, 'log highlight --content "FCP reduced from 3.2s to 0.8s" --source auto');
    assert.equal(data.highlights.length, 1);
    assert.equal(data.highlights[0].content, 'FCP reduced from 3.2s to 0.8s');
    assert.equal(data.highlights[0].source, 'auto');
    assert.ok(data.highlights[0].createdAt);
  });
});

// ─── metrics calculation ──────────────────────────────────

describe('metrics recalculation', () => {
  it('should compute aiDeviationRate and bugRate', () => {
    runCli(project, 'log task --title "T1" --stage "A"');
    runCli(project, 'log task --title "T2" --stage "A"');
    runCli(project, 'log deviation --title "D1" --root-cause other --category other');
    const data = runCli(project, 'log bug --title "B1" --severity low');

    // 2 tasks, 1 deviation, 1 bug
    assert.equal(data.metrics.aiDeviationRate, 50); // 1/2 * 100
    assert.equal(data.metrics.bugRate, 50);
  });

  it('should compute reviewPassRate', () => {
    runCli(project, 'log review --result pass --scope "a"');
    runCli(project, 'log review --result pass --scope "b"');
    const data = runCli(project, 'log review --result fail --scope "c"');

    // 2 pass out of 3 = 66.67%
    assert.equal(data.metrics.reviewPassRate, 66.67);
  });
});

// ─── timeline and events ──────────────────────────────────

describe('timeline and events', () => {
  it('should append timeline entries for each action', () => {
    runCli(project, 'log task --title "T1" --stage "A"');
    runCli(project, 'log bug --title "B1" --severity low');
    const data = runCli(project, 'log review --result pass --scope "x"');

    assert.ok(data.timeline.length >= 3);
    assert.ok(data.events.length >= 3);

    // Check timeline types
    const types = data.timeline.map((t: any) => t.type);
    assert.ok(types.includes('task'));
    assert.ok(types.includes('bug'));
    assert.ok(types.includes('review'));
  });
});

// ─── requirement.json sync ────────────────────────────────

describe('requirement.json sync', () => {
  it('should update requirement.json totals when run.json changes', () => {
    runCli(project, 'log task --title "T1" --stage "A"');
    runCli(project, 'log task-done --id TASK-01');
    runCli(project, 'log bug --title "B1" --severity low');

    const reqPath = project.root + '/.aida/runs/' + project.branch + '/requirement.json';
    const req = readJson<any>(reqPath);

    assert.equal(req.developers.length, 1);
    assert.equal(req.developers[0].name, project.dev);
    assert.equal(req.totals.tasks, 1);
    assert.equal(req.totals.completedTasks, 1);
    assert.equal(req.totals.bugs, 1);
  });
});
