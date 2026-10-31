import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { herdrPlatform, parseActions } from '../lib/actions.ts';
import { initialState } from '../lib/keys.ts';
import { render } from '../lib/view.ts';

const fixture = readFileSync(new URL('./fixtures/action-list.json', import.meta.url), 'utf8');

describe('parseActions', () => {
  it('builds <plugin_id> · <title> entries from the real action list', () => {
    const entries = parseActions(fixture, 'macos');
    expect(entries).toHaveLength(7);
    expect(entries[0]).toEqual({
      id: 'deliver-board.open',
      group: 'deliver-board',
      title: 'Open the deliver board',
      run: { kind: 'action', plugin: 'deliver-board', action: 'open' },
    });
  });

  it('leaves out the palette own action', () => {
    expect(parseActions(fixture, 'macos').map((e) => e.id)).not.toContain('command-palette.open');
  });

  it('leaves out actions of another platform', () => {
    expect(parseActions(fixture, 'macos').map((e) => e.group)).not.toContain('win-only');
    expect(parseActions(fixture, 'windows').map((e) => e.group)).toEqual(['win-only']);
  });

  it.each(['', 'not json', '{}', '{"result":{"actions":"x"}}', 'null', '{"result":{"actions":[1,null,{}]}}'])(
    'returns no entries for %j',
    (input) => {
      expect(parseActions(input, 'macos')).toEqual([]);
    },
  );

  it('maps node platforms to herdr names', () => {
    expect(herdrPlatform('darwin')).toBe('macos');
    expect(herdrPlatform('linux')).toBe('linux');
  });

  it('shows No plugin actions found for an empty list', () => {
    expect(render(initialState([]), 5, 40)).toEqual(['> █', '  No plugin actions found']);
  });
});
