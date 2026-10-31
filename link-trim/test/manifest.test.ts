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

  it('declares the open action command as a non-empty argv array', () => {
    const line = manifest.match(/^command = (\[.*\])$/m);
    expect(line).not.toBeNull();
    const argv = JSON.parse(line[1]);
    expect(Array.isArray(argv)).toBe(true);
    expect(argv.length).toBeGreaterThan(0);
    for (const arg of argv) {
      expect(typeof arg).toBe('string');
      expect(arg.length).toBeGreaterThan(0);
    }
  });

  it('declares the top-level id, name, version and min_herdr_version', () => {
    expect(manifest).toMatch(/^id = "link-trim"$/m);
    expect(manifest).toMatch(/^name = "link-trim"$/m);
    expect(manifest).toMatch(/^version = "0\.1\.0"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
  });

  it('declares platforms as macos and linux', () => {
    const line = manifest.match(/^platforms = (\[.*\])$/m);
    expect(line).not.toBeNull();
    expect(JSON.parse(line[1])).toEqual(['macos', 'linux']);
  });

  it('declares the open action and the handler id', () => {
    expect(manifest).toMatch(/^id = "open"$/m);
    expect(manifest).toMatch(/^id = "trailing-punct"$/m);
    expect(manifest).toMatch(/^action = "open"$/m);
  });
});
