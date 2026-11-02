import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const manifestDirs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'herdr-plugin.toml')))
  .map((e) => e.name)
  .sort();

const unique = (values: string[]): string[] => [...new Set(values)].sort();

describe('plugin lists of the docs', () => {
  it('finds the plugin directories', () => {
    expect(manifestDirs).toContain('repo-open');
    expect(manifestDirs.length).toBeGreaterThanOrEqual(11);
  });

  it('lists every plugin in the table of the plugins page', () => {
    const rows = [...read('docs/plugins/index.md').matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
    expect(unique(rows)).toEqual(manifestDirs);
  });

  it('lists every plugin in the full pages list', () => {
    const links = [...read('docs/plugins/index.md').matchAll(/\(\.\.\/guide\/plugins\/([a-z-]+)\.md\)/g)].map((m) => m[1]);
    expect(unique(links)).toEqual(manifestDirs);
  });

  it('lists every plugin in the sidebar', () => {
    const links = [...read('apps/site/.vitepress/config.ts').matchAll(/link: '\/guide\/plugins\/([a-z-]+)'/g)].map((m) => m[1]);
    expect(unique(links)).toEqual(manifestDirs);
  });

  it('has a page per plugin', () => {
    const pages = readdirSync(join(root, 'docs/guide/plugins'))
      .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
      .map((n) => n.slice(0, -3));
    expect(unique(pages)).toEqual(manifestDirs);
  });
});
