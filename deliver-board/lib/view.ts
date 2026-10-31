// Key mapping and text rendering of the board popup. Pure: input bytes in, lines out.
import { formatChecks, type Row } from './board.ts';

export type KeyAction = 'up' | 'down' | 'refresh' | 'quit' | 'open';

export function keyAction(data: string): KeyAction | null {
  switch (data) {
    case 'q':
    case '\x1b':
    case '\x03':
      return 'quit';
    case 'r':
      return 'refresh';
    case '\r':
    case '\n':
      return 'open';
    case 'k':
    case '\x1b[A':
    case '\x1bOA':
      return 'up';
    case 'j':
    case '\x1b[B':
    case '\x1bOB':
      return 'down';
    default:
      return null;
  }
}

export function moveSelection(selected: number, action: KeyAction, rowCount: number): number {
  if (rowCount === 0) return 0;
  if (action === 'up') return Math.max(0, selected - 1);
  if (action === 'down') return Math.min(rowCount - 1, selected + 1);
  return Math.min(selected, rowCount - 1);
}

function fit(value: string, width: number): string {
  if (width <= 0) return '';
  if (value.length > width) return `${value.slice(0, Math.max(0, width - 1))}…`;
  return value.padEnd(width);
}

export function prCell(row: Row): string {
  if (!row.pr) return '';
  const state = row.pr.state === 'OPEN' ? '' : ` ${row.pr.state.toLowerCase()}`;
  return `#${row.pr.number}${state}`;
}

export function rowCells(row: Row): string[] {
  return [
    `#${row.number}`,
    row.title.replace(/^\[PBI\]\s*/, ''),
    row.assignee || '-',
    row.labels.join(' '),
    row.branch ?? '-',
    prCell(row) || '-',
    row.pr ? formatChecks(row.pr.checks) : '-',
  ];
}

const HEADERS = ['PBI', 'Title', 'Assignee', 'Labels', 'Branch', 'PR', 'Checks'];

// Lines of the board for a terminal of `width` columns; the selected row is marked with `>`.
export function renderBoard(rows: Row[], selected: number, width: number, status: string): string[] {
  const cells = rows.map(rowCells);
  const widths = HEADERS.map((header, i) => Math.max(header.length, ...cells.map((c) => (c[i] ?? '').length)));
  const TITLE = 1;
  const others = widths.reduce((sum, w, i) => (i === TITLE ? sum : sum + w), 0);
  const gaps = 2 + (HEADERS.length - 1) * 2;
  widths[TITLE] = Math.max(10, Math.min(widths[TITLE] ?? 10, width - others - gaps));
  const line = (values: string[], marker: string): string =>
    `${marker} ${values.map((v, i) => fit(v, widths[i] ?? 0)).join('  ')}`.trimEnd().slice(0, width);
  const lines = [line(HEADERS, ' ')];
  if (rows.length === 0) lines.push('  No open issues labelled pbi.');
  cells.forEach((c, i) => lines.push(line(c, i === selected ? '>' : ' ')));
  lines.push('', status, 'Enter open  r refresh  j/k move  q/Esc close');
  return lines;
}
