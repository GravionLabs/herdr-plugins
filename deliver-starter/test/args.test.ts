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

  it('keeps ; & $() .. of a milestone name literal', () => {
    expect(parseArgs('--milestone "v1; rm -rf ~ & $(id)"')).toEqual({
      ok: true,
      target: { numbers: [], milestone: 'v1; rm -rf ~ & $(id)' },
    });
    expect(parseArgs('--milestone ../../x')).toEqual({ ok: true, target: { numbers: [], milestone: '../../x' } });
  });

  it.each([
    ["--milestone \"it's\"", "'"],
    ['--milestone \'a"b\'', '"'],
    ['--milestone a\\b', '\\'],
    ['--milestone a’b', '’'],
    ['--milestone "a\nb"', '\n'],
    ['--milestone a\x1b]0;x', '\x1b'],
  ])('rejects the milestone %j that could break out of the shell quoting', (input, char) => {
    expect(parseArgs(input)).toEqual({ ok: false, reason: `Milestone name must not contain ${JSON.stringify(char)}` });
  });

  it('rejects injection attempts as issue numbers', () => {
    expect(parseArgs('3;id')).toEqual({ ok: false, reason: 'Not an issue number: 3;id' });
    expect(parseArgs('3 && id')).toEqual({ ok: false, reason: 'Not an issue number: &&' });
    expect(parseArgs("'3'")).toEqual({ ok: true, target: { numbers: [3], milestone: null } });
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
    'https://github.com/a/b/issues/99999999999999999999',
    'https://github.com/a;rm -rf ~/b/issues/3',
    'https://github.com/a&calc/b/issues/3',
    "https://github.com/a/b'$(id)'/issues/3",
    'https://github.com/a/b"/issues/3',
    'https://github.com/../../issues/3',
    'https://github.com/a/../issues/3',
    'https://github.com/a/./issues/3',
    'https://github.com/-a/b/issues/3',
    'https://github.com/a/%2e%2e/issues/3',
    'https://github.com/a/b/issues/3;id',
    'https://github.com/a/b/issues/3\nid',
  ])('rejects %j', (url) => {
    expect(parseIssueUrl(url)).toBeNull();
  });

  it('accepts dots, underscores and dashes inside a repository name', () => {
    expect(parseIssueUrl('https://github.com/my-org/my_repo.js/issues/12')).toEqual({ repo: 'my-org/my_repo.js', number: 12 });
    expect(parseIssueUrl('https://github.com/a/.github/issues/1')).toEqual({ repo: 'a/.github', number: 1 });
  });
});
