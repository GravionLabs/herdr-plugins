import { describe, expect, it } from 'vitest';
import { configIssues } from '../lib/config.ts';

describe('configIssues', () => {
  it('accepts a valid config and a missing file', () => {
    expect(configIssues('{"harness":"claude --model opus","mode":"unattended","suggestLimit":50}')).toEqual([]);
    expect(configIssues('{}')).toEqual([]);
    expect(configIssues(null)).toEqual([]);
  });

  it('names file and key for every invalid value', () => {
    expect(configIssues('{"harness":"  ","mode":"fast","suggestLimit":0}')).toEqual([
      'config.json: harness: must not be empty',
      'config.json: mode: must be one of "interactive", "unattended"',
      'config.json: suggestLimit: must be at least 1',
    ]);
    expect(configIssues('{"suggestLimit":1.5}')).toEqual(['config.json: suggestLimit: expected integer, got number']);
  });

  it('reports an unknown key and broken JSON', () => {
    expect(configIssues('{"limit":3}')).toEqual(['config.json: limit: unknown key']);
    expect(configIssues('{')).toEqual(['config.json: invalid JSON']);
  });
});
