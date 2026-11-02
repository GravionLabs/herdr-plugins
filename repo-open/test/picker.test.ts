import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Repo } from '../lib/discover.ts';
import { filterRepos, matchRepo } from '../lib/filter.ts';
import { openPickerArgs } from '../lib/host.ts';
import { applyKey, initialState, type State } from '../lib/keys.ts';
import { prune, readState, record, score, writeState } from '../lib/recent.ts';
import { render } from '../lib/view.ts';

const repo = (rel: string): Repo => {
  const name = rel.split('/').pop()!;
  return { name, path: `/src/${rel}`, rel };
};
const repos = [repo('gravionlabs/herdr-plugins'), repo('gravionlabs/skills'), repo('poimen'), repo('other/hello-world')];
const names = (list: Repo[]): string[] => list.map((r) => r.name);
const type = (state: State, text: string): State => [...text].reduce(applyKey, state);
const strip = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');
const DAY = 24 * 60 * 60 * 1000;

describe('matchRepo and filterRepos', () => {
  it('ranks a name prefix before word starts before scattered letters', () => {
    const list = [repo('a/xhxp'), repo('a/hello-plugins'), repo('a/hp')];
    expect(names(filterRepos(list, 'hp'))).toEqual(['hp', 'hello-plugins', 'xhxp']);
  });

  it('matches case-insensitively on the name or the relative path', () => {
    expect(names(filterRepos(repos, 'SKI'))).toEqual(['skills']);
    expect(names(filterRepos(repos, 'gravion'))).toEqual(['herdr-plugins', 'skills']);
    expect(matchRepo(repos[0]!, 'gravion')).toEqual({ tier: 0, field: 'rel', positions: [0, 1, 2, 3, 4, 5, 6] });
  });

  it('prefers the name on a tie', () => {
    expect(matchRepo(repo('poimen'), 'p')?.field).toBe('name');
  });

  it('returns nothing without a match', () => {
    expect(filterRepos(repos, 'zzz')).toEqual([]);
    expect(matchRepo(repos[0]!, 'zzz')).toBeNull();
  });

  it('puts used repositories first by frecency with an empty query', () => {
    const now = 100 * DAY;
    const recent = { '/src/poimen': { count: 1, last: now }, '/src/other/hello-world': { count: 8, last: now - 14 * DAY } };
    expect(names(filterRepos(repos, '', recent, now))).toEqual(['hello-world', 'poimen', 'herdr-plugins', 'skills']);
  });

  it('uses frecency only to break ties of equal match quality', () => {
    const recent = { '/src/gravionlabs/skills': { count: 5, last: 0 } };
    expect(names(filterRepos(repos, 'gravion', recent, 0))).toEqual(['skills', 'herdr-plugins']);
    expect(names(filterRepos(repos, 'herdr', recent, 0))).toEqual(['herdr-plugins']);
  });
});

describe('applyKey', () => {
  it('filters while typing and widens again on Backspace', () => {
    let s = type(initialState(repos), 'sk');
    expect(names(s.matches)).toEqual(['skills']);
    s = applyKey(applyKey(s, '\x7f'), '\x7f');
    expect(s.matches).toHaveLength(4);
  });

  it('moves with Up, Down, Ctrl+P and Ctrl+N within the list', () => {
    let s = initialState(repos);
    s = applyKey(s, '\x1b[A');
    expect(s.selected).toBe(0);
    s = applyKey(applyKey(applyKey(s, '\x1b[B'), '\x0e'), '\x0e');
    expect(s.selected).toBe(3);
    s = applyKey(applyKey(s, '\x1b[B'), '\x10');
    expect(s.selected).toBe(2);
  });

  it('picks the selection on Enter', () => {
    const s = applyKey(applyKey(initialState(repos), '\x1b[B'), '\r');
    expect(s.status).toBe('pick');
    expect(s.picked).toEqual(repos[1]);
  });

  it('ignores Enter without a match', () => {
    expect(applyKey(type(initialState(repos), 'zzz'), '\r').status).toBe('open');
  });

  it('cancels on Escape and Ctrl+C and ignores other escape sequences', () => {
    expect(applyKey(initialState(repos), '\x1b').status).toBe('cancel');
    expect(applyKey(initialState(repos), '\x03').status).toBe('cancel');
    expect(applyKey(initialState(repos), '\x1b[C')).toEqual(initialState(repos));
  });
});

