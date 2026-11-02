// Repository discovery: every directory below a root that contains `.git` (directory, or file for a worktree
// or submodule), up to `depth` levels. A found repository is not descended into; hidden directories,
// node_modules and symlinks are skipped, unreadable directories are ignored.
import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

// `rel`: path relative to its root (the basename when the root itself is a repository).
export type Repo = { name: string; path: string; rel: string };

const SKIP = new Set(['node_modules']);

async function entries(dir: string): Promise<Dirent[] | null> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

async function walk(root: string, dir: string, level: number, depth: number, found: Repo[]): Promise<void> {
  const list = await entries(dir);
  if (list === null) return;
  if (list.some((e) => e.name === '.git' && (e.isDirectory() || e.isFile()))) {
    found.push({ name: basename(dir), path: dir, rel: relative(root, dir) || basename(dir) });
    return;
  }
  if (level >= depth) return;
  const subdirs = list.filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP.has(e.name));
  await Promise.all(subdirs.map((e) => walk(root, join(dir, e.name), level + 1, depth, found)));
}

// Repositories below `roots`, sorted by name, then path; a path found under two roots is listed once.
export async function discover(roots: string[], depth: number): Promise<Repo[]> {
  const found: Repo[] = [];
  for (const root of roots) await walk(root, root, 0, depth, found);
  const seen = new Set<string>();
  return found
    .filter((repo) => (seen.has(repo.path) ? false : (seen.add(repo.path), true)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
}
