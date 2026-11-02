import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configIssues, parseConfig } from '../lib/config.ts';

describe('configIssues', () => {
  it('accepts a valid config and a missing file', () => {
    expect(configIssues('{"roots":["~/Source"],"depth":2,"tabs":[{"label":"a","command":"x","focus":true}]}')).toEqual([]);
    expect(configIssues('{}')).toEqual([]);
    expect(configIssues(undefined)).toEqual([]);
    expect(configIssues(null)).toEqual([]);
  });

  it('names file and key for a wrong value', () => {
    expect(configIssues('{"depth":11}')).toEqual(['config.json: depth: must be at most 10']);
    expect(configIssues('{"depth":"3"}')).toEqual(['config.json: depth: expected integer, got string']);
    expect(configIssues('{"roots":[]}')).toEqual(['config.json: roots: must not be empty']);
    expect(configIssues('{"tabs":[{"label":"a","focus":"yes"}]}')).toEqual([
      'config.json: tabs[0].focus: expected boolean, got string',
    ]);
    expect(configIssues('{"tabs":[{"command":"x"}]}')).toEqual(['config.json: tabs[0].label: required']);
  });

  it('reports an unknown key, broken JSON and a non-object', () => {
    expect(configIssues('{"dept":2}')).toEqual(['config.json: dept: unknown key']);
    expect(configIssues('{"tabs":[{"label":"a","cmd":"x"}]}')).toEqual(['config.json: tabs[0].cmd: unknown key']);
    expect(configIssues('{bad')).toEqual(['config.json: invalid JSON']);
    expect(configIssues('[]')).toEqual(['config.json: expected object, got array']);
  });
});

describe('parseConfig with the schema', () => {
  it('reports an unknown key as a problem and keeps the valid keys', () => {
    const parsed = parseConfig('{"dept":2,"depth":4}', join('/', 'home', 'me'));
    expect(parsed.problems).toEqual(['dept: unknown key']);
    expect(parsed.config.depth).toBe(4);
  });
});
