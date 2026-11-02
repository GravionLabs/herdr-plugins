import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

function markdownFiles(): string[] {
  const files = ['README.md'];
  const walk = (dir: string): void => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = join(dir, name);
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (name.endsWith('.md')) files.push(rel);
    }
  };
  walk('docs');
  for (const name of readdirSync(root)) {
    const readme = join(name, 'README.md');
    try {
      statSync(join(root, readme));
      files.push(readme);
    } catch {
      // not a plugin directory
    }
  }
  return files.filter((f) => !f.startsWith(join('docs', 'adr')) && !f.includes('node_modules'));
}

describe('install commands in the docs', () => {
  it('finds the docs to check', () => {
    expect(markdownFiles().length).toBeGreaterThan(20);
  });

  it('pin every herdr plugin install of this repository with -y --ref', () => {
    const bad: string[] = [];
    for (const file of markdownFiles()) {
      readFileSync(join(root, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/herdr plugin install\s+([^`\n]*GravionLabs\/[^`\n]*)/g)) {
            const args = m[1] ?? '';
            if (!/(^|\s)--ref\s+\S+/.test(args) || !/(^|\s)-y(\s|$)/.test(args)) {
              bad.push(`${file}:${i + 1}`);
            }
          }
        });
    }
    expect(bad).toEqual([]);
  });
});
