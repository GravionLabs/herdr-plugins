import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, deleteOrphanedBranch } from '../lib/cleanup.ts';
import { run, type Run } from '../lib/run.ts';
import { findDeliverSkill } from '../lib/skill.ts';
import { createFixture, type Fixture } from './fixture.ts';

let fx: Fixture;
beforeEach(() => {
  fx = createFixture();
});
afterEach(() => fx.dispose());

const localBranches = (): string[] =>
  fx.git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean);
const worktreePaths = (): string[] =>
  fx
    .git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));

// A worktree on `branch` (new, from main) with one commit, optionally pushed, then removed again.
function removedWorktree(branch: string, pushed: boolean): void {
  const path = join(fx.root, branch.replace(/\//g, '-'));
  fx.git('worktree', 'add', '--quiet', '-b', branch, path, 'main');
  fx.commit(`${branch.replace(/\//g, '-')}.txt`, path);
  if (pushed) fx.git('push', '--quiet', 'origin', branch);
  fx.git('worktree', 'remove', path);
}

describe('deleteOrphanedBranch (worktree.removed)', () => {
  it('deletes the branch of a removed worktree whose commits are all on a remote branch', async () => {
    removedWorktree('feat/7-pushed', true);
    expect(await deleteOrphanedBranch(run, fx.repo, 'feat/7-pushed')).toEqual({
      removed: [],
      branchesDeleted: ['feat/7-pushed'],
      left: [],
    });
    expect(localBranches()).not.toContain('feat/7-pushed');
  });

  it('deletes a branch that is not merged into HEAD but pushed (falls back to -D)', async () => {
    removedWorktree('worktree-agent-1', true);
    const result = await deleteOrphanedBranch(run, fx.repo, 'worktree-agent-1');
    expect(result?.branchesDeleted).toEqual(['worktree-agent-1']);
    expect(localBranches()).toEqual(['main']);
  });

  it('keeps a branch with local-only commits and lists it in left with its command', async () => {
    removedWorktree('worktree-agent-2', false);
    expect(await deleteOrphanedBranch(run, fx.repo, 'worktree-agent-2')).toEqual({
      removed: [],
      branchesDeleted: [],
      left: [
        {
          branch: 'worktree-agent-2',
          reason: 'commits not on any remote branch',
          command: 'git branch -D worktree-agent-2',
        },
      ],
    });
    expect(localBranches()).toContain('worktree-agent-2');
  });

  it('does nothing when the branch is still checked out in another worktree', async () => {
    const path = join(fx.root, 'other');
    fx.git('worktree', 'add', '--quiet', '-b', 'feat/8-other', path, 'main');
    fx.git('push', '--quiet', 'origin', 'feat/8-other');
    expect(await deleteOrphanedBranch(run, fx.repo, 'feat/8-other')).toBeNull();
    expect(localBranches()).toContain('feat/8-other');
  });

  it('does nothing when the branch is already gone', async () => {
    expect(await deleteOrphanedBranch(run, fx.repo, 'feat/9-gone')).toBeNull();
  });

  it.each(['main', 'release/next'])('never deletes the protected branch %s', async (branch) => {
    fx.git('branch', '--quiet', 'release/next', 'origin/release/next');
    fx.git('checkout', '--quiet', '--detach');
    expect(await deleteOrphanedBranch(run, fx.repo, branch)).toBeNull();
    expect(localBranches()).toContain(branch);
  });

  it('deletes a pushed branch with ; & $() and quotes in its name as exactly that branch', async () => {
    const branch = "feat/9-a;touch${IFS}pwned&$(id)'x`id`";
    removedWorktree(branch, true);
    expect((await deleteOrphanedBranch(run, fx.repo, branch))?.branchesDeleted).toEqual([branch]);
    expect(localBranches()).toEqual(['main']);
    expect(existsSync(join(fx.repo, 'pwned'))).toBe(false);
  });

  it('deletes a branch named like an option (-D) and nothing else', async () => {
    fx.git('branch', '--quiet', 'feat/10-keep');
    fx.git('update-ref', 'refs/heads/-D', 'HEAD');
    fx.git('push', '--quiet', 'origin', 'refs/heads/-D:refs/heads/-D');
    expect((await deleteOrphanedBranch(run, fx.repo, '-D'))?.branchesDeleted).toEqual(['-D']);
    expect(localBranches()).toEqual(['feat/10-keep', 'main']);
  });

  it('lists a local-only hostile branch with a copy-paste command that deletes only it', async () => {
    const branch = "feat/11-x;touch${IFS}pwned&'q'";
    removedWorktree(branch, false);
    const left = (await deleteOrphanedBranch(run, fx.repo, branch))?.left;
    expect(left).toEqual([
      { branch, reason: 'commits not on any remote branch', command: `git branch -D 'feat/11-x;touch\${IFS}pwned&'\\''q'\\'''` },
    ]);
    // the plugins run on macOS and Linux only; the Windows CI runner has no POSIX sh on every image
    if (process.platform === 'win32') return;
    execFileSync('sh', ['-c', left?.[0]?.command ?? 'false'], { cwd: fx.repo, stdio: 'ignore' });
    expect(localBranches()).toEqual(['main']);
    expect(existsSync(join(fx.repo, 'pwned'))).toBe(false);
  });

  it('never deletes the default branch of origin', async () => {
    fx.git('branch', '--quiet', 'trunk');
    fx.git('push', '--quiet', 'origin', 'trunk');
    fx.git('remote', 'set-head', 'origin', 'trunk');
    expect(await deleteOrphanedBranch(run, fx.repo, 'trunk')).toBeNull();
    expect(localBranches()).toContain('trunk');
  });
});

describe('cleanup against a git repository', () => {
  // gh and pwsh are faked; git runs for real against the fixture
  function fakeRun(prs: object[], calls: string[][]): Run {
    return async (command, args, cwd) => {
      if (command === 'gh') return { ok: true, stdout: JSON.stringify(prs) };
      if (command === 'pwsh') {
        calls.push(args);
        return { ok: true, stdout: '{"removed":[],"branchesDeleted":["feat/7-merged"],"left":[]}' };
      }
      return run(command, args, cwd);
    };
  }

  it('runs the script only for merged PRs whose head branch or wip-<nr> is still local', async () => {
    fx.git('branch', '--quiet', 'feat/7-merged');
    fx.git('worktree', 'add', '--quiet', '-b', 'wip-12', join(fx.root, 'wip-12'), 'main');
    const calls: string[][] = [];
    const prs = [
      { number: 30, headRefName: 'feat/7-merged' },
      { number: 31, headRefName: 'fix/12-in-worktree' },
      { number: 32, headRefName: 'feat/13-already-gone' },
    ];
    const report = await cleanup(fakeRun(prs, calls), fx.repo, '/skills/deliver/scripts/Remove-PbiWorktrees.ps1');
    expect(report.candidates).toEqual([
      { pr: 30, issue: 7, branch: 'feat/7-merged' },
      { pr: 31, issue: 12, branch: 'fix/12-in-worktree' },
    ]);
    expect(calls.map((args) => args.slice(-4))).toEqual([
      ['-Pr', '30', '-Issue', '7'],
      ['-Pr', '31', '-Issue', '12'],
    ]);
    expect(calls[0].slice(0, 4)).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-File',
      '/skills/deliver/scripts/Remove-PbiWorktrees.ps1',
    ]);
  });

  it('reports nothing to do when no merged PR left a branch or worktree', async () => {
    const calls: string[][] = [];
    const report = await cleanup(fakeRun([{ number: 40, headRefName: 'feat/20-x' }], calls), fx.repo, 'x.ps1');
    expect(calls).toEqual([]);
    expect(report).toEqual({ removed: [], branchesDeleted: [], left: [], candidates: [], failed: [] });
  });
});

