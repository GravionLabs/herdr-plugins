// State of the picker and its key handling. Pure; the terminal side lives in bin/picker.ts.
import type { Repo } from './discover.ts';
import { filterRepos } from './filter.ts';
import type { RecentState } from './recent.ts';

export type State = {
  repos: Repo[];
  recent: RecentState;
  now: number;
  query: string;
  matches: Repo[];
  selected: number;
  // 'open' keeps running, 'cancel' closes, 'pick' closes with `picked` set.
  status: 'open' | 'cancel' | 'pick';
  picked: Repo | null;
  // One line shown under the query, e.g. a config problem.
  hint: string | null;
  // Shown instead of the list when nothing was discovered.
  empty: string;
};

export const initialState = (
  repos: Repo[],
  options: { hint?: string | null; recent?: RecentState; now?: number; empty?: string } = {},
): State => ({
  repos,
  recent: options.recent ?? {},
  now: options.now ?? 0,
  query: '',
  matches: filterRepos(repos, '', options.recent ?? {}, options.now ?? 0),
  selected: 0,
  status: 'open',
  picked: null,
  hint: options.hint ?? null,
  empty: options.empty ?? 'No repositories found',
});

const withQuery = (state: State, query: string): State => ({
  ...state,
  query,
  matches: filterRepos(state.repos, query, state.recent, state.now),
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
