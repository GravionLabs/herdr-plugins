import { describe, expect, it } from 'vitest';
import { opener } from '../lib/open.ts';

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
});
