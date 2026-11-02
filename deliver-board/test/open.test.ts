import { describe, expect, it } from 'vitest';
import { isWebUrl, opener } from '../lib/open.ts';

const url = 'https://example.com/a?x=1&y=100%25&q="z"';

describe('opener', () => {
  it('uses open on darwin', () => {
    expect(opener('darwin', url)).toEqual({ command: 'open', args: [url] });
  });

  it('uses xdg-open on linux', () => {
    expect(opener('linux', url)).toEqual({ command: 'xdg-open', args: [url] });
  });

  it('uses rundll32 url.dll,FileProtocolHandler on win32 with the URL as its own argument', () => {
    expect(opener('win32', url)).toEqual({
      command: 'rundll32',
      args: ['url.dll,FileProtocolHandler', 'https://example.com/a?x=1&y=100%25&q="z"'],
    });
  });

  it('returns null on an unsupported platform', () => {
    expect(opener('freebsd', url)).toBeNull();
  });

  it.each([
    'https://example.com/a;rm${IFS}-rf${IFS}~',
    'https://example.com/a&calc.exe',
    "https://example.com/a'$(id)'",
    'https://example.com/a"&calc&"',
    'https://example.com/a/../../etc/passwd',
    'http://example.com/a|b`id`',
  ])('passes the injection attempt %s unchanged as one argument', (attempt) => {
    expect(opener('darwin', attempt)).toEqual({ command: 'open', args: [attempt] });
    expect(opener('linux', attempt)).toEqual({ command: 'xdg-open', args: [attempt] });
    expect(opener('win32', attempt)?.args).toEqual(['url.dll,FileProtocolHandler', attempt]);
  });

  it.each([
    'file:///etc/passwd',
    'file:///C:/Windows/System32/calc.exe',
    'javascript:alert(1)',
    'smb://host/share',
    '/Applications/Calculator.app',
    '../../etc/passwd',
    '-a Calculator',
    '--args',
    'https://example.com/a b',
    'https://example.com/a;rm -rf ~',
    'https://example.com/a\nrm',
    'https://example.com/\x1b]52;c;eA==\x07',
    'https://',
    '',
  ])('refuses %j on every platform', (attempt) => {
    expect(isWebUrl(attempt)).toBe(false);
    for (const platform of ['darwin', 'linux', 'win32'] as const) expect(opener(platform, attempt)).toBeNull();
  });

  it('accepts http and https in any case', () => {
    expect(isWebUrl('http://example.com')).toBe(true);
    expect(isWebUrl('HTTPS://Example.com/x')).toBe(true);
  });
});
