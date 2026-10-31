import { describe, expect, it } from 'vitest';
import { configHint, parseConfig } from '../lib/config.ts';

describe('parseConfig', () => {
  it('turns commands into config entries', () => {
    const json = JSON.stringify({
      commands: [
        { title: 'show agent-log', command: ['herdr', 'pane', 'split', '--current'], cwd: '/work' },
        { title: 'top', command: ['top'] },
      ],
    });
    expect(parseConfig(json)).toEqual({
      entries: [
        {
          id: 'config.0',
          group: 'config',
          title: 'show agent-log',
          run: { kind: 'command', command: ['herdr', 'pane', 'split', '--current'], cwd: '/work' },
        },
        { id: 'config.1', group: 'config', title: 'top', run: { kind: 'command', command: ['top'] } },
      ],
      problems: [],
    });
  });

  it('treats a missing file, empty object and missing commands as fine', () => {
    for (const input of [null, undefined, '{}']) expect(parseConfig(input)).toEqual({ entries: [], problems: [] });
  });

  it('reports invalid JSON and a wrong top level', () => {
    expect(parseConfig('{nope').problems).toEqual(['invalid JSON']);
    expect(parseConfig('[]').problems).toEqual(['expected an object']);
    expect(parseConfig('{"commands":"x"}').problems).toEqual(['commands must be an array']);
  });

  it('reports invalid entries and keeps the valid ones', () => {
    const json = JSON.stringify({
      commands: [
        { title: '', command: ['a'] },
        { title: 'no command' },
        { title: 'empty command', command: [] },
        { title: 'not strings', command: ['a', 1] },
        { title: 'bad cwd', command: ['a'], cwd: '' },
        'text',
        { title: 'ok', command: ['ls'] },
      ],
    });
    const { entries, problems } = parseConfig(json);
    expect(entries.map((e) => e.title)).toEqual(['ok']);
    expect(problems).toEqual([
      'commands[0]: title must be a non-empty string',
      'commands[1]: command must be a non-empty array of non-empty strings',
      'commands[2]: command must be a non-empty array of non-empty strings',
      'commands[3]: command must be a non-empty array of non-empty strings',
      'commands[4]: cwd must be a non-empty string',
      'commands[5] must be an object',
    ]);
  });
});

describe('configHint', () => {
  it('is null without problems', () => expect(configHint([])).toBeNull());
  it('shows the first problem and counts the rest', () => {
    expect(configHint(['invalid JSON'])).toBe('config.json: invalid JSON');
    expect(configHint(['a', 'b', 'c'])).toBe('config.json: a (+2 more)');
  });
});
