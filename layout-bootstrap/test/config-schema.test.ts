import { describe, expect, it } from 'vitest';
import { configIssues } from '../lib/config.ts';

describe('configIssues', () => {
  it('accepts a valid config and a missing file', () => {
    expect(configIssues('{"testCommand":"npm test -- --watch"}')).toEqual([]);
    expect(configIssues('{}')).toEqual([]);
    expect(configIssues(null)).toEqual([]);
  });

  it('names file and key for an invalid value', () => {
    expect(configIssues('{"testCommand":5}')).toEqual(['config.json: testCommand: expected string, got number']);
    expect(configIssues('{"testCommand":""}')).toEqual(['config.json: testCommand: must not be empty']);
  });

  it('reports an unknown key and broken JSON', () => {
    expect(configIssues('{"testcommand":"x"}')).toEqual(['config.json: testcommand: unknown key']);
    expect(configIssues('{')).toEqual(['config.json: invalid JSON']);
  });
});
