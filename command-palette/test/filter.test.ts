import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/entries.ts';
import { filterEntries, matchPositions } from '../lib/filter.ts';

const e = (title: string): Entry => ({ id: title, group: 'g', title });
const titles = (list: Entry[]) => list.map((x) => x.title);

describe('filterEntries', () => {
  it('keeps everything for an empty query', () => {
    expect(titles(filterEntries([e('a'), e('b')], ''))).toEqual(['a', 'b']);
  });

  it('matches case-insensitively', () => {
    expect(titles(filterEntries([e('Deliver-Log')], 'DELIVER'))).toEqual(['Deliver-Log']);
  });

  it('filters out entries without a match', () => {
    expect(filterEntries([e('deliver-log')], 'xyz')).toEqual([]);
  });

  it('ranks prefix before word-start before scattered', () => {
    const list = [e('dxlx'), e('xx-d-l-y'), e('dl-tool')];
    expect(titles(filterEntries(list, 'dl'))).toEqual(['dl-tool', 'xx-d-l-y', 'dxlx']);
  });

  it('ranks deliver-log (word starts) before delete (scattered) for dl', () => {
    expect(titles(filterEntries([e('delete'), e('deliver-log')], 'dl'))).toEqual(['deliver-log', 'delete']);
  });

  it('keeps input order within a tier', () => {
    expect(titles(filterEntries([e('beta'), e('bravo')], 'b'))).toEqual(['beta', 'bravo']);
  });
});

describe('matchPositions', () => {
  it('returns the matched indexes', () => {
    expect(matchPositions(e('deliver-log'), 'dl')).toEqual([0, 8]);
    expect(matchPositions(e('deliver'), 'del')).toEqual([0, 1, 2]);
    expect(matchPositions(e('abc'), 'ac')).toEqual([0, 2]);
  });

  it('returns null without a match and [] for an empty query', () => {
    expect(matchPositions(e('abc'), 'z')).toBeNull();
    expect(matchPositions(e('abc'), '')).toEqual([]);
  });
});
