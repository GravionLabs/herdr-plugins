import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildData, parseArgs, repoOfRemote, serializeRow } from '../lib/data.ts';
import type { RunFn, RunResult } from '../lib/ghcache.ts';

const fixture = (name: string): string => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const poimen = JSON.parse(fixture('poimen-deliver-board-data-v1.json')) as Record<string, unknown>;
const now = (): Date => new Date('2026-11-02T10:00:00Z');
const cache = { dir: undefined, ttlMs: 0 };

const http = (body: string): RunResult => ({ ok: true, stdout: `HTTP/2.0 200 OK\n\n${body}` });

// Fake runner: answers by command line, records every call so tests can assert nothing writes.
function fake(overrides: Record<string, RunResult> = {}): { run: RunFn; calls: string[] } {
  const calls: string[] = [];
  const answers: Record<string, RunResult> = {
    'git rev-parse --show-toplevel': { ok: true, stdout: '/work/skills\n' },
    'git ls-remote --heads origin': { ok: true, stdout: fixture('ls-remote.txt') },
    'git remote get-url origin': { ok: true, stdout: 'git@github.com:GravionLabs/skills.git\n' },
    ...overrides,
  };
  const run: RunFn = async (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    if (answers[line]) return answers[line];
    if (line.startsWith('gh api -i repos/')) return http(fixture('issues.json').trim().startsWith('[') ? fixture('issues.json') : '[]');
    if (line.startsWith('gh pr list')) return { ok: true, stdout: fixture('prs.json') };
    return { ok: false, code: 1, stderr: `unexpected: ${line}` };
  };
  return { run, calls };
}

