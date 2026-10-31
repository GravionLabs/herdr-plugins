import { describe, expect, it } from 'vitest';
import type { Row } from '../lib/board.ts';
import { keyAction, moveSelection, prCell, renderBoard, rowCells } from '../lib/view.ts';

const claimed: Row = {
  number: 2,
  title: '[PBI] feat(deliver-board): popup with PBIs, claims and PR state',
  assignee: 'GravionLabs',
  labels: ['in-progress'],
  branch: 'feat/2-deliver-board',
  pr: {
    number: 40,
    headRefName: 'feat/2-deliver-board',
    state: 'OPEN',
    url: 'https://github.com/GravionLabs/herdr-plugins/pull/40',
    checks: { state: 'pending', passed: 1, failed: 0, pending: 2, skipped: 0 },
  },
  url: 'https://github.com/GravionLabs/herdr-plugins/pull/40',
};
const open: Row = {
  number: 7,
  title: '[PBI] feat(worktree-cleanup): remove worktrees',
  assignee: '',
  labels: [],
  branch: null,
  pr: null,
  url: 'https://github.com/GravionLabs/herdr-plugins/issues/7',
};

describe('keyAction', () => {
  it.each([
    ['q', 'quit'],
    ['\x1b', 'quit'],
    ['\x03', 'quit'],
    ['r', 'refresh'],
    ['\r', 'open'],
    ['\x1b[A', 'up'],
    ['k', 'up'],
    ['\x1b[B', 'down'],
    ['j', 'down'],
  ])('maps %j to %s', (data, action) => {
    expect(keyAction(data)).toBe(action);
  });

  it('ignores other keys', () => {
    expect(keyAction('x')).toBeNull();
    expect(keyAction('\x1b[C')).toBeNull();
  });
});

describe('moveSelection', () => {
  it('moves within the rows and stops at both ends', () => {
    expect(moveSelection(0, 'down', 2)).toBe(1);
    expect(moveSelection(1, 'down', 2)).toBe(1);
    expect(moveSelection(1, 'up', 2)).toBe(0);
    expect(moveSelection(0, 'up', 2)).toBe(0);
  });

  it('clamps the selection after a refresh with fewer rows', () => {
    expect(moveSelection(5, 'refresh', 3)).toBe(2);
    expect(moveSelection(5, 'refresh', 0)).toBe(0);
  });
});

describe('rowCells', () => {
  it('shows number, title without [PBI], assignee, labels, branch, PR and checks', () => {
    expect(rowCells(claimed)).toEqual([
      '#2',
      'feat(deliver-board): popup with PBIs, claims and PR state',
      'GravionLabs',
      'in-progress',
      'feat/2-deliver-board',
      '#40',
      '2 pending, 1 passed',
    ]);
  });

  it('shows dashes for an unclaimed issue without branch and PR', () => {
    expect(rowCells(open)).toEqual(['#7', 'feat(worktree-cleanup): remove worktrees', '-', '', '-', '-', '-']);
  });

  it('adds the state of a PR that is not open', () => {
    expect(prCell({ ...claimed, pr: { ...claimed.pr!, state: 'MERGED' } })).toBe('#40 merged');
  });
});

describe('renderBoard', () => {
  it('marks the selected row and ends with the status and key help', () => {
    const lines = renderBoard([claimed, open], 1, 200, 'status line');
    expect(lines[0]).toMatch(/^ {2}PBI +Title +Assignee +Labels +Branch +PR +Checks$/);
    expect(lines[1]?.startsWith('  #2 ')).toBe(true);
    expect(lines[2]?.startsWith('> #7 ')).toBe(true);
    expect(lines.slice(-2)).toEqual(['status line', 'Enter open  r refresh  j/k move  q/Esc close']);
  });

  it('cuts lines to the terminal width', () => {
    for (const line of renderBoard([claimed, open], 0, 60, '').slice(0, 3)) expect(line.length).toBeLessThanOrEqual(60);
  });

  it('says so when there are no PBIs', () => {
    expect(renderBoard([], 0, 80, '')[1]).toBe('  No open issues labelled pbi.');
  });
});
