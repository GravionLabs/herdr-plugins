// State of the popup form: one input line and the mode. Pure; the terminal side lives in bin/form.ts.
import type { Mode } from './config.ts';

export type Form = { text: string; mode: Mode; message: string };
export type Step = { form: Form; event: 'submit' | 'cancel' | null };

export const initialForm = (mode: Mode): Form => ({ text: '', mode, message: '' });

const flip = (mode: Mode): Mode => (mode === 'interactive' ? 'unattended' : 'interactive');

// One chunk of terminal input: Enter submits, Escape or Ctrl-C closes, Tab toggles the mode, Backspace deletes.
export function applyKey(form: Form, data: string): Step {
  if (data === '\x1b' || data === '\x03') return { form, event: 'cancel' };
  if (data === '\r' || data === '\n') return { form, event: 'submit' };
  if (data === '\t') return { form: { ...form, mode: flip(form.mode), message: '' }, event: null };
  if (data === '\x7f' || data === '\b') {
    return { form: { ...form, text: form.text.slice(0, -1), message: '' }, event: null };
  }
  if (data.startsWith('\x1b')) return { form, event: null };
  const printable = [...data].filter((c) => c >= ' ' && c !== '\x7f').join('');
  return { form: { ...form, text: form.text + printable, message: printable ? '' : form.message }, event: null };
}

export function render(form: Form): string[] {
  return [
    'Start /deliver',
    '',
    `Arguments: ${form.text}█`,
    `Mode:      ${form.mode}   (Tab: ${flip(form.mode)})`,
    '',
    form.message,
    '',
    'Numbers or --milestone <name>. Enter: start, Esc: close.',
  ];
}
