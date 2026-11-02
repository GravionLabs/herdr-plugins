import { describe, expect, it } from 'vitest';
import { schemaProblems } from '../lib/config.ts';

describe('schemaProblems', () => {
  it('accepts a valid config and a missing file', () => {
    expect(schemaProblems('{"commands":[{"title":"t","command":["top"],"cwd":"/w"}]}')).toEqual([]);
    expect(schemaProblems('{}')).toEqual([]);
    expect(schemaProblems(null)).toEqual([]);
  });

  it('names the key path of an invalid entry', () => {
    expect(schemaProblems('{"commands":[{"title":"t","command":["ok",""]},{"command":["x"]}]}')).toEqual([
      'commands[0].command[1]: must not be empty',
      'commands[1].title: required',
    ]);
    expect(schemaProblems('{"commands":{}}')).toEqual(['commands: expected array, got object']);
  });

  it('reports unknown keys and broken JSON', () => {
    expect(schemaProblems('{"command":[]}')).toEqual(['command: unknown key']);
    expect(schemaProblems('{"commands":[{"title":"t","command":["a"],"x":1}]}')).toEqual(['commands[0].x: unknown key']);
    expect(schemaProblems('nope')).toEqual(['invalid JSON']);
  });
});
