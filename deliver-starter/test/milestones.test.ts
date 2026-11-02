import { describe, expect, it } from 'vitest';
import { parseArgs } from '../lib/args.ts';
import { applyKey, filterHeader, initialForm, render, visibleList, visibleMilestones, type Form } from '../lib/form.ts';
import {
  activeMilestoneQuery,
  describeMilestone,
  filterMilestones,
  loadMilestones,
  milestoneArgs,
  orderMilestones,
  parseMilestones,
} from '../lib/milestones.ts';
import type { Result } from '../lib/run.ts';
import { nextLevel, parseIssues, scopeIssues } from '../lib/suggest.ts';

// Recorded shape of `gh api repos/{owner}/{repo}/milestones` (fields used here).
const recordedMilestones = JSON.stringify([
  { number: 9, title: '0.6.0', state: 'open', open_issues: 13, closed_issues: 0, due_on: null },
  { number: 6, title: '1.0.0', state: 'open', open_issues: 12, closed_issues: 1, due_on: '2026-12-31T08:00:00Z' },
  { number: 7, title: '0.4.0', state: 'open', open_issues: 0, closed_issues: 4, due_on: null },
  { number: 8, title: '0.5.0', state: 'open', open_issues: 28, closed_issues: 2, due_on: null },
  { number: 10, title: 'my release', state: 'open', open_issues: 1, closed_issues: 0 },
  { number: 3, title: 'old', state: 'closed', open_issues: 0, closed_issues: 9 },
  { title: 'broken' },
]);

const recordedIssues = JSON.stringify([
  { number: 155, title: '[Feature] repo-open', labels: [], assignees: [], milestone: { title: '0.5.0' } },
  { number: 156, title: '[PBI] feat(repo-open): skeleton', labels: [], assignees: [], milestone: { title: '0.5.0' } },
  { number: 157, title: '[PBI] feat(repo-open): picker', labels: [], assignees: [], milestone: { title: '0.5.0' } },
  { number: 150, title: '[Bug] fix: empty popup', labels: [], assignees: [], milestone: { title: '0.5.0' } },
  { number: 69, title: '[Epic] 1.0.0', labels: [], assignees: [], milestone: { title: '1.0.0' } },
  { number: 90, title: '[PBI] test: e2e', labels: [], assignees: [], milestone: null },
]);

const milestones = orderMilestones(parseMilestones(recordedMilestones)!);
const issues = parseIssues(recordedIssues)!;
const form = (text = ''): Form => ({ ...initialForm('interactive'), milestones, issues, text });
const type = (f: Form, keys: string[]): Form => keys.reduce((acc, key) => applyKey(acc, key).form, f);
const DOWN = '\x1b[B';

describe('parseMilestones and orderMilestones', () => {
  it('reads the open milestones with counts and due date, skipping closed and broken entries', () => {
    const parsed = parseMilestones(recordedMilestones)!;
    expect(parsed.map((m) => m.title)).toEqual(['0.6.0', '1.0.0', '0.4.0', '0.5.0', 'my release']);
    expect(parsed[1]).toEqual({ number: 6, title: '1.0.0', open: 12, closed: 1, due: '2026-12-31', current: false });
  });

  it('returns null for unreadable or non-list JSON', () => {
    expect(parseMilestones('nope')).toBeNull();
    expect(parseMilestones('{}')).toBeNull();
  });

  it('marks the lowest version with open work as current and orders it first, the rest by version, then other names', () => {
    expect(milestones.map((m) => [m.title, m.current])).toEqual([
      ['0.5.0', true],
      ['0.4.0', false],
      ['0.6.0', false],
      ['1.0.0', false],
      ['my release', false],
    ]);
  });

  it('never marks a name that is not a version, nor a milestone without open work', () => {
    const named = milestones.find((m) => m.title === 'my release')!;
    const released = milestones.find((m) => m.title === '0.4.0')!;
    expect(orderMilestones([named, released]).map((m) => [m.title, m.current])).toEqual([
      ['0.4.0', false],
      ['my release', false],
    ]);
  });

  it('compares versions numerically, not as text', () => {
    const at = (title: string, number: number) => ({ ...milestones[0]!, title, number, open: 1, current: false });
    expect(orderMilestones([at('0.10.0', 1), at('0.9.0', 2)]).map((m) => m.title)).toEqual(['0.9.0', '0.10.0']);
  });

  it('describes a row with counts, due date and the current mark', () => {
    expect(describeMilestone(milestones[0]!)).toBe('0.5.0  (28 open, 2 closed)  current');
    expect(describeMilestone(milestones[3]!)).toBe('1.0.0  (12 open, 1 closed, due 2026-12-31)');
  });
});

describe('milestone token helpers', () => {
  it('finds the @ token being typed', () => {
    expect(activeMilestoneQuery('@')).toBe('');
    expect(activeMilestoneQuery('3 @0.5')).toBe('0.5');
    expect(activeMilestoneQuery('@0.5 ')).toBeNull();
    expect(activeMilestoneQuery('a@b')).toBeNull();
  });

  it('filters by any part of the name', () => {
    expect(filterMilestones(milestones, '0.').map((m) => m.title)).toEqual(['0.5.0', '0.4.0', '0.6.0', '1.0.0']);
    expect(filterMilestones(milestones, 'REL').map((m) => m.title)).toEqual(['my release']);
  });

  it('quotes a name with spaces so the argument parser reads it back', () => {
    expect(milestoneArgs('0.5.0')).toBe('--milestone 0.5.0 ');
    expect(milestoneArgs('my release')).toBe('--milestone "my release" ');
    const parsed = parseArgs(milestoneArgs('my release'));
    expect(parsed.ok && parsed.target.milestone).toBe('my release');
  });
});

