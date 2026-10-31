import { describe, expect, it } from 'vitest';
import {
  cleanup,
  logLines,
  mergeResults,
  parseMergedPullRequests,
  parseScriptResult,
  parseWorktrees,
  selectCandidates,
  summaryBody,
  summaryTitle,
} from '../lib/cleanup.ts';
import type { Result, Run } from '../lib/run.ts';

describe('parseMergedPullRequests', () => {
  it('keeps number and head branch', () => {
    const json = '[{"number":30,"headRefName":"feat/7-x"},{"number":"31"},{"number":32,"headRefName":""}]';
    expect(parseMergedPullRequests(json)).toEqual([{ number: 30, headRefName: 'feat/7-x' }]);
  });

  it('rejects invalid JSON and non-lists', () => {
    expect(() => parseMergedPullRequests('nope')).toThrow('invalid JSON');
    expect(() => parseMergedPullRequests('{}')).toThrow('expected a list');
  });
});

describe('parseWorktrees', () => {
  it('reads path, HEAD and branch, detached without branch', () => {
    const porcelain = [
      'worktree /repo',
      'HEAD aaa',
      'branch refs/heads/main',
      '',
      'worktree /wt/one',
      'HEAD bbb',
      'detached',
      '',
    ].join('\n');
    expect(parseWorktrees(porcelain)).toEqual([
      { path: '/repo', head: 'aaa', branch: 'main' },
      { path: '/wt/one', head: 'bbb', branch: null },
    ]);
  });

  it('returns an empty list for empty output', () => {
    expect(parseWorktrees('')).toEqual([]);
  });
});

describe('selectCandidates', () => {
  const prs = [
    { number: 31, headRefName: 'fix/12-y' },
    { number: 30, headRefName: 'feat/7-x' },
    { number: 33, headRefName: 'feat/13-gone' },
    { number: 34, headRefName: 'dependabot/npm/x' },
  ];

  it('selects PRs with a local head branch, a worktree on it or a wip-<nr> branch, oldest first', () => {
    const worktrees = [{ path: '/wt', head: 'c', branch: 'wip-12' }];
    expect(selectCandidates(prs, ['main', 'feat/7-x'], worktrees)).toEqual([
      { pr: 30, issue: 7, branch: 'feat/7-x' },
      { pr: 31, issue: 12, branch: 'fix/12-y' },
    ]);
  });

  it('skips head branches without an issue number', () => {
    expect(selectCandidates(prs, ['dependabot/npm/x'], [])).toEqual([]);
  });

  it('returns nothing without PRs', () => {
    expect(selectCandidates([], ['feat/7-x'], [])).toEqual([]);
  });
});

describe('parseScriptResult', () => {
  it('reads the printed object', () => {
    const json = JSON.stringify({
      removed: ['/wt/a'],
      branchesDeleted: ['feat/7-x', 'worktree-a'],
      left: [{ branch: 'worktree-b', reason: 'commits not on any remote branch', command: 'git branch -D worktree-b' }],
    });
    expect(parseScriptResult(json)).toEqual({
      removed: ['/wt/a'],
      branchesDeleted: ['feat/7-x', 'worktree-a'],
      left: [{ branch: 'worktree-b', reason: 'commits not on any remote branch', command: 'git branch -D worktree-b' }],
    });
  });

  it('accepts single values and missing lists', () => {
    const json = '{"removed":"/wt/a","left":{"path":"/wt/b","reason":"uncommitted changes","command":"c"}}';
    expect(parseScriptResult(json)).toEqual({
      removed: ['/wt/a'],
      branchesDeleted: [],
      left: [{ path: '/wt/b', reason: 'uncommitted changes', command: 'c' }],
    });
  });

  it('rejects output that is not a JSON object', () => {
    expect(() => parseScriptResult('')).toThrow('printed no JSON');
    expect(() => parseScriptResult('[]')).toThrow('printed no JSON object');
  });
});

