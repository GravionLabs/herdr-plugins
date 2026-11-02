// State of the popup form: one input line, the mode, the issue suggestions (`#`) and the milestone picker (`@`).
// Pure; the terminal side lives in bin/form.ts.
import type { Mode } from './config.ts';
import {
  activeMilestoneQuery,
  describeMilestone,
  filterMilestones,
  milestoneArgs,
  type Milestone,
} from './milestones.ts';
import { activeQuery, filterIssues, insertNumber, markers, nextLevel, scopeIssues, type Issue, type Level } from './suggest.ts';

export type Form = {
  text: string;
  mode: Mode;
  message: string;
  issues: Issue[]; // loaded suggestions, empty when none or when loading failed
  note: string; // why there are no suggestions (gh failure), shown while `#` is typed
  milestones: Milestone[]; // open milestones, the current one first; empty when none or when loading failed
  milestoneNote: string; // why there are no milestones (gh failure), shown while `@` is typed
  milestone: string | null; // chosen milestone: the `#` list shows only its work items
  level: Level | null; // level filter of the `#` list (Ctrl+L), null for all levels
  closed: boolean; // Esc closed the list until the text changes
  index: number; // highlighted row of the visible list
};
export type Step = { form: Form; event: 'submit' | 'cancel' | null };

type List = { kind: 'issues'; rows: Issue[] } | { kind: 'milestones'; rows: Milestone[] };

const MAX_ROWS = 8;

export const initialForm = (mode: Mode): Form => ({
  text: '',
  mode,
  message: '',
  issues: [],
  note: '',
  milestones: [],
  milestoneNote: '',
  milestone: null,
  level: null,
  closed: false,
  index: 0,
});

const flip = (mode: Mode): Mode => (mode === 'interactive' ? 'unattended' : 'interactive');

// The issue suggestions shown now: `#` is being typed, the list was not closed and something matches the query and
// the level and milestone filters.
export function visibleList(form: Form): Issue[] {
  const query = activeQuery(form.text);
  if (query === null || form.closed) return [];
  return filterIssues(scopeIssues(form.issues, form), query);
}

// The milestones shown now: `@` is being typed, the list was not closed and something matches.
export function visibleMilestones(form: Form): Milestone[] {
  const query = activeMilestoneQuery(form.text);
  if (query === null || form.closed) return [];
  return filterMilestones(form.milestones, query);
}

function activeList(form: Form): List {
  const milestones = visibleMilestones(form);
  return milestones.length > 0 ? { kind: 'milestones', rows: milestones } : { kind: 'issues', rows: visibleList(form) };
}

// Clearing the line also clears the milestone filter.
const edited = (form: Form, text: string, message: string): Form => ({
  ...form,
  text,
  message,
  milestone: text.trim() === '' ? null : form.milestone,
  closed: false,
  index: 0,
});

// An issue picked from the `#` list: with `--milestone` in the line, the single item replaces the whole milestone.
function pickIssue(form: Form, nr: number): Form {
  const text = /^\s*--milestone\b/.test(form.text) ? `${nr} ` : insertNumber(form.text, nr);
  return { ...edited(form, text, ''), milestone: form.milestone };
}

// A milestone picked from the `@` list: the line becomes `--milestone <name>`, the `#` list narrows to it.
const pickMilestone = (form: Form, name: string): Form => ({ ...edited(form, milestoneArgs(name), ''), milestone: name });

