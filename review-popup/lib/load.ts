// Finds and reads the review file of the focused pane's branch. Never throws; every outcome is a State.
// A pane on a branch without PBI number (the deliver session on release/next or main) gets the list of all reviews.
import { readdir, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { classifyFailure, noRepository } from './errors.ts';
import { type Entry, isStale, message, parseReview, pbiFromBranch, type State } from './review.ts';
import type { Run } from './run.ts';

export type Loaded = { state: State; toplevel: string | null };

export type ReadFile = (path: string) => Promise<string>;
export const realRead: ReadFile = (path) => readFile(path, 'utf8');

// The entries of a directory with their modification time; empty when the directory does not exist.
export type ListDir = (dir: string) => Promise<{ name: string; mtimeMs: number }[]>;
export const realList: ListDir = async (dir) => {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    names.map(async (name) => {
      try {
        return { name, mtimeMs: (await stat(join(dir, name))).mtimeMs };
      } catch {
        return null;
      }
    }),
  );
  return entries.filter((e) => e !== null);
};

const REVIEW_FILE = /^review-(\d+)\.json$/;

// The worktree that has `branch` checked out, from `git worktree list --porcelain`, else null.
export function worktreeOf(porcelain: string, branch: string): string | null {
  for (const block of porcelain.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim());
    const path = lines.find((l) => l.startsWith('worktree '))?.slice('worktree '.length);
    if (path && lines.includes(`branch refs/heads/${branch}`)) return path;
  }
  return null;
}

export async function load(run: Run, read: ReadFile, cwd: string, list: ListDir = realList): Promise<Loaded> {
  const common = await run('git', ['rev-parse', '--git-common-dir'], cwd);
  if (!common.ok) {
    const found = classifyFailure('git', common.code, common.stderr) ?? noRepository();
    const first = found.kind === 'no-repository' ? `${found.message}: ${cwd}` : found.message;
    return { state: message(first, found.hint), toplevel: null };
  }
  const top = await run('git', ['rev-parse', '--show-toplevel'], cwd);
  const toplevel = top.ok ? top.stdout.trim() : cwd;
  const branchResult = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const branch = branchResult.ok ? branchResult.stdout.trim() : '';
  const dir = common.stdout.trim();
  const stateDir = join(isAbsolute(dir) ? dir : join(cwd, dir), '.agents', 'state');
  const nr = pbiFromBranch(branch);
  if (nr === null) return { state: await loadAll(run, read, list, cwd, stateDir, branch), toplevel };
  const file = join(stateDir, `review-${nr}.json`);
  let text: string;
  try {
    text = await read(file);
  } catch {
    return { state: message(`No review file for #${nr}: ${file}`, 'deliver writes it after a review round.'), toplevel };
  }
  const parsed = parseReview(text);
  if (!parsed.ok) return { state: message(`Invalid review file ${file}:`, parsed.error), toplevel };
  const head = await run('git', ['rev-parse', 'HEAD'], cwd);
  const stale = head.ok ? isStale(parsed.review.sha, head.stdout) : false;
  return { state: { kind: 'review', review: parsed.review, stale, selected: 0 }, toplevel };
}

// Every review file of the repository, newest first: stale against the review's own branch, findings open in its worktree.
async function loadAll(run: Run, read: ReadFile, list: ListDir, cwd: string, stateDir: string, branch: string): Promise<State> {
  const files = (await list(stateDir))
    .filter((e) => REVIEW_FILE.test(e.name))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const from = branch || 'no branch';
  if (!files.length) {
    return message(`No deliver review in this repository yet (pane on ${from}).`, 'deliver writes it after a review round.');
  }
  const worktrees = await run('git', ['worktree', 'list', '--porcelain'], cwd);
  const entries: Entry[] = [];
  for (const { name } of files) {
    const pbi = Number(REVIEW_FILE.exec(name)?.[1]);
    const file = join(stateDir, name);
    let text: string;
    try {
      text = await read(file);
    } catch {
      entries.push({ pbi, file, review: null, error: 'unreadable', stale: false, toplevel: null });
      continue;
    }
    const parsed = parseReview(text);
    if (!parsed.ok) {
      entries.push({ pbi, file, review: null, error: parsed.error, stale: false, toplevel: null });
      continue;
    }
    const review = parsed.review;
    const head = await run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${review.branch}`], cwd);
    // a branch deleted after its merge has no head to compare with: not stale
    const stale = head.ok ? isStale(review.sha, head.stdout) : false;
    const toplevel = worktrees.ok ? worktreeOf(worktrees.stdout, review.branch) : null;
    entries.push({ pbi, file, review, stale, toplevel });
  }
  return { kind: 'pick', entries, selected: 0, from };
}
