import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discover } from '../lib/discover.ts';

let base: string;

const repo = (...parts: string[]): string => {
  const dir = join(base, ...parts);
  mkdirSync(join(dir, '.git'), { recursive: true });
  return dir;
};
const dir = (...parts: string[]): string => {
  const path = join(base, ...parts);
  mkdirSync(path, { recursive: true });
  return path;
};

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'repo-open-'));
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('discover', () => {
  it('finds repositories below a root, sorted by name, with the path relative to the root', async () => {
    const root = dir('src');
    repo('src', 'org', 'zeta');
    repo('src', 'alpha');
    expect(await discover([root], 3)).toEqual([
      { name: 'alpha', path: join(root, 'alpha'), rel: 'alpha' },
      { name: 'zeta', path: join(root, 'org', 'zeta'), rel: join('org', 'zeta') },
    ]);
  });

  it('counts a .git file (worktree or submodule) as a repository', async () => {
    const root = dir('src');
    const wt = dir('src', 'wt');
    writeFileSync(join(wt, '.git'), 'gitdir: elsewhere');
    expect((await discover([root], 3)).map((r) => r.path)).toEqual([wt]);
  });

  it('does not descend into a repository, hidden directories or node_modules', async () => {
    const root = dir('src');
    repo('src', 'outer');
    repo('src', 'outer', 'inner');
    repo('src', '.hidden', 'x');
    repo('src', 'node_modules', 'pkg');
    expect((await discover([root], 3)).map((r) => r.name)).toEqual(['outer']);
  });

  it('stops at the depth limit', async () => {
    const root = dir('src');
    repo('src', 'a', 'b', 'deep');
    expect(await discover([root], 2)).toEqual([]);
    expect((await discover([root], 3)).map((r) => r.name)).toEqual(['deep']);
  });

  it('lists a root that is itself a repository under its basename', async () => {
    const root = repo('single');
    expect(await discover([root], 3)).toEqual([{ name: 'single', path: root, rel: 'single' }]);
  });

  it('merges several roots, lists a path once and ignores a missing root', async () => {
    const root = dir('src');
    repo('src', 'one');
    repo('src', 'org', 'one');
    const results = await discover([root, join(root, 'org'), join(base, 'missing')], 3);
    expect(results.map((r) => r.path)).toEqual([join(root, 'one'), join(root, 'org', 'one')]);
  });
});