// One chunk of terminal input: Enter submits (or picks the highlighted row), Escape closes the list first and the
// popup second, Ctrl-C closes, Tab toggles the mode, Ctrl+L cycles the level filter, Up/Down move in the list,
// Backspace deletes.
export function applyKey(form: Form, data: string): Step {
  const list = activeList(form);
  const count = list.rows.length;
  if (data === '\x03') return { form, event: 'cancel' };
  if (data === '\x1b') {
    if (count > 0) return { form: { ...form, closed: true }, event: null };
    return { form, event: 'cancel' };
  }
  if (data === '\r' || data === '\n') {
    if (count === 0) return { form, event: 'submit' };
    const at = Math.min(form.index, count - 1);
    const next = list.kind === 'milestones' ? pickMilestone(form, list.rows[at]!.title) : pickIssue(form, list.rows[at]!.number);
    return { form: next, event: null };
  }
  if (data === '\x1b[A' || data === '\x1b[B') {
    if (count === 0) return { form, event: null };
    const step = data === '\x1b[A' ? -1 : 1;
    const index = (Math.min(form.index, count - 1) + step + count) % count;
    return { form: { ...form, index }, event: null };
  }
  if (data === '\t') return { form: { ...form, mode: flip(form.mode), message: '' }, event: null };
  if (data === '\x0c') return { form: { ...form, level: nextLevel(form.level), index: 0 }, event: null };
  if (data === '\x7f' || data === '\b') return { form: edited(form, form.text.slice(0, -1), ''), event: null };
  if (data.startsWith('\x1b')) return { form, event: null };
  const printable = [...data].filter((c) => c >= ' ' && c !== '\x7f').join('');
  if (printable === '') return { form, event: null };
  return { form: edited(form, form.text + printable, ''), event: null };
}

function rowLines<T>(form: Form, rows: T[], line: (row: T) => string): string[] {
  const index = Math.min(form.index, rows.length - 1);
  const start = Math.max(0, Math.min(index - Math.floor(MAX_ROWS / 2), rows.length - MAX_ROWS));
  const shown = rows.slice(start, start + MAX_ROWS).map((row, i) => `${start + i === index ? '> ' : '  '}${line(row)}`);
  const more = rows.length > MAX_ROWS ? [`  (${index + 1}/${rows.length})`] : [];
  return [...shown, ...more];
}

const issueLine = (issue: Issue): string => {
  const mark = markers(issue);
  return `#${issue.number} ${issue.level} ${issue.title}${mark ? ` ${mark}` : ''}`;
};

// The active filters of the `#` list, e.g. `Level: PBI (Ctrl+L) · Milestone: 0.4.0`.
export const filterHeader = (form: Form): string =>
  `Level: ${form.level ?? 'all'} (Ctrl+L)${form.milestone !== null ? ` · Milestone: ${form.milestone}` : ''}`;

function suggestionLines(form: Form): string[] {
  const list = activeList(form);
  if (list.kind === 'milestones') return ['', ...rowLines(form, list.rows, describeMilestone)];
  if (activeMilestoneQuery(form.text) !== null && !form.closed) {
    if (form.milestoneNote !== '') return ['', `No milestones: ${form.milestoneNote}`];
    return ['', form.milestones.length === 0 ? 'No open milestones' : 'No matching milestone'];
  }
  if (activeQuery(form.text) === null || form.closed) return [];
  if (list.rows.length > 0) return ['', filterHeader(form), ...rowLines(form, list.rows, issueLine)];
  if (form.note !== '') return ['', `No suggestions: ${form.note}`];
  return ['', filterHeader(form), '  No matching issue'];
}

function helpLine(form: Form): string {
  const list = activeList(form);
  if (list.rows.length === 0) {
    return 'Numbers (# lists open issues) or --milestone <name> (@ lists milestones). Enter: start, Esc: close.';
  }
  return list.kind === 'milestones'
    ? 'Up/Down: select, Enter: insert milestone, Esc: close list.'
    : 'Up/Down: select, Enter: insert number, Ctrl+L: level, Esc: close list.';
}

export function render(form: Form): string[] {
  return [
    'Start /deliver',
    '',
    `Arguments: ${form.text}█`,
    `Mode:      ${form.mode}   (Tab: ${flip(form.mode)})`,
    '',
    form.message,
    ...suggestionLines(form),
    '',
    helpLine(form),
  ];
}
