import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(join(import.meta.dirname, '..', 'docs/guide/keybindings.md'), 'utf8');

describe('keybindings page', () => {
  it('does not suggest invoking link-trim.open by hand', () => {
    expect(page).not.toContain('action invoke link-trim.open');
  });

  it('names the actions that cannot be invoked by hand', () => {
    expect(page).toContain('`link-trim.open`, `deliver-starter.start-link`');
  });
});
