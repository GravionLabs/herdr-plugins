// Finds and reads the review file of the focused pane's branch. Never throws; every outcome is a State.
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { isStale, message, parseReview, pbiFromBranch, type State } from './review.ts';
import type { Run } from './run.ts';

export type Loaded = { state: State; toplevel: string | null };

export type ReadFile = (path: string) => Promise<string>;
export const realRead: ReadFile = (path) => readFile(path, 'utf8');

export async function load(run: Run, read: ReadFile, cwd: string): Promise<Loaded> {
  const common = await run('git', ['rev-parse', '--git-common-dir'], cwd);
  if (!common.ok) return { state: message(`Not a git repository: ${cwd}`), toplevel: null };
  const top = await run('git', ['rev-parse', '--show-toplevel'], cwd);
  const toplevel = top.ok ? top.stdout.trim() : cwd;
  const branchResult = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const branch = branchResult.ok ? branchResult.stdout.trim() : '';
  const nr = pbiFromBranch(branch);
  if (nr === null) {
    return { state: message(`Branch "${branch}" has no PBI number (expected <type>/<nr>-<slug>).`), toplevel };
  }
  const dir = common.stdout.trim();
  const file = join(isAbsolute(dir) ? dir : join(cwd, dir), '.agents', 'state', `review-${nr}.json`);
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
