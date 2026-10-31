// State of the popup form: one input line, the mode and the issue suggestions. Pure; the terminal side lives in bin/form.ts.
import type { Mode } from './config.ts';
import { activeQuery, filterIssues, insertNumber, markers, type Issue } from './suggest.ts';

export type Form = {
  text: string;
  mode: Mode;
  message: string;
  issues: Issue[]; // loaded suggestions, empty when none or when loading failed
  note: string; // why there are no suggestions (gh failure), shown while `#` is typed
  closed: boolean; // Esc closed the list until the text changes
  index: number; // highlighted row of the visible list
};
export type Step = { form: Form; event: 'submit' | 'cancel' | null };

const MAX_ROWS = 8;

export const initialForm = (mode: Mode): Form => ({
  text: '',
  mode,
  message: '',
  issues: [],
  note: '',
  closed: false,
  index: 0,
});

const flip = (mode: Mode): Mode => (mode === 'interactive' ? 'unattended' : 'interactive');

// The suggestions shown now: `#` is being typed, the list was not closed and something matches.
export function visibleList(form: Form): Issue[] {
  const query = activeQuery(form.text);
  if (query === null || form.closed) return [];
  return filterIssues(form.issues, query);
}

const edited = (form: Form, text: string, message: string): Form => ({ ...form, text, message, closed: false, index: 0 });

// One chunk of terminal input: Enter submits (or picks the highlighted suggestion), Escape closes the list first and the
// popup second, Ctrl-C closes, Tab toggles the mode, Up/Down move in the list, Backspace deletes.
export function applyKey(form: Form, data: string): Step {
  const list = visibleList(form);
  if (data === '\x03') return { form, event: 'cancel' };
  if (data === '\x1b') {
    if (list.length > 0) return { form: { ...form, closed: true }, event: null };
    return { form, event: 'cancel' };
  }
  if (data === '\r' || data === '\n') {
    if (list.length === 0) return { form, event: 'submit' };
    const pick = list[Math.min(form.index, list.length - 1)]!;
    return { form: edited(form, insertNumber(form.text, pick.number), ''), event: null };
  }
  if (data === '\x1b[A' || data === '\x1b[B') {
    if (list.length === 0) return { form, event: null };
    const step = data === '\x1b[A' ? -1 : 1;
    const index = (Math.min(form.index, list.length - 1) + step + list.length) % list.length;
    return { form: { ...form, index }, event: null };
  }
  if (data === '\t') return { form: { ...form, mode: flip(form.mode), message: '' }, event: null };
  if (data === '\x7f' || data === '\b') return { form: edited(form, form.text.slice(0, -1), ''), event: null };
  if (data.startsWith('\x1b')) return { form, event: null };
  const printable = [...data].filter((c) => c >= ' ' && c !== '\x7f').join('');
  if (printable === '') return { form, event: null };
  return { form: edited(form, form.text + printable, ''), event: null };
}

function listLines(form: Form, list: Issue[]): string[] {
  const index = Math.min(form.index, list.length - 1);
  const start = Math.max(0, Math.min(index - Math.floor(MAX_ROWS / 2), list.length - MAX_ROWS));
  const rows = list.slice(start, start + MAX_ROWS).map((issue, i) => {
    const mark = markers(issue);
    const line = `#${issue.number} ${issue.level} ${issue.title}${mark ? ` ${mark}` : ''}`;
    return `${start + i === index ? '> ' : '  '}${line}`;
  });
  const more = list.length > MAX_ROWS ? [`  (${index + 1}/${list.length})`] : [];
  return [...rows, ...more];
}

export function render(form: Form): string[] {
  const list = visibleList(form);
  const typing = activeQuery(form.text) !== null && !form.closed;
  const suggestions =
    list.length > 0
      ? ['', ...listLines(form, list)]
      : typing && form.note !== ''
        ? ['', `No suggestions: ${form.note}`]
        : [];
  return [
    'Start /deliver',
    '',
    `Arguments: ${form.text}█`,
    `Mode:      ${form.mode}   (Tab: ${flip(form.mode)})`,
    '',
    form.message,
    ...suggestions,
    '',
    list.length > 0
      ? 'Up/Down: select, Enter: insert number, Esc: close list.'
      : 'Numbers (# lists open issues) or --milestone <name>. Enter: start, Esc: close.',
  ];
}
