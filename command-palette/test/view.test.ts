import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/entries.ts';
import { applyKey, initialState } from '../lib/keys.ts';
import { render } from '../lib/view.ts';

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const many: Entry[] = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, group: 'grp', title: `item${i}` }));

describe('render', () => {
  it('shows the hint under the query line', () => {
    const lines = render(initialState(many, 'config.json: invalid JSON'), 4, 40).map(strip);
    expect(lines).toEqual(['> █', '  config.json: invalid JSON', '> grp · item0', '  grp · item1']);
  });

  it('shows the query line and rows as "<group> · <title>"', () => {
    const lines = render(initialState(many), 5, 40).map(strip);
    expect(lines).toEqual(['> █', '> grp · item0', '  grp · item1', '  grp · item2', '  grp · item3']);
  });

  it('shows No matches for an empty result', () => {
    const lines = render(applyKey(initialState(many), 'z'), 5, 40).map(strip);
    expect(lines).toEqual(['> z█', '  No matches']);
  });

  it('scrolls so the selection stays visible', () => {
    let s = initialState(many);
    for (let i = 0; i < 7; i++) s = applyKey(s, '\x1b[B');
    const lines = render(s, 4, 40).map(strip);
    expect(lines).toEqual(['> █', '  grp · item5', '  grp · item6', '> grp · item7']);
  });

  it('highlights matched characters', () => {
    const s = applyKey(applyKey(initialState(many), 'i'), 't');
    const line = render(s, 3, 40)[1]!;
    expect(line).toContain('\x1b[1;33mi\x1b[0m');
    expect(line).toContain('\x1b[1;33mt\x1b[0m');
    expect(strip(line)).toBe('> grp · item0');
  });

  it('truncates rows to the width', () => {
    const line = strip(render(initialState(many), 3, 10)[1]!);
    expect(line).toBe('> grp · it');
  });
});
