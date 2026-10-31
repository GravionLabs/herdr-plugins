import { describe, expect, it } from 'vitest';
import { checkIssue } from '../lib/issue.ts';
import { startFromLink } from '../lib/link-start.ts';
import { startInteractive, startUnattended, validate, type Deps } from '../lib/start.ts';
import type { Result } from '../lib/run.ts';

const config = { harness: 'claude', mode: 'interactive' } as const;
const created = JSON.stringify({ result: { root_pane: { pane_id: 'w2:p1' } } });
const issue = (state: string, title: string, labels: string[] = []) =>
  JSON.stringify({ state, title, labels: labels.map((name) => ({ name })) });

function setup(replies: (command: string, args: string[]) => Result, present: string[] = []) {
  const calls: { command: string; args: string[]; cwd: string }[] = [];
  const deps: Deps = {
    run: async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      return replies(command, args);
    },
    herdr: 'herdr',
    exists: (p) => present.includes(p),
    home: '/home/u',
  };
  return { deps, calls };
}

describe('issue check', () => {
  it('accepts open PBI, Feature and Epic by title prefix or label', () => {
    expect(checkIssue(3, issue('OPEN', '[PBI] x'))).toBeNull();
    expect(checkIssue(3, issue('OPEN', '[Feature] x'))).toBeNull();
    expect(checkIssue(3, issue('OPEN', '[epic] x'))).toBeNull();
    expect(checkIssue(3, issue('OPEN', 'x', ['pbi']))).toBeNull();
  });

  it('rejects closed issues and other levels', () => {
    expect(checkIssue(3, issue('CLOSED', '[PBI] x'))).toBe('#3 is closed');
    expect(checkIssue(3, issue('OPEN', '[Task] x'))).toBe('#3 is not a PBI, Feature or Epic');
    expect(checkIssue(3, 'nope')).toBe('#3: unreadable gh output');
  });
});

describe('validate', () => {
  it('checks every number and stops at the first problem', async () => {
    const { deps, calls } = setup((_, args) =>
      args[2] === '4' ? { ok: true, stdout: issue('CLOSED', '[PBI] x') } : { ok: true, stdout: issue('OPEN', '[PBI] x') },
    );
    expect(await validate(deps, '/repo', { numbers: [3, 4, 5], milestone: null })).toBe('#4 is closed');
    expect(calls.map((c) => c.args.slice(0, 3))).toEqual([
      ['issue', 'view', '3'],
      ['issue', 'view', '4'],
    ]);
  });

  it('reports a missing issue', async () => {
    const { deps } = setup(() => ({ ok: false, code: 1, stdout: '', stderr: 'GraphQL: Could not resolve to an Issue' }));
    expect(await validate(deps, '/repo', { numbers: [99], milestone: null })).toBe('#99 does not exist');
  });

  it('pins the repository for a link', async () => {
    const { deps, calls } = setup(() => ({ ok: true, stdout: issue('OPEN', '[PBI] x') }));
    await validate(deps, '/repo', { numbers: [3], milestone: null }, 'a/b');
    expect(calls[0]?.args).toContain('a/b');
  });
});

describe('interactive start', () => {
  it('creates the worktree from origin/release/next, then runs the harness in its root pane', async () => {
    const { deps, calls } = setup((_, args) => ({ ok: true, stdout: args[0] === 'worktree' ? created : '' }));
    expect(await startInteractive(deps, '/repo', config, { numbers: [3, 4], milestone: null })).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        command: 'herdr',
        args: ['worktree', 'create', '--cwd', '/repo', '--branch', 'deliver/3', '--base', 'origin/release/next', '--focus'],
        cwd: '/repo',
      },
      { command: 'herdr', args: ['pane', 'run', 'w2:p1', "claude '/deliver 3 4'"], cwd: '/repo' },
    ]);
  });

  it('reports a failed worktree create and runs nothing else', async () => {
    const { deps, calls } = setup(() => ({ ok: false, code: 1, stdout: '', stderr: 'branch exists\n' }));
    const outcome = await startInteractive(deps, '/repo', config, { numbers: [3], milestone: null });
    expect(outcome).toEqual({ ok: false, reason: 'herdr worktree create failed: branch exists' });
    expect(calls).toHaveLength(1);
  });

  it('reports a response without a pane', async () => {
    const { deps } = setup(() => ({ ok: true, stdout: '{}' }));
    const outcome = await startInteractive(deps, '/repo', config, { numbers: [3], milestone: null });
    expect(outcome.ok).toBe(false);
  });
});

describe('unattended start', () => {
  const script = '/repo/.claude/skills/deliver/scripts/Invoke-DeliverLoop.ps1';

  it('opens a tab named deliver #<nr> at the repository root and runs the loop', async () => {
    const { deps, calls } = setup(
      (_, args) => ({ ok: true, stdout: args[0] === 'tab' ? created : '' }),
      ['/repo/.claude/skills/deliver', script],
    );
    expect(await startUnattended(deps, '/repo', { numbers: [3, 4], milestone: null })).toEqual({ ok: true });
    expect(calls).toEqual([
      { command: 'herdr', args: ['tab', 'create', '--cwd', '/repo', '--label', 'deliver #3', '--focus'], cwd: '/repo' },
      { command: 'herdr', args: ['pane', 'run', 'w2:p1', `pwsh '${script}' -Target 3 4`], cwd: '/repo' },
    ]);
  });

  it('asks to install the skill when it is not found, and opens no tab', async () => {
    const { deps, calls } = setup(() => ({ ok: true, stdout: created }));
    const outcome = await startUnattended(deps, '/repo', { numbers: [3], milestone: null });
    expect(outcome).toMatchObject({ ok: false, installHint: true });
    expect(outcome.ok === false && outcome.reason).toContain('npx skills add GravionLabs/skills --skill deliver');
    expect(calls).toHaveLength(0);
  });
});

describe('link start', () => {
  const link = { repo: 'a/b', number: 3 };

  it('validates the issue, then starts interactively without a popup', async () => {
    const { deps, calls } = setup((command, args) => {
      if (command === 'gh') return { ok: true, stdout: issue('OPEN', '[PBI] x') };
      return { ok: true, stdout: args[0] === 'worktree' ? created : '' };
    });
    expect(await startFromLink(deps, '/repo', config, link)).toEqual({ ok: true });
    expect(calls.map((c) => c.args[0])).toEqual(['issue', 'worktree', 'pane']);
  });

  it('does not start a closed issue, a missing link or a pane outside a repository', async () => {
    const closed = setup(() => ({ ok: true, stdout: issue('CLOSED', '[PBI] x') }));
    expect(await startFromLink(closed.deps, '/repo', config, link)).toEqual({ ok: false, reason: '#3 is closed' });
    expect(closed.calls).toHaveLength(1);
    expect((await startFromLink(closed.deps, '/repo', config, null)).ok).toBe(false);
    expect((await startFromLink(closed.deps, null, config, link)).ok).toBe(false);
  });
});
