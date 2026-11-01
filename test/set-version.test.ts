import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setVersion } from '../scripts/set-version.ts';

const repo = new URL('../', import.meta.url);

describe('set-version', () => {
  let dir = '';
  const manifest = (id: string): string =>
    `id = "${id}"\nname = "${id}"\nversion = "0.1.0"\nmin_herdr_version = "0.9.5"\n\n[[command]]\nversion = "keep"\n`;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'set-version-'));
    for (const id of ['alpha', 'beta']) {
      mkdirSync(join(dir, id));
      writeFileSync(join(dir, id, 'herdr-plugin.toml'), manifest(id));
    }
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'package.json'), '{\n  "name": "x",\n  "version": "0.1.0",\n  "private": true\n}\n');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('rewrites both manifests and package.json', () => {
    setVersion(dir, '0.4.0');
    for (const id of ['alpha', 'beta']) {
      const text = readFileSync(join(dir, id, 'herdr-plugin.toml'), 'utf8');
      expect(text).toContain('version = "0.4.0"\nmin_herdr_version = "0.9.5"');
      expect(text).toContain('[[command]]\nversion = "keep"');
    }
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('0.4.0');
  });

  it('handles a prerelease version', () => {
    setVersion(dir, '1.0.0-rc.1');
    expect(readFileSync(join(dir, 'alpha', 'herdr-plugin.toml'), 'utf8')).toContain('version = "1.0.0-rc.1"');
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('1.0.0-rc.1');
  });

  it('keeps CRLF line endings', () => {
    const file = join(dir, 'alpha', 'herdr-plugin.toml');
    writeFileSync(file, manifest('alpha').replace(/\n/g, '\r\n'));
    setVersion(dir, '0.5.0');
    expect(readFileSync(file, 'utf8')).toContain('version = "0.5.0"\r\nmin_herdr_version = "0.9.5"\r\n');
  });

  it('rejects a version that is not SemVer and changes nothing', () => {
    expect(() => setVersion(dir, 'v1.0')).toThrow(/not a SemVer/);
    expect(readFileSync(join(dir, 'alpha', 'herdr-plugin.toml'), 'utf8')).toBe(manifest('alpha'));
  });

  it('runs as a command with the version as argument or $VERSION', () => {
    const script = fileURLToPath(new URL('scripts/set-version.ts', repo));
    execFileSync('node', [script, '2.0.0'], { cwd: dir });
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('2.0.0');
    execFileSync('node', [script], { cwd: dir, env: { ...process.env, VERSION: '2.1.0-rc.1' } });
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('2.1.0-rc.1');
  });
});

describe('repository versions', () => {
  it('has the package.json version in every plugin manifest', () => {
    const version = JSON.parse(readFileSync(new URL('package.json', repo), 'utf8')).version;
    const manifests = readdirSync(repo, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'node_modules')
      .map((e) => new URL(`${e.name}/herdr-plugin.toml`, repo))
      .filter((url) => {
        try {
          readFileSync(url);
          return true;
        } catch {
          return false;
        }
      });
    expect(manifests.length).toBeGreaterThan(0);
    for (const url of manifests) {
      expect(readFileSync(url, 'utf8').match(/^version\s*=\s*"([^"]*)"/m)?.[1], url.pathname).toBe(version);
    }
  });
});
