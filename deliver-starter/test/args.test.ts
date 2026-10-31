import { describe, expect, it } from 'vitest';
import { deliverArgs, parseArgs } from '../lib/args.ts';
import { parseIssueUrl } from '../lib/link.ts';

describe('argument parsing', () => {
  it('parses one or more numbers, with or without #, and drops duplicates', () => {
    expect(parseArgs('3')).toEqual({ ok: true, target: { numbers: [3], milestone: null } });
    expect(parseArgs(' 3  #4 5 3 ')).toEqual({ ok: true, target: { numbers: [3, 4, 5], milestone: null } });
  });

  it('parses --milestone with a bare or quoted name', () => {
    expect(parseArgs('--milestone 0.3.0')).toEqual({ ok: true, target: { numbers: [], milestone: '0.3.0' } });
    expect(parseArgs('--milestone "my release"')).toEqual({
      ok: true,
      target: { numbers: [], milestone: 'my release' },
    });
  });

  it('reports empty input as empty', () => {
    expect(parseArgs('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseArgs('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects words, zero, a missing milestone name and an open quote', () => {
    expect(parseArgs('abc')).toEqual({ ok: false, reason: 'Not an issue number: abc' });
    expect(parseArgs('3 x')).toEqual({ ok: false, reason: 'Not an issue number: x' });
    expect(parseArgs('0')).toEqual({ ok: false, reason: 'Not an issue number: 0' });
    expect(parseArgs('--milestone')).toEqual({ ok: false, reason: '--milestone needs a name' });
    expect(parseArgs('--milestone "x')).toEqual({ ok: false, reason: 'Unbalanced quote' });
  });

  it('renders the /deliver argument text', () => {
    expect(deliverArgs({ numbers: [3, 4], milestone: null })).toBe('3 4');
    expect(deliverArgs({ numbers: [], milestone: 'my release' })).toBe('--milestone "my release"');
  });
});

describe('link URL parsing', () => {
  it('extracts repository and number of an issue URL', () => {
    expect(parseIssueUrl('https://github.com/GravionLabs/herdr-plugins/issues/3')).toEqual({
      repo: 'GravionLabs/herdr-plugins',
      number: 3,
    });
  });

  it.each([
    undefined,
    '',
    'https://github.com/a/b/pull/3',
    'https://github.com/a/b/issues/3/',
    'https://github.com/a/b/issues/3#comment',
    'https://github.com/a/b/issues/x',
    'http://github.com/a/b/issues/3',
    'https://github.com/a/b/issues/0',
  ])('rejects %s', (url) => {
    expect(parseIssueUrl(url)).toBeNull();
  });
});
