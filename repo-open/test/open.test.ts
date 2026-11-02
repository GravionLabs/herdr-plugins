import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TABS, type Tab } from '../lib/config.ts';
import type { Repo } from '../lib/discover.ts';
import type { Result, Run } from '../lib/host.ts';
import { findWorkspace, openRepo, parsePanes, parseWorkspaces, workspaceLabel } from '../lib/open.ts';

const src = join('/', 'src');
const repo: Repo = { name: 'app', path: join(src, 'org', 'app'), rel: join('org', 'app') };

const ok = (result: unknown): Result => ({ ok: true, stdout: JSON.stringify({ id: 'x', result }) });
const workspaceList = (...ws: [string, string][]): Result =>
  ok({ workspaces: ws.map(([workspace_id, label]) => ({ workspace_id, label })) });
const paneList = (...panes: [string, string | null][]): Result =>
  ok({ panes: panes.map(([workspace_id, cwd]) => ({ workspace_id, cwd, foreground_cwd: cwd })) });

// Fake herdr: answers by subcommand, records every call.
function fake(answers: Partial<Record<string, Result>>): { run: Run; calls: string[][] } {
  const calls: string[][] = [];
  let tabs = 1;
  let panes = 1;
  const run: Run = async (_command, args) => {
    calls.push(args);
    const key = args.slice(0, 2).join(' ');
    if (answers[key]) return answers[key]!;
    if (key === 'workspace create') {
      return ok({ workspace: { workspace_id: 'w9' }, tab: { tab_id: 'w9:t1' }, root_pane: { pane_id: 'w9:p1' } });
    }
    if (key === 'tab create') {
      tabs += 1;
      panes += 1;
      return ok({ tab: { tab_id: `w9:t${tabs}` }, root_pane: { pane_id: `w9:p${panes}` } });
    }
    return ok({ type: 'ok' });
  };
  return { run, calls };
}

describe('parse', () => {
  it('reads workspaces and panes, preferring the foreground cwd', () => {
    expect(parseWorkspaces(JSON.stringify({ result: { workspaces: [{ workspace_id: 'w1', label: 'a' }] } }))).toEqual([{ id: 'w1', label: 'a' }]);
    const panes = JSON.stringify({ result: { panes: [{ workspace_id: 'w1', cwd: '/a', foreground_cwd: '/b' }, { cwd: '/c' }] } });
    expect(parsePanes(panes)).toEqual([{ workspaceId: 'w1', cwd: '/b' }]);
  });

  it('rejects a response without result', () => {
    expect(() => parseWorkspaces('nope')).toThrow('herdr workspace list: unexpected response');
  });
});

describe('findWorkspace', () => {
  const ws = [
    { id: 'w1', label: 'app' },
    { id: 'w2', label: 'other' },
  ];

  it('finds the workspace with a pane inside the repository first', () => {
    expect(findWorkspace(repo, ws, [{ workspaceId: 'w2', cwd: join(repo.path, 'lib') }])?.id).toBe('w2');
  });

  it('does not take a sibling directory with the same prefix for the repository', () => {
    expect(findWorkspace(repo, ws.slice(1), [{ workspaceId: 'w2', cwd: `${repo.path}-old` }])).toBeNull();
  });

  it('falls back to the label when the workspace has no pane elsewhere', () => {
    expect(findWorkspace(repo, ws, [{ workspaceId: 'w1', cwd: null }])?.id).toBe('w1');
  });

  it('ignores a workspace of the same name that belongs to another repository', () => {
    expect(findWorkspace(repo, ws, [{ workspaceId: 'w1', cwd: join(src, 'elsewhere', 'app') }])).toBeNull();
  });
});

describe('workspaceLabel', () => {
  it('uses the name, or the relative path when the name is taken', () => {
    expect(workspaceLabel(repo, [])).toBe('app');
    expect(workspaceLabel(repo, [{ id: 'w1', label: 'app' }])).toBe(join('org', 'app'));
  });
});

describe('openRepo', () => {
  it('focuses an existing workspace of the repository and creates nothing', async () => {
    const { run, calls } = fake({
      'workspace list': workspaceList(['w1', 'app']),
      'pane list': paneList(['w1', repo.path]),
    });
    expect(await openRepo(run, 'herdr', repo, DEFAULT_TABS)).toEqual({ kind: 'focused', workspaceId: 'w1', label: 'app' });
    expect(calls).toEqual([['workspace', 'list'], ['pane', 'list'], ['workspace', 'focus', 'w1']]);
  });

  it('creates the workspace with a terminal tab and an agent tab running claude, then focuses the agent tab', async () => {
    const { run, calls } = fake({ 'workspace list': workspaceList(), 'pane list': paneList() });
    expect(await openRepo(run, 'herdr', repo, DEFAULT_TABS)).toEqual({ kind: 'created', workspaceId: 'w9', label: 'app' });
    expect(calls.slice(2)).toEqual([
      ['workspace', 'create', '--cwd', repo.path, '--label', 'app', '--no-focus'],
      ['tab', 'rename', 'w9:t1', 'terminal'],
      ['tab', 'create', '--workspace', 'w9', '--cwd', repo.path, '--label', 'agent', '--no-focus'],
      ['pane', 'run', 'w9:p2', 'claude'],
      ['tab', 'focus', 'w9:t2'],
      ['workspace', 'focus', 'w9'],
    ]);
  });

  it('runs the command of the first tab in the root pane and focuses the first tab without a focus mark', async () => {
    const tabs: Tab[] = [
      { label: 'agent', command: 'claude', focus: false },
      { label: 'shell', command: null, focus: false },
    ];
    const { run, calls } = fake({ 'workspace list': workspaceList(), 'pane list': paneList() });
    await openRepo(run, 'herdr', repo, tabs);
    expect(calls).toContainEqual(['pane', 'run', 'w9:p1', 'claude']);
    expect(calls).toContainEqual(['tab', 'focus', 'w9:t1']);
  });

  it('fails with the herdr reason and stops', async () => {
    const { run, calls } = fake({
      'workspace list': workspaceList(),
      'pane list': paneList(),
      'workspace create': { ok: false, reason: 'server not running' },
    });
    await expect(openRepo(run, 'herdr', repo, DEFAULT_TABS)).rejects.toThrow('herdr workspace create: server not running');
    expect(calls).toHaveLength(3);
  });

  it('fails when a create response has no ids', async () => {
    const { run } = fake({ 'workspace list': workspaceList(), 'pane list': paneList(), 'workspace create': ok({}) });
    await expect(openRepo(run, 'herdr', repo, DEFAULT_TABS)).rejects.toThrow('herdr workspace create: no workspace in the response');
  });
});
