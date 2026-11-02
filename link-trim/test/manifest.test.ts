import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');

// Returns the first capture group of a manifest line; fails the test when the line is missing.
function valueOf(pattern: RegExp): string {
  const match = manifest.match(pattern);
  if (!match?.[1]) throw new Error(`manifest line not found: ${pattern}`);
  return match[1];
}

// The TOML pattern is a basic string; JSON string syntax covers the escapes used here.
const patternSource: string = JSON.parse(valueOf(/^pattern = (".*")$/m));
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
    const argv: unknown = JSON.parse(valueOf(/^command = (\[.*\])$/m));
    expect(Array.isArray(argv)).toBe(true);
    const args = argv as unknown[];
    expect(args.length).toBeGreaterThan(0);
    for (const arg of args) {
      expect(typeof arg).toBe('string');
      expect(String(arg).length).toBeGreaterThan(0);
    }
  });

  it('runs the open action as a TypeScript entry point under Node', () => {
    expect(JSON.parse(valueOf(/^command = (\[.*\])$/m))).toEqual(['node', 'bin/open.ts']);
  });

  it('declares the top-level id, name, version and min_herdr_version', () => {
    expect(manifest).toMatch(/^id = "link-trim"$/m);
    expect(manifest).toMatch(/^name = "link-trim"$/m);
    expect(manifest).toMatch(/^version = "\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?"$/m); // the release writes it (scripts/set-version.ts)
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
  });

  it('declares platforms as macos and linux', () => {
    expect(JSON.parse(valueOf(/^platforms = (\[.*\])$/m))).toEqual(['macos', 'linux']);
  });

  it('declares the open action and the handler id', () => {
    expect(manifest).toMatch(/^id = "open"$/m);
    expect(manifest).toMatch(/^id = "trailing-punct"$/m);
    expect(manifest).toMatch(/^action = "open"$/m);
  });
});
