import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/entries.ts';
import { filterEntries } from '../lib/filter.ts';
import { entryKey, prune, readState, record, score, writeState } from '../lib/recent.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000 * DAY;
const action = (plugin: string, id: string, title: string): Entry => ({
  id: `${plugin}.${id}`,
  group: plugin,
  title,
  run: { kind: 'action', plugin, action: id },
});
const cfg = (title: string): Entry => ({ id: 'config.0', group: 'config', title, run: { kind: 'command', command: ['x'] } });
const titles = (list: Entry[]) => list.map((x) => x.title);
const tmp = () => mkdtempSync(join(tmpdir(), 'recent-'));

describe('entryKey', () => {
  it('names action and config entries', () => {
    expect(entryKey(action('deliver-log', 'open', 'x'))).toBe('action:deliver-log.open');
    expect(entryKey(cfg('show log'))).toBe('config:show log');
  });
  it('is null for an entry without run', () => {
    expect(entryKey({ id: 'a', group: 'g', title: 't' })).toBeNull();
  });
});

describe('score', () => {
  it('is 0 without usage', () => {
    expect(score(undefined, NOW)).toBe(0);
  });
  it('equals the count for a use right now', () => {
    expect(score({ count: 3, last: NOW }, NOW)).toBe(3);
  });
  it('halves after 7 days', () => {
    expect(score({ count: 4, last: NOW - 7 * DAY }, NOW)).toBe(2);
  });
  it('lets a fresh single use beat many old uses', () => {
    expect(score({ count: 1, last: NOW }, NOW)).toBeGreaterThan(score({ count: 5, last: NOW - 30 * DAY }, NOW));
  });
  it('does not grow for a last use in the future', () => {
    expect(score({ count: 2, last: NOW + DAY }, NOW)).toBe(2);
  });
});

describe('record and prune', () => {
  it('starts at 1 and increments with the last use', () => {
    const once = record({}, 'k', 10);
    expect(once).toEqual({ k: { count: 1, last: 10 } });
    expect(record(once, 'k', 20)).toEqual({ k: { count: 2, last: 20 } });
  });
  it('does not mutate the input', () => {
    const state = { k: { count: 1, last: 1 } };
    record(state, 'k', 2);
    expect(state).toEqual({ k: { count: 1, last: 1 } });
  });
  it('drops keys that no longer exist', () => {
    const state = { a: { count: 1, last: 1 }, b: { count: 2, last: 2 } };
    expect(prune(state, ['b'])).toEqual({ b: { count: 2, last: 2 } });
  });
});

describe('ordering', () => {
  const a = action('p', 'a', 'alpha');
  const b = action('p', 'b', 'beta');
  const c = cfg('gamma');
  const recent = { 'action:p.b': { count: 1, last: NOW }, 'config:gamma': { count: 3, last: NOW } };

  it('keeps the normal order without history', () => {
    expect(titles(filterEntries([a, b, c], '', {}, NOW))).toEqual(['alpha', 'beta', 'gamma']);
  });
  it('puts used entries first by score, unused after in normal order', () => {
    expect(titles(filterEntries([a, b, c], '', recent, NOW))).toEqual(['gamma', 'beta', 'alpha']);
  });
  it('is deterministic for a given now', () => {
    const old = { 'action:p.a': { count: 2, last: NOW - 14 * DAY }, 'action:p.b': { count: 1, last: NOW } };
    expect(titles(filterEntries([a, b], '', old, NOW))).toEqual(['beta', 'alpha']);
    expect(titles(filterEntries([a, b], '', old, NOW - 14 * DAY))).toEqual(['alpha', 'beta']);
  });
  it('uses usage only as tie-break within a filter score', () => {
    const prefix = action('p', 'x', 'dl-tool');
    const scattered = action('p', 'y', 'dxlx');
    const used = { 'action:p.y': { count: 9, last: NOW } };
    expect(titles(filterEntries([scattered, prefix], 'dl', used, NOW))).toEqual(['dl-tool', 'dxlx']);
    const p2 = action('p', 'z', 'dl-other');
    expect(titles(filterEntries([prefix, p2], 'dl', { 'action:p.z': { count: 1, last: NOW } }, NOW))).toEqual(['dl-other', 'dl-tool']);
  });
});

describe('state file', () => {
  it('round-trips and leaves no tmp file', () => {
    const dir = tmp();
    const state = { k: { count: 2, last: 5 } };
    expect(writeState(dir, state)).toBe(true);
    expect(readState(dir)).toEqual(state);
    expect(existsSync(join(dir, 'recent.json.tmp'))).toBe(false);
  });
  it('treats a missing file or dir as empty', () => {
    expect(readState(tmp())).toEqual({});
    expect(readState(undefined)).toEqual({});
  });
  it('treats corrupt content as empty and rewrites it', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'recent.json'), '{not json');
    expect(readState(dir)).toEqual({});
    writeFileSync(join(dir, 'recent.json'), '[1,2]');
    expect(readState(dir)).toEqual({});
    expect(writeState(dir, record({}, 'k', 1))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'recent.json'), 'utf8'))).toEqual({ k: { count: 1, last: 1 } });
  });
  it('skips invalid records', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'recent.json'), JSON.stringify({ ok: { count: 1, last: 2 }, bad: { count: 'x' }, worse: 3 }));
    expect(readState(dir)).toEqual({ ok: { count: 1, last: 2 } });
  });
  it('keeps the old file when the tmp write fails', () => {
    const dir = tmp();
    writeState(dir, { k: { count: 1, last: 1 } });
    mkdirSync(join(dir, 'recent.json.tmp'));
    expect(writeState(dir, { k: { count: 9, last: 9 } })).toBe(false);
    expect(readState(dir)).toEqual({ k: { count: 1, last: 1 } });
  });
  it('ignores a failing write (missing or read-only dir)', () => {
    expect(writeState(join(tmp(), 'nope'), {})).toBe(false);
    expect(writeState(undefined, {})).toBe(false);
    const ro = tmp();
    chmodSync(ro, 0o500);
    expect(() => writeState(ro, {})).not.toThrow();
  });
});