// Type shape of a JSON value: object keys with their shapes, arrays by first element; null is compatible with anything.
function shape(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

describe('buildData', () => {
  it('prints the versioned envelope with the rows of the board', async () => {
    const { run } = fake();
    const result = await buildData(run, '/work/skills', cache, now);
    expect(result).toMatchObject({ version: 1, plugin: 'deliver-board', generated: '2026-11-02T10:00:00.000Z' });
    if (!('data' in result)) throw new Error('expected data');
    expect(result.data.repo).toBe('GravionLabs/skills');
    expect(result.data.rows.map((r) => r.number)).toEqual([10, 16, 72, 73]);
    expect(result.data.rows[0]).toEqual({
      number: 10,
      title: '[PBI] feat(jvm): jvm package for Java and Kotlin with jvm-implementation and jvm-test',
      url: 'https://github.com/GravionLabs/skills/issues/10',
      assignee: '',
      labels: ['needs-decision'],
      branch: null,
      pr: null,
    });
  });

  it('only runs read commands', async () => {
    const { run, calls } = fake();
    await buildData(run, '/work/skills', cache, now);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/^(git (rev-parse|ls-remote|remote get-url)|gh (api -i repos\/|pr list))/);
      expect(call).not.toMatch(/-X|--method|--field|-f |edit|merge|create|close/);
    }
  });

  it('matches the shape of the poimen fixture', async () => {
    const { run } = fake({
      'git remote get-url origin': { ok: true, stdout: 'https://github.com/GravionLabs/poimen\n' },
    });
    const result = await buildData(run, '/work/skills', cache, now);
    const keys = (v: unknown): string[] => Object.keys(v as object).sort();
    expect(keys(result)).toEqual(keys(poimen));
    const data = (result as { data: { repo: string; rows: Record<string, unknown>[] } }).data;
    const expected = (poimen.data as { rows: Record<string, unknown>[] }).rows;
    expect(keys(data)).toEqual(keys(poimen.data));
    const withPr = data.rows.find((r) => r.pr !== null);
    expect(withPr).toBeDefined();
    expect(keys(withPr)).toEqual(keys(expected[0]));
    expect(keys(data.rows[0])).toEqual(keys(expected[1]));
    const pr = (withPr as { pr: { checks: unknown } }).pr;
    const expectedPr = expected[0]?.pr as { checks: unknown };
    expect(shape(pr)).toEqual(shape(expectedPr));
    expect(keys(pr.checks)).toEqual(keys(expectedPr.checks));
  });

  it('reports a missing repository as an error object', async () => {
    const { run } = fake({ 'git rev-parse --show-toplevel': { ok: false, code: 128, stderr: 'fatal: not a git repository' } });
    expect(await buildData(run, '/tmp/none', cache, now)).toEqual({
      version: 1,
      plugin: 'deliver-board',
      error: { code: 'not_a_repository', message: 'Not a git repository: /tmp/none' },
    });
  });

  it('reports a missing --cwd as an error object', async () => {
    const { run } = fake();
    expect(await buildData(run, null, cache, now)).toMatchObject({ error: { code: 'invalid_arguments' } });
  });

  it('reports a failing gh as an error object', async () => {
    const { run } = fake({ 'gh pr list --base release/next --state all --limit 100 --json number,headRefName,state,url,statusCheckRollup': { ok: false, code: 4, stderr: 'To get started with GitHub CLI, please run: gh auth login' } });
    expect(await buildData(run, '/work/skills', cache, now)).toEqual({
      version: 1,
      plugin: 'deliver-board',
      error: { code: 'gh_failed', message: 'gh is not authenticated: run `gh auth login`' },
    });
  });

  it('reports a missing gh binary', async () => {
    const { run } = fake({ 'gh pr list --base release/next --state all --limit 100 --json number,headRefName,state,url,statusCheckRollup': { ok: false, code: 'ENOENT', stderr: '' } });
    expect(await buildData(run, '/work/skills', cache, now)).toMatchObject({ error: { code: 'gh_failed', message: expect.stringContaining('gh is not installed') } });
  });

  it('reports unreadable gh output', async () => {
    const { run } = fake({ 'gh pr list --base release/next --state all --limit 100 --json number,headRefName,state,url,statusCheckRollup': { ok: true, stdout: 'not json' } });
    expect(await buildData(run, '/work/skills', cache, now)).toMatchObject({ error: { code: 'invalid_gh_output' } });
  });

  it('reports a rate limit with its own code', async () => {
    const { run } = fake({ 'gh pr list --base release/next --state all --limit 100 --json number,headRefName,state,url,statusCheckRollup': { ok: false, code: 1, stderr: 'API rate limit exceeded' } });
    expect(await buildData(run, '/work/skills', cache, now)).toMatchObject({ error: { code: 'rate_limited' } });
  });

  it('uses a null repo when origin is not a GitHub remote', async () => {
    const { run } = fake({ 'git remote get-url origin': { ok: true, stdout: '/srv/git/x.git\n' } });
    const result = await buildData(run, '/work/skills', cache, now);
    expect(result).toMatchObject({ data: { repo: null } });
  });
});

describe('serializeRow', () => {
  it('drops the head branch of the PR and keeps the check summary', () => {
    const checks = { state: 'failing' as const, passed: 1, failed: 2, pending: 0, skipped: 3 };
    const row = serializeRow({
      number: 7, title: 't', assignee: 'a, b', labels: ['merged'], branch: 'feat/7-x', url: 'u',
      pr: { number: 9, headRefName: 'feat/7-x', state: 'MERGED', url: 'p', checks },
    });
    expect(row.pr).toEqual({ number: 9, url: 'p', state: 'MERGED', checks });
  });
});

describe('repoOfRemote', () => {
  it.each([
    ['git@github.com:GravionLabs/poimen.git', 'GravionLabs/poimen'],
    ['https://github.com/GravionLabs/poimen', 'GravionLabs/poimen'],
    ['https://github.com/GravionLabs/poimen.git/', 'GravionLabs/poimen'],
    ['/srv/git/poimen.git', null],
  ])('%s -> %s', (url, expected) => expect(repoOfRemote(url)).toBe(expected));
});

describe('parseArgs', () => {
  it('reads --cwd in both spellings', () => {
    expect(parseArgs(['--cwd', '/a'])).toEqual({ cwd: '/a' });
    expect(parseArgs(['--cwd=/b'])).toEqual({ cwd: '/b' });
  });
  it('returns null without a value', () => {
    expect(parseArgs([])).toEqual({ cwd: null });
    expect(parseArgs(['--cwd'])).toEqual({ cwd: null });
  });
});
