import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/entries.ts';
import { applyKey, initialState, type State } from '../lib/keys.ts';

const entries: Entry[] = ['alpha', 'beta', 'gamma'].map((t) => ({ id: t, group: 'g', title: t }));
const press = (s: State, ...keys: string[]) => keys.reduce(applyKey, s);

describe('applyKey', () => {
  it('starts with the first entry selected', () => {
    const s = initialState(entries);
    expect(s.selected).toBe(0);
    expect(s.matches).toHaveLength(3);
  });

  it('typing filters and preselects the best match', () => {
    const s = press(initialState(entries), 'g', 'a');
    expect(s.query).toBe('ga');
    expect(s.matches.map((m) => m.title)).toEqual(['gamma']);
    expect(s.selected).toBe(0);
  });

  it('Backspace edits the query', () => {
    expect(press(initialState(entries), 'z', '\x7f').matches).toHaveLength(3);
    expect(press(initialState(entries), '\x7f').query).toBe('');
  });

  it('arrows and Ctrl+P/Ctrl+N move within bounds', () => {
    const s = initialState(entries);
    expect(press(s, '\x1b[A').selected).toBe(0);
    expect(press(s, '\x1b[B', '\x1b[B', '\x1b[B', '\x1b[B').selected).toBe(2);
    expect(press(s, '\x0e', '\x0e', '\x10').selected).toBe(1);
  });

  it('Enter picks the selected entry', () => {
    const s = press(initialState(entries), '\x1b[B', '\r');
    expect(s.status).toBe('pick');
    expect(s.picked?.title).toBe('beta');
  });

  it('Enter on an empty list does nothing', () => {
    const s = press(initialState(entries), 'z', '\r');
    expect(s.status).toBe('open');
    expect(s.picked).toBeNull();
  });

  it('Escape and Ctrl+C cancel', () => {
    expect(press(initialState(entries), '\x1b').status).toBe('cancel');
    expect(press(initialState(entries), '\x03').status).toBe('cancel');
  });

  it('ignores unknown escape sequences and control keys', () => {
    const s = initialState(entries);
    expect(press(s, '\x1b[C', '\x01')).toEqual(s);
  });
});
