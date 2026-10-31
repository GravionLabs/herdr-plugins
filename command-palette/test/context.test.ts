import { describe, expect, it } from 'vitest';
import { contextFromJson, parsePaletteContext } from '../lib/context.ts';
import { openPaletteArgs } from '../lib/host.ts';

describe('contextFromJson', () => {
  it('takes pane id and cwd of the focused pane', () => {
    const json = JSON.stringify({ workspace_cwd: '/ws', focused_pane_id: 'w1:p1', focused_pane_cwd: '/repo/sub' });
    expect(contextFromJson(json)).toEqual({ paneId: 'w1:p1', cwd: '/repo/sub' });
  });

  it('falls back to the workspace cwd when the pane has none', () => {
    expect(contextFromJson(JSON.stringify({ workspace_cwd: '/ws', focused_pane_id: 'w1:p1' }))).toEqual({
      paneId: 'w1:p1',
      cwd: '/ws',
    });
  });

  it.each([undefined, '', 'not json', 'null', '[]', '{}', '{"focused_pane_cwd":""}', '{"focused_pane_id":3}'])(
    'returns null for %j',
    (input) => {
      expect(contextFromJson(input)).toBeNull();
    },
  );
});

describe('parsePaletteContext', () => {
  it('reads what the open action passes on', () => {
    expect(parsePaletteContext('{"paneId":"w1:p1","cwd":"/repo"}')).toEqual({ paneId: 'w1:p1', cwd: '/repo' });
  });

  it.each([undefined, '', 'nope', 'null', '[]'])('returns null for %j', (input) => {
    expect(parsePaletteContext(input)).toBeNull();
  });
});

describe('openPaletteArgs', () => {
  it('passes the context as PALETTE_CONTEXT', () => {
    expect(openPaletteArgs('command-palette', '{"cwd":"/r"}')).toEqual([
      'plugin', 'pane', 'open', '--plugin', 'command-palette', '--entrypoint', 'palette',
      '--env', 'PALETTE_CONTEXT={"cwd":"/r"}',
    ]);
  });

  it('opens without --env when there is no context', () => {
    expect(openPaletteArgs('command-palette', null)).toEqual([
      'plugin', 'pane', 'open', '--plugin', 'command-palette', '--entrypoint', 'palette',
    ]);
  });
});