describe('render', () => {
  it('shows the query, the hint and rows as "<name>  <relative path>"', () => {
    const lines = render(initialState(repos, { hint: 'config.json: invalid JSON' }), 5, 60).map(strip);
    expect(lines).toEqual([
      '> █',
      '  config.json: invalid JSON',
      '> herdr-plugins  gravionlabs/herdr-plugins',
      '  skills  gravionlabs/skills',
      '  poimen',
    ]);
  });

  it('shows the empty message without repositories and No matches without a match', () => {
    expect(render(initialState([], { empty: 'No repositories below /src' }), 5, 60).map(strip)).toEqual([
      '> █',
      '  No repositories below /src',
    ]);
    expect(render(type(initialState(repos), 'zzz'), 5, 60).map(strip)).toEqual(['> zzz█', '  No matches']);
  });

  it('scrolls so the selection stays visible', () => {
    const s = ['\x1b[B', '\x1b[B', '\x1b[B'].reduce(applyKey, initialState(repos));
    expect(strip(render(s, 3, 60).at(-1)!)).toBe('> hello-world  other/hello-world');
  });

  it('highlights the matched characters in the field that matched', () => {
    const line = render(type(initialState(repos), 'grav'), 3, 60)[1]!;
    expect(line).toContain('\x1b[1;33mg\x1b[0m');
    expect(strip(line)).toBe('> herdr-plugins  gravionlabs/herdr-plugins');
    const nameHit = render(type(initialState(repos), 'po'), 3, 60)[1]!;
    expect(nameHit.startsWith('\x1b[7m> \x1b[1;33mp\x1b[0m')).toBe(true);
  });

  it('truncates rows to the width', () => {
    const lines = render(initialState(repos), 3, 12).map(strip);
    expect(lines[1]).toBe('> herdr-plug');
  });
});

describe('recent', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'repo-open-recent-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('halves the score every 7 days', () => {
    expect(score(undefined, 0)).toBe(0);
    expect(score({ count: 4, last: 0 }, 7 * DAY)).toBe(2);
  });

  it('records, prunes and round-trips through recent.json', () => {
    const state = prune(record(record({ '/gone': { count: 1, last: 0 } }, '/a', 1), '/a', 2), ['/a']);
    expect(state).toEqual({ '/a': { count: 2, last: 2 } });
    expect(writeState(dir, state)).toBe(true);
    expect(readState(dir)).toEqual(state);
    expect(JSON.parse(readFileSync(join(dir, 'recent.json'), 'utf8'))).toEqual(state);
  });

  it('treats a missing or corrupt file as empty and skips invalid records', () => {
    expect(readState(dir)).toEqual({});
    expect(readState(undefined)).toEqual({});
    writeFileSync(join(dir, 'recent.json'), '{');
    expect(readState(dir)).toEqual({});
    writeFileSync(join(dir, 'recent.json'), JSON.stringify({ '/a': { count: 1, last: 3 }, '/b': { count: 0, last: 1 } }));
    expect(readState(dir)).toEqual({ '/a': { count: 1, last: 3 } });
    expect(writeState(undefined, {})).toBe(false);
  });
});

describe('openPickerArgs', () => {
  it('opens the picker pane of the plugin', () => {
    expect(openPickerArgs('repo-open')).toEqual(['plugin', 'pane', 'open', '--plugin', 'repo-open', '--entrypoint', 'picker']);
  });
});
