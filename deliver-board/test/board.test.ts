import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildRows,
  formatChecks,
  issueNumberOfBranch,
  parseIssues,
  parsePullRequests,
  parseRemoteHeads,
  summarizeChecks,
} from '../lib/board.ts';

// Recorded with `gh issue list --label pbi --json number,title,assignees,labels,url`,
// `gh pr list --base release/next --state all --json number,headRefName,state,url,statusCheckRollup`
// and `git ls-remote --heads origin` in GravionLabs/skills (issues.json, prs.json, ls-remote.txt).
// issues-claimed.json and prs-pending.json follow the same shape for a claim and running checks.
const fixture = (name: string): string => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');

describe('parseIssues', () => {
  it('reads number, title, assignee logins, label names and url from the recorded issue list', () => {
    const issues = parseIssues(fixture('issues.json'));
    expect(issues.map((i) => i.number)).toEqual([73, 72, 16, 10]);
    expect(issues[0]).toEqual({
      number: 73,
      title: '[PBI] fix: GitVersion bumps the minor version on a release merge into main',
      assignees: [],
      labels: ['merged', 'pbi'],
      url: 'https://github.com/GravionLabs/skills/issues/73',
    });
  });

  it('reads the assignee login of a claimed issue', () => {
    expect(parseIssues(fixture('issues-claimed.json'))[0]?.assignees).toEqual(['GravionLabs']);
  });

  it('returns no issues for an empty list', () => {
    expect(parseIssues('[]')).toEqual([]);
  });

  it('skips entries without a number', () => {
    expect(parseIssues('[{"title":"x"}, null, 3]')).toEqual([]);
  });

  it('fails with a readable message on invalid JSON or a non-list', () => {
    expect(() => parseIssues('not json')).toThrow('could not read the issues from gh: invalid JSON');
    expect(() => parseIssues('{"number":1}')).toThrow('could not read the issues from gh: expected a list');
  });
});

describe('parsePullRequests', () => {
  it('reads the recorded PRs with their check summary', () => {
    const prs = parsePullRequests(fixture('prs.json'));
    expect(prs.map((p) => [p.number, p.headRefName, p.state])).toEqual([
      [76, 'docs/72-roadmap-open-issues', 'OPEN'],
      [75, 'docs/17-roadmap-plugin-moved', 'MERGED'],
      [74, 'docs/73-roadmap-1.0.2', 'MERGED'],
      [69, 'chore/14-sync-main', 'MERGED'],
    ]);
    expect(prs[0]?.checks).toEqual({
      state: 'passing',
      passed: 4,
      failed: 0,
      pending: 0,
      skipped: 3,
    });
    expect(prs[2]?.checks).toEqual({
      state: 'failing',
      passed: 4,
      failed: 1,
      pending: 0,
      skipped: 5,
    });
  });

  it('counts in-progress check runs and pending status contexts as pending', () => {
    expect(parsePullRequests(fixture('prs-pending.json'))[0]?.checks).toEqual({
      state: 'pending',
      passed: 1,
      failed: 0,
      pending: 2,
      skipped: 0,
    });
  });

  it('fails with a readable message on invalid JSON', () => {
    expect(() => parsePullRequests('')).toThrow('could not read the pull requests from gh: invalid JSON');
  });
});

describe('summarizeChecks', () => {
  it('reports no checks for an empty or missing rollup', () => {
    const none = {
      state: 'none',
      passed: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
    };
    expect(summarizeChecks([])).toEqual(none);
    expect(summarizeChecks(null)).toEqual(none);
  });

  it('counts failing status contexts and cancelled or timed-out runs as failed', () => {
    const summary = summarizeChecks([
      { __typename: 'StatusContext', state: 'ERROR' },
      { __typename: 'StatusContext', state: 'FAILURE' },
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'CANCELLED' },
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'TIMED_OUT' },
      { __typename: 'StatusContext', state: 'SUCCESS' },
    ]);
    expect(summary).toEqual({
      state: 'failing',
      passed: 1,
      failed: 4,
      pending: 0,
      skipped: 0,
    });
  });
});

describe('formatChecks', () => {
  it('lists failed, pending, passed and skipped counts', () => {
    expect(
      formatChecks({
        state: 'failing',
        passed: 4,
        failed: 1,
        pending: 0,
        skipped: 5,
      }),
    ).toBe('1 failed, 4 passed, 5 skipped');
    expect(
      formatChecks({
        state: 'pending',
        passed: 1,
        failed: 0,
        pending: 2,
        skipped: 0,
      }),
    ).toBe('2 pending, 1 passed');
  });

  it('says no checks when there are none', () => {
    expect(
      formatChecks({
        state: 'none',
        passed: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
      }),
    ).toBe('no checks');
  });
});

