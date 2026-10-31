// State of the palette and its key handling. Pure; the terminal side lives in bin/palette.ts.
import type { Entry } from './entries.ts';
import { filterEntries } from './filter.ts';
import type { RecentState } from './recent.ts';

export type State = {
  entries: Entry[];
  recent: RecentState;
  now: number;
  query: string;
  matches: Entry[];
  selected: number;
  // 'open' keeps running, 'cancel' closes, 'pick' closes with `picked` set.
  status: 'open' | 'cancel' | 'pick';
  picked: Entry | null;
  // One line shown under the query, e.g. a config problem.
  hint: string | null;
};

export const initialState = (
  entries: Entry[],
  hint: string | null = null,
  recent: RecentState = {},
  now: number = 0,
): State => ({
  entries,
  recent,
  now,
  query: '',
  matches: filterEntries(entries, '', recent, now),
  selected: 0,
  status: 'open',
  picked: null,
  hint,
});

const withQuery = (state: State, query: string): State => ({
  ...state,
  query,
  matches: filterEntries(state.entries, query, state.recent, state.now),
  selected: 0,
});

const move = (state: State, delta: number): State => ({
  ...state,
  selected: Math.max(0, Math.min(state.matches.length - 1, state.selected + delta)),
});

// One chunk of terminal input.
export function applyKey(state: State, key: string): State {
  if (key === '\x1b' || key === '\x03') return { ...state, status: 'cancel' };
  if (key === '\r' || key === '\n') {
    const picked = state.matches[state.selected];
    return picked ? { ...state, status: 'pick', picked } : state;
  }
  if (key === '\x1b[A' || key === '\x10') return move(state, -1);
  if (key === '\x1b[B' || key === '\x0e') return move(state, 1);
  if (key === '\x7f' || key === '\b') return withQuery(state, [...state.query].slice(0, -1).join(''));
  if (key.startsWith('\x1b')) return state;
  const printable = [...key].filter((c) => c >= ' ' && c !== '\x7f').join('');
  return printable ? withQuery(state, state.query + printable) : state;
}
