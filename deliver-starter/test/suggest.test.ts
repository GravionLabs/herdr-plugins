import { describe, expect, it } from 'vitest';
import { applyKey, initialForm, render, visibleList, type Form } from '../lib/form.ts';
import type { Result } from '../lib/run.ts';
import { activeQuery, filterIssues, insertNumber, loadIssues, markers, parseIssues } from '../lib/suggest.ts';

// Recorded shape of `gh issue list --json number,title,labels,assignees`.
const recorded = JSON.stringify([
  { number: 36, title: '[PBI] Suggest open issues', labels: [{ name: 'needs-refinement' }], assignees: [] },
  { number: 12, title: '[Feature] Board view', labels: [{ name: 'needs-decision' }], assignees: [{ login: 'ann' }] },
  { number: 7, title: '[Epic] Delivery', labels: [], assignees: [] },
  { number: 40, title: 'Plain bug report', labels: [{ name: 'bug' }], assignees: [] },
  { number: 41, title: 'Untitled level', labels: [{ name: 'PBI' }], assignees: [] },
  { title: 'broken entry' },
]);

describe('parseIssues', () => {
  const issues = parseIssues(recorded)!;

  it('keeps PBIs, Features and Epics by title prefix or label', () => {
    expect(issues.map((i) => [i.number, i.level])).toEqual([
      [36, 'PBI'],
      [12, 'Feature'],
      [7, 'Epic'],
      [41, 'PBI'],
    ]);
  });

  it('reads markers', () => {
    expect(markers(issues[0]!)).toBe('[needs-refinement]');
    expect(markers(issues[1]!)).toBe('[needs-decision] [@ann]');
    expect(markers(issues[2]!)).toBe('');
  });

  it('returns null for unreadable or non-list JSON', () => {
    expect(parseIssues('nope')).toBeNull();
    expect(parseIssues('{}')).toBeNull();
    expect(parseIssues('[]')).toEqual([]);
  });
});

describe('filterIssues and token helpers', () => {
  const issues = parseIssues(recorded)!;

  it('filters by number start and title text', () => {
    expect(filterIssues(issues, '').length).toBe(4);
    expect(filterIssues(issues, '3').map((i) => i.number)).toEqual([36]);
    expect(filterIssues(issues, 'BOARD').map((i) => i.number)).toEqual([12]);
    expect(filterIssues(issues, 'zzz')).toEqual([]);
  });

  it('finds the # token being typed', () => {
    expect(activeQuery('#')).toBe('');
    expect(activeQuery('3 #1')).toBe('1');
    expect(activeQuery('3 ')).toBeNull();
    expect(activeQuery('#3 ')).toBeNull();
    expect(activeQuery('--milestone x')).toBeNull();
  });

  it('inserts the number in place of the token', () => {
    expect(insertNumber('3 #bo', 12)).toBe('3 12 ');
    expect(insertNumber('#', 7)).toBe('7 ');
  });
});

describe('loadIssues', () => {
  const ok = (stdout: string) => async (): Promise<Result> => ({ ok: true, stdout });
  const fail = (code: string | number | null, stderr: string) => async (): Promise<Result> => ({
    ok: false,
    code,
    stdout: '',
    stderr,
  });

  it('makes one gh call with the limit', async () => {
    const calls: string[][] = [];
    const run = async (c: string, a: string[]): Promise<Result> => {
      calls.push([c, ...a]);
      return { ok: true, stdout: recorded };
    };
    const loaded = await loadIssues(run, '/repo', 25);
    expect(loaded.ok && loaded.issues.length).toBe(4);
    expect(calls).toEqual([
      ['gh', 'issue', 'list', '--state', 'open', '--json', 'number,title,labels,assignees', '--limit', '25'],
    ]);
  });

  it('reports failures as a reason', async () => {
    expect(await loadIssues(fail('ENOENT', ''), '/r', 5)).toEqual({ ok: false, reason: 'gh is not installed. Install it and make sure it is on your PATH.' });
    expect(await loadIssues(fail(1, '\ndial tcp: no such host\n'), '/r', 5)).toEqual({
      ok: false,
      reason: 'dial tcp: no such host',
    });
    expect(await loadIssues(ok('garbage'), '/r', 5)).toEqual({ ok: false, reason: 'unreadable gh output' });
  });
});

describe('list key handling', () => {
  const withIssues = (text: string): Form => ({ ...initialForm('interactive'), issues: parseIssues(recorded)!, text });
  const UP = '\x1b[A';
  const DOWN = '\x1b[B';

  it('opens on # and filters live while typing', () => {
    let form = withIssues('');
    expect(visibleList(form)).toEqual([]);
    form = applyKey(form, '#').form;
    expect(visibleList(form).length).toBe(4);
    form = applyKey(form, 'boa').form;
    expect(visibleList(form).map((i) => i.number)).toEqual([12]);
  });

  it('arrows move and wrap, Enter inserts the number and keeps the popup open', () => {
    const form = applyKey(withIssues('#'), DOWN).form;
    const step = applyKey(form, '\r');
    expect(step.event).toBeNull();
    expect(step.form.text).toBe('12 ');
    expect(applyKey(withIssues('#'), UP).form.index).toBe(3);
  });

  it('several numbers can be inserted', () => {
    let form = applyKey(withIssues('#'), '\r').form;
    expect(form.text).toBe('36 ');
    form = applyKey(form, '#').form;
    form = applyKey(form, DOWN).form;
    form = applyKey(form, '\r').form;
    expect(form.text).toBe('36 12 ');
  });

  it('Esc closes the list first, the popup second, and typing reopens', () => {
    const step = applyKey(withIssues('#'), '\x1b');
    expect(step.event).toBeNull();
    expect(visibleList(step.form)).toEqual([]);
    expect(applyKey(step.form, '\x1b').event).toBe('cancel');
    expect(visibleList(applyKey(step.form, 'boa').form).length).toBe(1);
  });

  it('Enter submits when no list is shown, Ctrl-C always cancels', () => {
    expect(applyKey(withIssues('3'), '\r').event).toBe('submit');
    expect(applyKey(withIssues('#zzz'), '\r').event).toBe('submit');
    expect(applyKey(withIssues('#'), '\x03').event).toBe('cancel');
  });

  it('renders rows with level and markers, the selection and the hint', () => {
    const text = render(withIssues('#')).join('\n');
    expect(text).toContain('> #36 PBI [PBI] Suggest open issues [needs-refinement]');
    expect(text).toContain('  #12 Feature [Feature] Board view [needs-decision] [@ann]');
    expect(text).toContain('Enter: insert number');
  });
});

describe('failure fallback', () => {
  it('shows the reason on # and leaves the popup usable', () => {
    const form: Form = { ...initialForm('interactive'), note: 'gh is not installed', text: '#' };
    expect(render(form)).toContain('No suggestions: gh is not installed');
    expect(applyKey(form, '\r').event).toBe('submit');
    expect(render({ ...form, text: '3' }).join('\n')).not.toContain('No suggestions');
  });
});