describe('parseRemoteHeads', () => {
  it('reads the branch names of the recorded ls-remote output', () => {
    expect(parseRemoteHeads(fixture('ls-remote.txt'))).toEqual(['docs/72-roadmap-open-issues', 'main', 'release/next']);
  });

  it('returns no branches for empty output', () => {
    expect(parseRemoteHeads('')).toEqual([]);
  });
});

describe('issueNumberOfBranch', () => {
  it.each([
    ['feat/2-deliver-board', 2],
    ['fix/56-flaky-check-tests', 56],
    ['docs/72-roadmap-open-issues', 72],
  ])('reads the issue number of %s', (branch, number) => {
    expect(issueNumberOfBranch(branch)).toBe(number);
  });

  it.each(['main', 'release/next', 'docs/roadmap-0.2.0', 'feat/2', 'feat-2-x'])(
    'finds no issue number in %s',
    (branch) => {
      expect(issueNumberOfBranch(branch)).toBeNull();
    },
  );
});

describe('buildRows', () => {
  const recorded = () =>
    buildRows(
      parseIssues(fixture('issues.json')),
      parsePullRequests(fixture('prs.json')),
      parseRemoteHeads(fixture('ls-remote.txt')),
    );

  it('orders the rows by issue number', () => {
    expect(recorded().map((r) => r.number)).toEqual([10, 16, 72, 73]);
  });

  it('links an issue to the PR of its <type>/<nr>-* branch and opens the PR', () => {
    const row = recorded().find((r) => r.number === 72);
    expect(row?.branch).toBe('docs/72-roadmap-open-issues');
    expect(row?.pr?.number).toBe(76);
    expect(row?.url).toBe('https://github.com/GravionLabs/skills/pull/76');
  });

  it('shows only the labels needs-decision, in-progress and merged', () => {
    const rows = recorded();
    expect(rows.find((r) => r.number === 73)?.labels).toEqual(['merged']);
    expect(rows.find((r) => r.number === 10)?.labels).toEqual(['needs-decision']);
    expect(rows.find((r) => r.number === 16)?.labels).toEqual([]);
  });

  it('leaves branch and PR empty and opens the issue when nothing is pushed', () => {
    const row = recorded().find((r) => r.number === 16);
    expect(row).toMatchObject({
      branch: null,
      pr: null,
      assignee: '',
      url: 'https://github.com/GravionLabs/skills/issues/16',
    });
  });

  it('shows a pushed branch without a PR', () => {
    const rows = buildRows(parseIssues(fixture('issues-claimed.json')), [], ['main', 'feat/7-worktree-cleanup']);
    expect(rows.find((r) => r.number === 7)).toMatchObject({
      branch: 'feat/7-worktree-cleanup',
      pr: null,
    });
  });

  it('shows the claim and in-progress label with the open PR', () => {
    const rows = buildRows(
      parseIssues(fixture('issues-claimed.json')),
      parsePullRequests(fixture('prs-pending.json')),
      [],
    );
    expect(rows[0]).toMatchObject({
      number: 2,
      assignee: 'GravionLabs',
      labels: ['in-progress'],
      branch: 'feat/2-deliver-board',
      url: 'https://github.com/GravionLabs/herdr-plugins/pull/40',
    });
    expect(rows[0]?.pr?.checks.state).toBe('pending');
  });

  it('prefers the open PR over a newer merged one of the same issue', () => {
    const prs = parsePullRequests(
      JSON.stringify([
        {
          number: 50,
          headRefName: 'fix/9-a',
          state: 'MERGED',
          url: 'u50',
          statusCheckRollup: [],
        },
        {
          number: 41,
          headRefName: 'fix/9-b',
          state: 'OPEN',
          url: 'u41',
          statusCheckRollup: [],
        },
      ]),
    );
    const [row] = buildRows([{ number: 9, title: 't', assignees: [], labels: [], url: 'i9' }], prs, []);
    expect(row?.pr?.number).toBe(41);
  });

  it('returns no rows without issues', () => {
    expect(buildRows([], parsePullRequests(fixture('prs.json')), [])).toEqual([]);
  });
});