// End to end with the installed Remove-PbiWorktrees.ps1 of the deliver skill and a fake `gh` on PATH; skipped when
// pwsh or the skill is not installed (e.g. in CI).
const hasPwsh = (() => {
  try {
    execFileSync('pwsh', ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const skill = findDeliverSkill(null, homedir(), existsSync);
const script = skill ? join(skill, 'scripts', 'Remove-PbiWorktrees.ps1') : null;
const e2e = hasPwsh && script && existsSync(script) ? describe : describe.skip;

e2e('cleanup with the installed Remove-PbiWorktrees.ps1', () => {
  let path: string | undefined;
  beforeEach(() => {
    path = process.env.PATH;
    const bin = join(fx.root, 'bin');
    mkdirSync(bin);
    const head = fx.git('rev-parse', 'main').trim();
    writeFileSync(join(fx.root, 'prs.json'), JSON.stringify([{ number: 50, headRefName: 'feat/7-done' }]));
    writeFileSync(
      join(fx.root, 'pr.json'),
      JSON.stringify({ headRefName: 'feat/7-done', baseRefName: 'release/next', commits: [{ oid: head }] }),
    );
    // gh pr list → prs.json, gh pr view → pr.json
    const gh = `#!/bin/sh\nif [ "$2" = "list" ]; then cat "${fx.root}/prs.json"; else cat "${fx.root}/pr.json"; fi\n`;
    writeFileSync(join(bin, 'gh'), gh);
    chmodSync(join(bin, 'gh'), 0o755);
    process.env.PATH = `${bin}${delimiter}${path}`;
  });
  afterEach(() => {
    process.env.PATH = path;
  });

  it('removes a clean worktree, keeps a dirty one and the current one', async () => {
    const clean = join(fx.root, 'clean');
    const dirty = join(fx.root, 'dirty');
    const current = join(fx.root, 'current');
    fx.git('worktree', 'add', '--quiet', '-b', 'feat/7-done', clean, 'main');
    fx.git('worktree', 'add', '--quiet', '-b', 'wip-7', dirty, 'main');
    writeFileSync(join(dirty, 'scratch.txt'), 'uncommitted\n');
    fx.git('worktree', 'add', '--quiet', '--detach', current, 'main');

    // run from the `current` worktree: it is at a commit of the PR but the current one, so it stays
    const report = await cleanup(run, current, script as string);

    expect(report.removed).toEqual([clean]);
    expect(report.branchesDeleted).toEqual(['feat/7-done']);
    expect(report.left).toEqual([
      { path: dirty, reason: 'uncommitted changes', command: `git worktree remove --force ${dirty}` },
      { branch: 'wip-7', reason: 'checked out in a worktree', command: 'git branch -D wip-7' },
    ]);
    expect(worktreePaths().sort()).toEqual([fx.repo, current, dirty].sort());
    expect(localBranches()).toEqual(['main', 'wip-7']);
  });
});
