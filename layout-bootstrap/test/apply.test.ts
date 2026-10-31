import { describe, expect, it } from 'vitest';
import { applyLayout, parsePanes, parseSplit } from '../lib/apply.ts';
import { defaultLayout } from '../lib/layout.ts';
import type { Result, Run } from '../lib/run.ts';

const REPO = '/work/repo';
const paneList = (panes: object[]): string => JSON.stringify({ result: { panes } });
const splitReply = (id: string): string => JSON.stringify({ result: { pane: { pane_id: id } } });

// A fake herdr: records every call, answers pane list and pane split.
function fake(panes: object[], splitIds: string[]): { run: Run; calls: string[][] } {
  const calls: string[][] = [];
  const run: Run = async (_command, args) => {
    calls.push(args);
    const out = (stdout: string): Result => ({ ok: true, stdout });
    if (args[1] === 'list') return out(paneList(panes));
    if (args[1] === 'split') return out(splitReply(splitIds.shift() ?? 'w1:pX'));
    return out('{}');
  };
  return { run, calls };
}

describe('parsePanes / parseSplit', () => {
  it('reads id, label, cwd and agent presence', () => {
    expect(parsePanes(paneList([{ pane_id: 'p1', label: 'tests', cwd: '/a', agent: 'claude', tab_id: 't1' }, { x: 1 }]))).toEqual([
      { id: 'p1', label: 'tests', cwd: '/a', agent: true, tabId: 't1' },
    ]);
  });
  it('rejects invalid output', () => {
    expect(() => parsePanes('nope')).toThrow('invalid JSON');
    expect(() => parseSplit('{}')).toThrow('no pane id');
  });
});

describe('applyLayout', () => {
  it('splits the default layout with the repo as cwd and runs the test command', async () => {
    const { run, calls } = fake([{ pane_id: 'p1', cwd: REPO, agent: 'claude' }], ['p2', 'p3']);
    const outcome = await applyLayout(run, 'herdr', defaultLayout('npm test'), REPO, 'p1', 'w1');
    expect(outcome).toEqual({ created: ['agent', 'tests', 'shell'], reused: [], misplaced: [] });
    expect(calls).toEqual([
      ['pane', 'list', '--workspace', 'w1'],
      ['pane', 'rename', 'p1', 'agent'],
      ['pane', 'split', 'p1', '--direction', 'right', '--ratio', '0.6', '--cwd', REPO, '--no-focus'],
      ['pane', 'rename', 'p2', 'tests'],
      ['pane', 'run', 'p2', 'npm test'],
      ['pane', 'split', 'p2', '--direction', 'down', '--ratio', '0.5', '--cwd', REPO, '--no-focus'],
      ['pane', 'rename', 'p3', 'shell'],
    ]);
  });

  it('creates nothing when every pane exists by name', async () => {
    const panes = [
      { pane_id: 'p1', label: 'agent' },
      { pane_id: 'p2', label: 'tests' },
      { pane_id: 'p3', label: 'shell' },
    ];
    const { run, calls } = fake(panes, []);
    const outcome = await applyLayout(run, 'herdr', defaultLayout('npm test'), REPO, 'p1', null);
    expect(outcome).toEqual({ created: [], reused: ['agent', 'tests', 'shell'], misplaced: [] });
    expect(calls).toEqual([['pane', 'list']]);
  });

  it('splits from a reused pane and only creates the missing one', async () => {
    const { run, calls } = fake([{ pane_id: 'p1', label: 'agent' }, { pane_id: 'p2', label: 'tests' }], ['p3']);
    const outcome = await applyLayout(run, 'herdr', defaultLayout(null), REPO, 'p1', null);
    expect(outcome).toEqual({ created: ['shell'], reused: ['agent', 'tests'], misplaced: [] });
    expect(calls[1]).toEqual(['pane', 'split', 'p2', '--direction', 'down', '--ratio', '0.5', '--cwd', REPO, '--no-focus']);
  });

  it('moves a shell root pane outside the repo root to it, but not an agent pane', async () => {
    const shell = fake([{ pane_id: 'p1', cwd: '/work/repo/sub' }], []);
    await applyLayout(shell.run, 'herdr', { panes: [{ name: 'a', command: null, split: null }] }, REPO, 'p1', null);
    expect(shell.calls).toContainEqual(['pane', 'run', 'p1', `cd -- '${REPO}'`]);
    const agent = fake([{ pane_id: 'p1', cwd: '/work/repo/sub', agent: 'claude' }], []);
    await applyLayout(agent.run, 'herdr', { panes: [{ name: 'a', command: null, split: null }] }, REPO, 'p1', null);
    expect(agent.calls.some((c) => c[1] === 'run')).toBe(false);
  });

  it('ignores panes with the same label in another tab', async () => {
    const panes = [
      { pane_id: 'p1', tab_id: 't1' },
      { pane_id: 'p9', tab_id: 't2', label: 'shell' },
      { pane_id: 'p8', tab_id: 't2', label: 'agent' },
    ];
    const { run, calls } = fake(panes, ['p2']);
    const layout = { panes: [
      { name: 'agent', command: null, split: null },
      { name: 'shell', command: null, split: { from: 'agent', direction: 'down' as const, ratio: 0.5 } },
    ] };
    const outcome = await applyLayout(run, 'herdr', layout, REPO, 'p1', 'w1');
    expect(outcome).toEqual({ created: ['agent', 'shell'], reused: [], misplaced: [] });
    expect(calls).toContainEqual(['pane', 'rename', 'p1', 'agent']);
    expect(calls.some((c) => c[1] === 'split')).toBe(true);
  });

  it('reuses a same-tab pane', async () => {
    const { run } = fake([{ pane_id: 'p1', tab_id: 't1' }, { pane_id: 'p2', tab_id: 't1', label: 'shell' }], []);
    const layout = { panes: [{ name: 'shell', command: null, split: null }] };
    expect((await applyLayout(run, 'herdr', layout, REPO, 'p1', null)).reused).toEqual(['shell']);
  });

  it('reports agent root and reused panes that are not in the repo root', async () => {
    const { run } = fake([
      { pane_id: 'p1', cwd: '/elsewhere', agent: 'claude' },
      { pane_id: 'p2', label: 'shell', cwd: '/other' },
      { pane_id: 'p3', label: 'tests', cwd: REPO },
    ], []);
    const outcome = await applyLayout(run, 'herdr', defaultLayout(null), REPO, 'p1', null);
    expect(outcome.misplaced).toEqual(['agent', 'shell']);
  });

  it('reports a failing herdr call', async () => {
    const run: Run = async () => ({ ok: false, code: 1, stdout: '', stderr: 'no server\n' });
    await expect(applyLayout(run, 'herdr', defaultLayout(null), REPO, 'p1', null)).rejects.toThrow(
      'herdr pane list: no server',
    );
  });
});
