// Renders the picker as lines of at most `cols` visible characters, `rows` lines at most.
// A row is `<name>  <relative path>`; the path is dimmed, matched characters are highlighted.
import { matchRepo } from './filter.ts';
import type { State } from './keys.ts';
import type { Repo } from './discover.ts';

const HIGHLIGHT = '\x1b[1;33m';
const DIM = '\x1b[2m';
const REVERSE = '\x1b[7m';
const RESET = '\x1b[0m';
const GAP = '  ';

function row(repo: Repo, query: string, cols: number, selected: boolean): string {
  const m = matchRepo(repo, query);
  const offset = m?.field === 'rel' ? repo.name.length + GAP.length : 0;
  const hit = new Set((m?.positions ?? []).map((p) => p + offset));
  const showRel = repo.rel !== repo.name;
  const full = showRel ? `${repo.name}${GAP}${repo.rel}` : repo.name;
  const relStart = repo.name.length + GAP.length;
  const base = selected ? REVERSE : '';
  let text = '';
  [...full].slice(0, Math.max(0, cols - 2)).forEach((ch, i) => {
    const style = showRel && i >= relStart ? `${base}${DIM}` : base;
    if (i === relStart && showRel) text += style;
    text += hit.has(i) ? `${HIGHLIGHT}${ch}${RESET}${style}` : ch;
  });
  return selected ? `${REVERSE}> ${text}${RESET}` : `  ${text}${showRel ? RESET : ''}`;
}

export function render(state: State, rows: number, cols: number): string[] {
  const lines = [`> ${state.query}█`];
  if (state.hint && rows > 2) lines.push(`  ${[...state.hint].slice(0, Math.max(0, cols - 2)).join('')}`);
  const visible = Math.max(0, rows - lines.length);
  if (state.matches.length === 0) {
    lines.push(`  ${state.repos.length === 0 ? state.empty : 'No matches'}`);
    return lines.slice(0, Math.max(1, rows));
  }
  const start = Math.max(0, state.selected - visible + 1);
  state.matches.slice(start, start + visible).forEach((repo, i) => {
    lines.push(row(repo, state.query, cols, start + i === state.selected));
  });
  return lines;
}