describe('loadMilestones', () => {
  it('makes one gh api call for the open milestones and orders them', async () => {
    const calls: string[][] = [];
    const run = async (c: string, a: string[], cwd: string): Promise<Result> => {
      calls.push([c, cwd, ...a]);
      return { ok: true, stdout: recordedMilestones };
    };
    const loaded = await loadMilestones(run, '/repo');
    expect(loaded.ok && loaded.milestones[0]!.title).toBe('0.5.0');
    expect(calls).toEqual([
      ['gh', '/repo', 'api', 'repos/{owner}/{repo}/milestones', '-X', 'GET', '-f', 'state=open', '-f', 'per_page=100'],
    ]);
  });

  it('reports failures as a reason', async () => {
    const fail = async (): Promise<Result> => ({ ok: false, code: 1, stdout: '', stderr: 'HTTP 404\n' });
    expect(await loadMilestones(fail, '/r')).toEqual({ ok: false, reason: 'HTTP 404' });
    expect(await loadMilestones(async () => ({ ok: true, stdout: 'x' }), '/r')).toEqual({ ok: false, reason: 'unreadable gh output' });
  });
});

describe('@ milestone picker', () => {
  it('opens on @, filters live and closes with Esc', () => {
    let f = applyKey(form(), '@').form;
    expect(visibleMilestones(f)).toHaveLength(5);
    f = type(f, ['0', '.', '5']);
    expect(visibleMilestones(f).map((m) => m.title)).toEqual(['0.5.0']);
    const closed = applyKey(f, '\x1b');
    expect(closed.event).toBeNull();
    expect(visibleMilestones(closed.form)).toEqual([]);
  });

  it('Enter inserts --milestone with the name and keeps the popup open', () => {
    const step = applyKey(type(form(), ['@']), '\r');
    expect(step.event).toBeNull();
    expect(step.form.text).toBe('--milestone 0.5.0 ');
    expect(step.form.milestone).toBe('0.5.0');
    expect(applyKey(step.form, '\r').event).toBe('submit');
  });

  it('replaces numbers typed before, as --milestone takes the whole line', () => {
    expect(applyKey(type(form('3 '), ['@', 'r', 'e', 'l']), '\r').form.text).toBe('--milestone "my release" ');
  });

  it('renders the milestones with the current one first and the hint', () => {
    const text = render(applyKey(form(), '@').form).join('\n');
    expect(text).toContain('> 0.5.0  (28 open, 2 closed)  current');
    expect(text).toContain('  1.0.0  (12 open, 1 closed, due 2026-12-31)');
    expect(text).toContain('Enter: insert milestone');
  });

  it('shows the gh failure or that nothing matches while @ is typed, and still submits', () => {
    const failed: Form = { ...initialForm('interactive'), milestoneNote: 'gh is not logged in', text: '@' };
    expect(render(failed)).toContain('No milestones: gh is not logged in');
    expect(applyKey(failed, '\r').event).toBe('submit');
    expect(render({ ...initialForm('interactive'), text: '@' })).toContain('No open milestones');
    expect(render(form('@zzz'))).toContain('No matching milestone');
  });
});

describe('# list filtered by milestone and level', () => {
  const picked = (): Form => applyKey(type(form(), ['@']), '\r').form;

  it('shows only the work items of the chosen milestone', () => {
    const f = applyKey(picked(), '#').form;
    expect(visibleList(f).map((i) => i.number)).toEqual([155, 156, 157, 150]);
    expect(render(f)).toContain('Level: all (Ctrl+L) · Milestone: 0.5.0');
  });

  it('picking an item replaces the whole milestone by its number, the filter stays for more items', () => {
    let f = type(picked(), ['#', DOWN, '\r']);
    expect(f.text).toBe('156 ');
    expect(f.milestone).toBe('0.5.0');
    f = type(f, ['#', DOWN, DOWN, '\r']);
    expect(f.text).toBe('156 157 ');
  });

  it('clearing the line restores the full list', () => {
    let f = type(picked(), ['#', DOWN, '\r']);
    f = type(f, ['\x7f', '\x7f', '\x7f', '\x7f']);
    expect(f.text).toBe('');
    expect(f.milestone).toBeNull();
    expect(visibleList(applyKey(f, '#').form)).toHaveLength(6);
  });

  it('Ctrl+L cycles the level filter all, Epic, Feature, PBI, Bug and shows it in the header', () => {
    let f = applyKey(form(), '#').form;
    const levels: string[] = [];
    for (let i = 0; i < 5; i++) {
      f = applyKey(f, '\x0c').form;
      levels.push(`${f.level}:${visibleList(f).map((x) => x.number).join(',')}`);
    }
    expect(levels).toEqual(['Epic:69', 'Feature:155', 'PBI:156,157,90', 'Bug:150', 'null:155,156,157,150,69,90']);
    expect(filterHeader({ ...f, level: 'PBI' })).toBe('Level: PBI (Ctrl+L)');
  });

  it('combines level and milestone and keeps the header when nothing matches', () => {
    const f = { ...applyKey(picked(), '#').form, level: 'Epic' as const };
    expect(visibleList(f)).toEqual([]);
    expect(render(f)).toContain('Level: Epic (Ctrl+L) · Milestone: 0.5.0');
    expect(render(f)).toContain('  No matching issue');
  });

  it('scopeIssues and nextLevel are pure helpers', () => {
    expect(scopeIssues(issues, { level: 'Bug', milestone: '0.5.0' }).map((i) => i.number)).toEqual([150]);
    expect(nextLevel('Bug')).toBeNull();
    expect(nextLevel(null)).toBe('Epic');
  });
});
