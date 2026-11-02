import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const manifests = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'herdr-plugin.toml')))
  .map((e) => read(`${e.name}/herdr-plugin.toml`));

const doc = read('docs/compatibility.md');
const rows = doc.split('\n').filter((l) => /^\| `\d+\.\d+\.\d+`/.test(l));
const current = rows.filter((l) => l.includes('(current'));

const parse = (v: string): number[] => v.split('.').map(Number);
const atLeast = (a: string, b: string): boolean => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return true;
};

describe('compatibility matrix', () => {
  it('marks exactly one row as current', () => {
    expect(current).toHaveLength(1);
  });

  it('has a current row at least as new as the version of package.json', () => {
    const version = /^\| `(\d+\.\d+\.\d+)`/.exec(current[0])![1];
    const pkg = JSON.parse(read('package.json')).version as string;
    expect(atLeast(version, pkg)).toBe(true);
  });

  it('lists the current release first', () => {
    expect(rows[0]).toBe(current[0]);
  });

  it('names the herdr minimum that every manifest declares', () => {
    const mins = new Set(manifests.map((m) => /^min_herdr_version = "([^"]+)"/m.exec(m)![1]));
    expect(mins.size).toBe(1);
    expect(current[0]).toContain(`>= ${[...mins][0]}`);
  });

  it('names the platforms that every manifest declares and no windows', () => {
    const plats = new Set(manifests.map((m) => /^platforms = (\[.*\])/m.exec(m)![1]));
    expect([...plats]).toEqual(['["macos", "linux"]']);
    expect(current[0]).toContain('macOS, Linux');
  });
});
