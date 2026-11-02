// Review file of `deliver` (schema/deliver-review.schema.json, source commit d6953b2): branch name, validation, rendering, keys. Pure.

export type Finding = { file: string; line: number; title: string; why: string };
export type Review = {
  pbi: number;
  branch: string;
  sha: string;
  round: number;
  unmet: string[];
  review: { blocking: Finding[]; notes: string[] };
};

// The PBI number of a branch `<type>/<nr>-<slug>`, else null.
export function pbiFromBranch(branch: string): number | null {
  const match = /^[a-z][a-z0-9-]*\/(\d+)-/.exec(branch.trim());
  return match ? Number(match[1]) : null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function strings(value: unknown, path: string): string | null {
  if (!Array.isArray(value)) return `${path} must be an array`;
  const bad = value.findIndex((v) => !isText(v));
  return bad >= 0 ? `${path}[${bad}] must be a non-empty string` : null;
}

function exact(obj: Record<string, unknown>, keys: string[], path: string): string | null {
  for (const key of keys) if (!(key in obj)) return `${path}: missing required property "${key}"`;
  const extra = Object.keys(obj).find((k) => !keys.includes(k));
  return extra ? `${path}: unexpected property "${extra}"` : null;
}

// Validation per deliver-review.schema.json and review.schema.json; returns the first error.
export function validateReview(data: unknown): string | null {
  if (!isObject(data)) return 'review must be an object';
  const shape = exact(data, ['pbi', 'branch', 'sha', 'round', 'unmet', 'review'], 'review');
  if (shape) return shape;
  if (!isInt(data.pbi, 1)) return 'pbi must be an integer >= 1';
  if (!isText(data.branch)) return 'branch must be a non-empty string';
  if (typeof data.sha !== 'string' || !/^[0-9a-f]{7,64}$/.test(data.sha)) return 'sha must match ^[0-9a-f]{7,64}$';
  if (!isInt(data.round, 1)) return 'round must be an integer >= 1';
  const unmet = strings(data.unmet, 'unmet');
  if (unmet) return unmet;
  const inner = data.review;
  if (!isObject(inner)) return 'review.review must be an object';
  const innerShape = exact(inner, ['blocking', 'notes'], 'review.review');
  if (innerShape) return innerShape;
  if (!Array.isArray(inner.blocking)) return 'review.blocking must be an array';
  for (const [i, item] of inner.blocking.entries()) {
    const path = `review.blocking[${i}]`;
    if (!isObject(item)) return `${path} must be an object`;
    const itemShape = exact(item, ['file', 'line', 'title', 'why'], path);
    if (itemShape) return itemShape;
    if (!isText(item.file)) return `${path}.file must be a non-empty string`;
    if (!isInt(item.line, 1)) return `${path}.line must be an integer >= 1`;
    if (!isText(item.title)) return `${path}.title must be a non-empty string`;
    if (!isText(item.why)) return `${path}.why must be a non-empty string`;
  }
  return strings(inner.notes, 'review.notes');
}

export type Parsed = { ok: true; review: Review } | { ok: false; error: string };

export function parseReview(text: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const error = validateReview(data);
  return error ? { ok: false, error } : { ok: true, review: data as Review };
}

// Stale: the review was made for another commit than the branch's HEAD (abbreviated shas compare by prefix).
export function isStale(sha: string, head: string): boolean {
  const a = sha.toLowerCase();
  const b = head.trim().toLowerCase();
  return !(b.startsWith(a) || a.startsWith(b));
}

// One review file of the repository, listed when the pane's branch has no PBI number (the deliver pane on release/next).
// `review` is null for an unreadable or invalid file (`error` says why); `toplevel` is the worktree of its branch.
export type Entry = {
  pbi: number;
  file: string;
  review: Review | null;
  error?: string;
  stale: boolean;
  toplevel: string | null;
};

export type State =
  | { kind: 'message'; lines: string[] }
  // `back`: the list it was opened from; `toplevel`: where its findings open (else the pane's)
  | { kind: 'review'; review: Review; stale: boolean; selected: number; back?: State; toplevel?: string | null }
  // `from`: the pane's branch
  | { kind: 'pick'; entries: Entry[]; selected: number; from: string };

export const message = (...lines: string[]): State => ({ kind: 'message', lines });

export const header = (review: Review, stale: boolean): string =>
  `#${review.pbi} round ${review.round}${stale ? `  STALE: reviewed ${review.sha.slice(0, 7)}, branch has moved on` : ''}`;

// One line of the list: `#<pbi>  round <n>  <branch>  [STALE]`, or the reason the file cannot be shown.
export const entryLine = (e: Entry): string =>
  e.review
    ? `#${e.pbi}  round ${e.review.round}  ${e.review.branch}${e.stale ? '  STALE' : ''}`
    : `#${e.pbi}  invalid: ${e.error ?? 'unreadable'}`;

// Rendered lines; the selected list entry or blocking finding is marked with `>`.
export function render(state: State, width = 100): string[] {
  if (state.kind === 'message') return [...state.lines, '', 'Press q or Esc to close.'];
  const cut = (s: string): string => (s.length > width ? `${s.slice(0, Math.max(1, width - 1))}…` : s);
  if (state.kind === 'pick') {
    return [
      cut(`deliver reviews in this repository (pane on ${state.from}, no PBI number), newest first`),
      '',
      ...state.entries.map((e, i) => cut(`${i === state.selected ? '>' : ' '} ${entryLine(e)}`)),
      '',
      'Up/Down: select, Enter: show, q: close.',
    ];
  }
  const { review, stale, selected, back } = state;
  const lines = [header(review, stale), ''];
  const { blocking, notes } = review.review;
  lines.push(`Unmet criteria (${review.unmet.length})`);
  lines.push(...(review.unmet.length ? review.unmet.map((u) => cut(`  - ${u}`)) : ['  none']));
  lines.push('', `Blocking findings (${blocking.length})`);
  if (!blocking.length) lines.push('  none');
  blocking.forEach((f, i) => {
    lines.push(cut(`${i === selected ? '>' : ' '} ${f.file}:${f.line} — ${f.title}`));
    lines.push(cut(`      ${f.why}`));
  });
  lines.push('', `Notes (${notes.length})`);
  lines.push(...(notes.length ? notes.map((n) => cut(`  - ${n}`)) : ['  none']));
  const keys = blocking.length ? 'Up/Down: select, Enter: open in $EDITOR, ' : '';
  lines.push('', `${keys}${back ? 'b: back to the list, ' : ''}q${blocking.length ? '' : ' or Esc'}: close.`);
  return lines;
}

export type Key = 'quit' | 'up' | 'down' | 'open' | 'back' | null;

export function keyAction(data: string): Key {
  if (data === 'q' || data === '\x1b' || data === '\x03') return 'quit';
  if (data === '\x1b[A' || data === 'k') return 'up';
  if (data === '\x1b[B' || data === 'j') return 'down';
  if (data === '\r' || data === '\n') return 'open';
  if (data === 'b' || data === '\x7f' || data === '\b') return 'back';
  return null;
}

export function move(state: State, key: Key): State {
  if (key !== 'up' && key !== 'down') return state;
  const count =
    state.kind === 'review' ? state.review.review.blocking.length : state.kind === 'pick' ? state.entries.length : 0;
  if (state.kind === 'message' || count === 0) return state;
  const selected = Math.min(count - 1, Math.max(0, state.selected + (key === 'up' ? -1 : 1)));
  return { ...state, selected };
}

// Enter on the list: the selected review, with the way back; an invalid entry stays in the list.
export function choose(state: State): State {
  if (state.kind !== 'pick') return state;
  const entry = state.entries[state.selected];
  if (!entry?.review) return state;
  return { kind: 'review', review: entry.review, stale: entry.stale, selected: 0, back: state, toplevel: entry.toplevel };
}

// b/Backspace in a review opened from the list: the list again, same selection.
export const back = (state: State): State => (state.kind === 'review' && state.back ? state.back : state);

const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

// Shell line for the split pane: `$EDITOR +<line> <file>`; `editor` falls back to vi.
export function editorCommand(editor: string | undefined, path: string, line: number): string {
  return `${editor && editor.trim() ? editor.trim() : 'vi'} +${line} ${quote(path)}`;
}