describe('mergeResults', () => {
  it('joins the runs without duplicates and drops left entries a later run removed', () => {
    const first = {
      removed: ['/wt/a'],
      branchesDeleted: ['worktree-x'],
      left: [{ branch: 'wip-7', reason: 'checked out in a worktree', command: 'git branch -D wip-7' }],
    };
    const second = { removed: ['/wt/b'], branchesDeleted: ['worktree-x', 'wip-7'], left: [] };
    expect(mergeResults([first, second])).toEqual({
      removed: ['/wt/a', '/wt/b'],
      branchesDeleted: ['worktree-x', 'wip-7'],
      left: [],
    });
  });

  it('returns an empty result for no runs', () => {
    expect(mergeResults([])).toEqual({ removed: [], branchesDeleted: [], left: [] });
  });
});

describe('summary', () => {
  const result = {
    removed: ['/wt/a'],
    branchesDeleted: ['feat/7-x', 'worktree-a'],
    left: [{ path: '/wt/b', reason: 'uncommitted changes', command: 'git worktree remove --force /wt/b' }],
  };

  it('titles the notification `<n> removed, <m> left`', () => {
    expect(summaryTitle(result)).toBe('3 removed, 1 left');
    expect(summaryTitle({ removed: [], branchesDeleted: [], left: [] })).toBe('0 removed, 0 left');
    expect(summaryTitle(result, [{ pr: 9, reason: 'gh pr view 9 failed' }])).toBe('3 removed, 1 left, 1 failed');
  });

  it('names what was removed and points to the plugin log when something was left', () => {
    expect(summaryBody(result)).toBe(
      'worktrees: /wt/a; branches: feat/7-x, worktree-a; details: herdr plugin log list --plugin worktree-cleanup',
    );
    expect(summaryBody({ removed: [], branchesDeleted: [], left: [] })).toBe('nothing to clean up');
  });

  it('logs every left entry with its command', () => {
    expect(logLines(result, [{ pr: 9, reason: 'gh pr view 9 failed' }])).toEqual([
      'removed worktree /wt/a',
      'deleted branch feat/7-x',
      'deleted branch worktree-a',
      'left /wt/b: uncommitted changes -> git worktree remove --force /wt/b',
      'failed PR #9: gh pr view 9 failed',
    ]);
  });
});

describe('cleanup', () => {
  const ok = (stdout: string): Result => ({ ok: true, stdout });
  const fail = (code: string | number, stderr = ''): Result => ({ ok: false, code, stdout: '', stderr });
  const fake =
    (answers: { gh?: Result; pwsh?: Result[] }): Run =>
    async (command, args) => {
      if (command === 'gh') return answers.gh ?? ok('[]');
      if (command === 'pwsh') return answers.pwsh?.shift() ?? ok('{}');
      if (args[0] === 'for-each-ref') return ok('main\nfeat/7-x\nfix/8-y\n');
      return ok('worktree /repo\nHEAD a\nbranch refs/heads/main\n');
    };
  const prs = ok('[{"number":30,"headRefName":"feat/7-x"},{"number":31,"headRefName":"fix/8-y"}]');

  it('says gh is missing or failing', async () => {
    await expect(cleanup(fake({ gh: fail('ENOENT') }), '/repo', 's.ps1')).rejects.toThrow('gh is not installed');
    await expect(cleanup(fake({ gh: fail(1, '\nHTTP 401\n') }), '/repo', 's.ps1')).rejects.toThrow(
      'gh failed: HTTP 401',
    );
  });

  it('says pwsh is missing', async () => {
    await expect(cleanup(fake({ gh: prs, pwsh: [fail('ENOENT')] }), '/repo', 's.ps1')).rejects.toThrow(
      'pwsh is not installed',
    );
  });

  it('records a failed script run and goes on with the next PR', async () => {
    const pwsh = [fail(1, 'gh pr view 30 failed'), ok('{"removed":["/wt/b"],"branchesDeleted":["fix/8-y"],"left":[]}')];
    const report = await cleanup(fake({ gh: prs, pwsh }), '/repo', 's.ps1');
    expect(report.failed).toEqual([{ pr: 30, reason: 'gh pr view 30 failed' }]);
    expect(report.removed).toEqual(['/wt/b']);
    expect(report.branchesDeleted).toEqual(['fix/8-y']);
  });

  it('records a script run that printed no JSON', async () => {
    const report = await cleanup(fake({ gh: prs, pwsh: [ok('oops'), ok('{}')] }), '/repo', 's.ps1');
    expect(report.failed).toEqual([{ pr: 30, reason: 'Remove-PbiWorktrees.ps1 printed no JSON' }]);
  });
});
