import { describe, expect, it } from 'vitest';
import { parseConfig } from '../lib/config.ts';

const defaults = { harness: 'claude', mode: 'interactive' };

describe('config fallback', () => {
  it('uses the defaults without a file', () => {
    expect(parseConfig(null)).toEqual(defaults);
    expect(parseConfig(undefined)).toEqual(defaults);
    expect(parseConfig('')).toEqual(defaults);
  });

  it('uses the defaults for broken JSON or a non-object', () => {
    expect(parseConfig('{')).toEqual(defaults);
    expect(parseConfig('[]')).toEqual(defaults);
    expect(parseConfig('"x"')).toEqual(defaults);
  });

  it('reads harness and mode', () => {
    expect(parseConfig('{"harness":"claude --model opus","mode":"unattended"}')).toEqual({
      harness: 'claude --model opus',
      mode: 'unattended',
    });
  });

  it('falls back key by key on wrong values', () => {
    expect(parseConfig('{"harness":"codex","mode":"fast"}')).toEqual({ harness: 'codex', mode: 'interactive' });
    expect(parseConfig('{"harness":"  ","mode":"unattended"}')).toEqual({ harness: 'claude', mode: 'unattended' });
    expect(parseConfig('{"harness":3}')).toEqual(defaults);
  });
});
