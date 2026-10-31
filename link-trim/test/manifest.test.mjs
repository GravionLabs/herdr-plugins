import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');

// The TOML pattern is a basic string; JSON string syntax covers the escapes used here.
const patternSource = JSON.parse(manifest.match(/^pattern = (".*")$/m)[1]);
const pattern = new RegExp(patternSource);

describe('trailing-punct link handler pattern', () => {
  it.each([
    'https://github.com/GravionLabs/ci/pull/91)',
    'https://github.com/GravionLabs/ci/pull/91).',
    'https://github.com/GravionLabs/ci/issues/5],',
    'https://en.wikipedia.org/wiki/Foo_(bar)',
    'https://example.com/end.',
    'http://example.com/a,',
    'https://example.com/a;',
    'https://example.com/a:',
    "https://example.com/a'",
    'https://example.com/a"',
  ])('matches %s', (url) => {
    expect(pattern.test(url)).toBe(true);
  });

  it.each([
    'https://github.com/GravionLabs/ci/pull/91',
    'https://example.com/a?b=c',
    'ftp://example.com/a)',
    'file:///tmp/a.',
    'mailto:someone@example.com.',
  ])('does not match %s', (url) => {
    expect(pattern.test(url)).toBe(false);
  });

  it('declares the open action and the handler id', () => {
    expect(manifest).toMatch(/^id = "open"$/m);
    expect(manifest).toMatch(/^id = "trailing-punct"$/m);
    expect(manifest).toMatch(/^action = "open"$/m);
  });
});
