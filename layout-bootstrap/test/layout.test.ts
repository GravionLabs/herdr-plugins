import { describe, expect, it } from 'vitest';
import { defaultLayout, parseLayout, resolveLayout, testCommandFromConfig } from '../lib/layout.ts';

const custom = JSON.stringify({
  panes: [
    { name: 'agent', command: 'claude' },
    { name: 'logs', command: 'tail -f log', split: { from: 'agent', direction: 'down', ratio: 0.7 } },
  ],
});

describe('defaultLayout', () => {
  it('has agent left at 60 %, tests right top and shell right bottom', () => {
    expect(defaultLayout('npm test')).toEqual({
      panes: [
        { name: 'agent', command: null, split: null },
        { name: 'tests', command: 'npm test', split: { from: 'agent', direction: 'right', ratio: 0.6 } },
        { name: 'shell', command: null, split: { from: 'tests', direction: 'down', ratio: 0.5 } },
      ],
    });
  });
});

describe('testCommandFromConfig', () => {
  it('reads testCommand', () => expect(testCommandFromConfig('{"testCommand":" npm test "}')).toBe('npm test'));
  it('is null for missing file, invalid JSON, empty or non-string values', () => {
    expect(testCommandFromConfig(null)).toBeNull();
    expect(testCommandFromConfig('nope')).toBeNull();
    expect(testCommandFromConfig('{"testCommand":""}')).toBeNull();
    expect(testCommandFromConfig('{"testCommand":3}')).toBeNull();
  });
});

describe('parseLayout', () => {
  it('parses panes and defaults split.from to the previous pane and ratio to 0.5', () => {
    const json = JSON.stringify({
      panes: [{ name: 'a' }, { name: 'b', split: { direction: 'right' } }],
    });
    expect(parseLayout(json).panes[1]).toEqual({
      name: 'b',
      command: null,
      split: { from: 'a', direction: 'right', ratio: 0.5 },
    });
  });

  it.each([
    ['nope', 'invalid JSON'],
    ['{}', '"panes" must be a non-empty list'],
    ['{"panes":[]}', '"panes" must be a non-empty list'],
    ['{"panes":[{}]}', '"name" is required'],
    ['{"panes":[{"name":"a","command":1}]}', '"command" must be a string'],
    ['{"panes":[{"name":"a","split":{}}]}', 'must not have "split"'],
    ['{"panes":[{"name":"a"},{"name":"a","split":{"direction":"right"}}]}', 'duplicate name'],
    ['{"panes":[{"name":"a"},{"name":"b"}]}', '"split" is required'],
    ['{"panes":[{"name":"a"},{"name":"b","split":{"from":"x","direction":"right"}}]}', 'not an earlier pane'],
    ['{"panes":[{"name":"a"},{"name":"b","split":{"direction":"left"}}]}', 'direction'],
    ['{"panes":[{"name":"a"},{"name":"b","split":{"direction":"down","ratio":1}}]}', 'ratio'],
  ])('rejects %s', (json, message) => {
    expect(() => parseLayout(json)).toThrow(message);
  });
});

describe('resolveLayout', () => {
  const none = { repoLayout: null, configLayout: null, config: null };

  it('prefers the repository layout over the config-dir layout', () => {
    const other = '{"panes":[{"name":"x"}]}';
    const resolved = resolveLayout({ ...none, repoLayout: custom, configLayout: other });
    expect(resolved.source).toBe('repository');
    expect(resolved.layout.panes.map((p) => p.name)).toEqual(['agent', 'logs']);
  });

  it('falls back to the config-dir layout, then to the default with the configured test command', () => {
    expect(resolveLayout({ ...none, configLayout: custom }).source).toBe('config');
    const resolved = resolveLayout({ ...none, config: '{"testCommand":"pytest -f"}' });
    expect(resolved.source).toBe('default');
    expect(resolved.layout.panes[1]?.command).toBe('pytest -f');
  });

  it('names the file of an invalid layout instead of falling back', () => {
    expect(() => resolveLayout({ ...none, repoLayout: '{}', configLayout: custom })).toThrow(
      '.agents/herdr-layout.json: "panes" must be a non-empty list',
    );
  });
});
