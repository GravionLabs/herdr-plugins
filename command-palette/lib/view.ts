// Renders the palette as lines of at most `cols` visible characters, `rows` lines at most.
import { matchPositions } from './filter.ts';
import type { State } from './keys.ts';

const HIGHLIGHT = '\x1b[1;33m';
const REVERSE = '\x1b[7m';
const RESET = '\x1b[0m';
const SEP = ' · ';

function row(group: string, title: string, positions: number[], cols: number, selected: boolean): string {
  const full = `${group}${SEP}${title}`;
  const shown = [...full].slice(0, Math.max(0, cols - 2));
  const hit = new Set(positions.map((p) => p + group.length + SEP.length));
  let text = '';
  shown.forEach((ch, i) => {
    text += hit.has(i) ? `${HIGHLIGHT}${ch}${RESET}${selected ? REVERSE : ''}` : ch;
  });
  return selected ? `${REVERSE}> ${text}${RESET}` : `  ${text}`;
}

export function render(state: State, rows: number, cols: number): string[] {
  const lines = [`> ${state.query}█`];
  if (state.hint && rows > 2) lines.push(`  ${[...state.hint].slice(0, Math.max(0, cols - 2)).join('')}`);
  const visible = Math.max(0, rows - lines.length);
  if (state.matches.length === 0) {
    lines.push(state.entries.length === 0 ? '  No plugin actions found' : '  No matches');
    return lines.slice(0, Math.max(1, rows));
  }
  const start = Math.max(0, state.selected - visible + 1);
  state.matches.slice(start, start + visible).forEach((entry, i) => {
    const positions = matchPositions(entry, state.query) ?? [];
    lines.push(row(entry.group, entry.title, positions, cols, start + i === state.selected));
  });
  return lines;
}
