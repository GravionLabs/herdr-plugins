import { describe, expect, it } from 'vitest';
import { applyKey, initialForm, render } from '../lib/form.ts';

describe('popup form', () => {
  it('collects typed text and deletes with Backspace', () => {
    let step = applyKey(initialForm('interactive'), '3');
    step = applyKey(step.form, ' 4');
    expect(step.form.text).toBe('3 4');
    expect(applyKey(step.form, '\x7f').form.text).toBe('3 ');
  });

  it('Tab toggles the mode', () => {
    const step = applyKey(initialForm('interactive'), '\t');
    expect(step.form.mode).toBe('unattended');
    expect(applyKey(step.form, '\t').form.mode).toBe('interactive');
  });

  it('Enter submits, Escape and Ctrl-C cancel', () => {
    expect(applyKey(initialForm('interactive'), '\r').event).toBe('submit');
    expect(applyKey(initialForm('interactive'), '\x1b').event).toBe('cancel');
    expect(applyKey(initialForm('interactive'), '\x03').event).toBe('cancel');
  });

  it('ignores escape sequences such as arrow keys', () => {
    const form = initialForm('interactive');
    expect(applyKey(form, '\x1b[A')).toEqual({ form, event: null });
  });

  it('shows text, mode and message', () => {
    const lines = render({ ...initialForm('unattended'), text: '3', message: '#3 is closed' });
    expect(lines.join('\n')).toContain('Arguments: 3');
    expect(lines.join('\n')).toContain('unattended');
    expect(lines).toContain('#3 is closed');
  });
});
