// Cleanup of the worktrees and local branches merged PBIs left behind. The `cleanup` action finds the merged PRs into
// release/next that still have a local worktree or branch and runs the `deliver` skill's Remove-PbiWorktrees.ps1 for
// each; the `worktree.removed` hook deletes the then orphaned branch. All I/O goes through an injected `Run`.
import { failureLine, type Run } from './run.ts';

export const BASE_BRANCH = 'release/next';
// Never deleted by the hook, even when their commits are on a remote branch.
export const PROTECTED_BRANCHES = ['main', 'master', 'release/next'];

export type MergedPullRequest = { number: number; headRefName: string };
export type Worktree = { path: string; head: string | null; branch: string | null };
export type LeftEntry = { path?: string; branch?: string; reason: string; command: string };
export type CleanupResult = { removed: string[]; branchesDeleted: string[]; left: LeftEntry[] };
export type Candidate = { pr: number; issue: number; branch: string };
export type Failure = { pr: number; reason: string };
export type Report = CleanupResult & { candidates: Candidate[]; failed: Failure[] };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : []).filter((item): item is string => typeof item === 'string');

export const emptyResult = (): CleanupResult => ({ removed: [], branchesDeleted: [], left: [] });

// `gh pr list --state merged --json number,headRefName`
export function parseMergedPullRequests(json: string): MergedPullRequest[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('could not read the merged pull requests from gh: invalid JSON');
  }
  if (!Array.isArray(data)) throw new Error('could not read the merged pull requests from gh: expected a list');
  return data
    .filter(isObject)
    .filter((item) => typeof item.number === 'number' && typeof item.headRefName === 'string' && item.headRefName)
    .map((item) => ({ number: item.number as number, headRefName: item.headRefName as string }));
}

// Work branches are named `<type>/<nr>-<slug>`, e.g. `feat/7-worktree-cleanup`.
export function issueNumberOfBranch(branch: string): number | null {
  const match = /^[a-z]+\/(\d+)-/.exec(branch);
  return match ? Number(match[1]) : null;
}

// `git worktree list --porcelain`: blocks of `worktree <path>`, `HEAD <sha>`, `branch refs/heads/<b>` or `detached`.
export function parseWorktrees(porcelain: string): Worktree[] {
  const list: Worktree[] = [];
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) list.push({ path: line.slice('worktree '.length), head: null, branch: null });
    const current = list.at(-1);
    if (!current) continue;
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length);
    if (line.startsWith('branch refs/heads/')) current.branch = line.slice('branch refs/heads/'.length);
  }
  return list;
}

// `git for-each-ref --format=%(refname:short) refs/heads`
export function parseLines(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

// The merged PRs whose head branch or `wip-<nr>` still has a local branch or a worktree, oldest first, one per PR.
export function selectCandidates(
  prs: MergedPullRequest[],
  localBranches: string[],
  worktrees: Worktree[],
): Candidate[] {
  const present = new Set([...localBranches, ...worktrees.map((w) => w.branch).filter((b): b is string => !!b)]);
  const seen = new Set<number>();
  return [...prs]
    .sort((a, b) => a.number - b.number)
    .flatMap((pr) => {
      const issue = issueNumberOfBranch(pr.headRefName);
      if (issue === null || seen.has(pr.number)) return [];
      if (!present.has(pr.headRefName) && !present.has(`wip-${issue}`)) return [];
      seen.add(pr.number);
      return [{ pr: pr.number, issue, branch: pr.headRefName }];
    });
}

// The JSON object Remove-PbiWorktrees.ps1 prints: {removed[], branchesDeleted[], left[{path|branch, reason, command}]}.
export function parseScriptResult(json: string): CleanupResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Remove-PbiWorktrees.ps1 printed no JSON');
  }
  if (!isObject(data)) throw new Error('Remove-PbiWorktrees.ps1 printed no JSON object');
  const left = (Array.isArray(data.left) ? data.left : [data.left]).filter(isObject).map((entry) => {
    const item: LeftEntry = { reason: String(entry.reason ?? ''), command: String(entry.command ?? '') };
    if (typeof entry.path === 'string') item.path = entry.path;
    if (typeof entry.branch === 'string') item.branch = entry.branch;
    return item;
  });
  // ConvertTo-Json writes a one-element array as a bare value in older pwsh versions
  const list = (value: unknown): string[] => (typeof value === 'string' ? [value] : strings(value));
  return { removed: list(data.removed), branchesDeleted: list(data.branchesDeleted), left };
}

export function mergeResults(results: CleanupResult[]): CleanupResult {
  const merged = emptyResult();
  for (const result of results) {
    for (const path of result.removed) if (!merged.removed.includes(path)) merged.removed.push(path);
    for (const branch of result.branchesDeleted)
      if (!merged.branchesDeleted.includes(branch)) merged.branchesDeleted.push(branch);
    for (const entry of result.left) {
      const key = entry.path ?? entry.branch;
      if (!merged.left.some((other) => (other.path ?? other.branch) === key)) merged.left.push(entry);
    }
  }
  // an entry left by one run and removed by a later one is not left
  merged.left = merged.left.filter(
    (entry) => !merged.removed.includes(entry.path ?? '') && !merged.branchesDeleted.includes(entry.branch ?? ''),
  );
  return merged;
}

// Notification title: `<n> removed, <m> left`; n counts removed worktrees and deleted branches.
export function summaryTitle(result: CleanupResult, failed: Failure[] = []): string {
  const title = `${result.removed.length + result.branchesDeleted.length} removed, ${result.left.length} left`;
  return failed.length ? `${title}, ${failed.length} failed` : title;
}

export function summaryBody(result: CleanupResult, failed: Failure[] = []): string {
  const parts: string[] = [];
  if (result.removed.length) parts.push(`worktrees: ${result.removed.join(', ')}`);
  if (result.branchesDeleted.length) parts.push(`branches: ${result.branchesDeleted.join(', ')}`);
  if (result.left.length || failed.length) parts.push('details: herdr plugin log list --plugin worktree-cleanup');
  return parts.join('; ') || 'nothing to clean up';
}

// Plugin log lines: everything removed, and every left entry with the command that removes it by hand.
export function logLines(result: CleanupResult, failed: Failure[] = []): string[] {
  return [
    ...result.removed.map((path) => `removed worktree ${path}`),
    ...result.branchesDeleted.map((branch) => `deleted branch ${branch}`),
    ...result.left.map((entry) => `left ${entry.path ?? entry.branch}: ${entry.reason} -> ${entry.command}`),
    ...failed.map((failure) => `failed PR #${failure.pr}: ${failure.reason}`),
  ];
}

// The `cleanup` action: merged PRs into release/next, their leftovers, one script run per PR in `repo` (the current
// worktree, which the script never touches).
export async function cleanup(run: Run, repo: string, script: string): Promise<Report> {
  const prs = await run(
    'gh',
    ['pr', 'list', '--base', BASE_BRANCH, '--state', 'merged', '--limit', '200', '--json', 'number,headRefName'],
    repo,
  );
  if (!prs.ok) {
    if (prs.code === 'ENOENT')
      throw new Error('gh is not installed: install the GitHub CLI from https://cli.github.com');
    throw new Error(`gh failed: ${failureLine(prs)}`);
  }
  const [refs, worktrees] = await Promise.all([
    run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], repo),
    run('git', ['worktree', 'list', '--porcelain'], repo),
  ]);
  if (!refs.ok) throw new Error(`git failed: ${failureLine(refs)}`);
  if (!worktrees.ok) throw new Error(`git failed: ${failureLine(worktrees)}`);

  const candidates = selectCandidates(
    parseMergedPullRequests(prs.stdout),
    parseLines(refs.stdout),
    parseWorktrees(worktrees.stdout),
  );
  const results: CleanupResult[] = [];
  const failed: Failure[] = [];
  for (const candidate of candidates) {
    const args = ['-NoProfile', '-NonInteractive', '-File', script, '-Pr', String(candidate.pr)];
    const result = await run('pwsh', [...args, '-Issue', String(candidate.issue)], repo);
    if (!result.ok && result.code === 'ENOENT') throw new Error('pwsh is not installed: install PowerShell 7+');
    try {
      if (!result.ok) throw new Error(failureLine(result));
      results.push(parseScriptResult(result.stdout));
    } catch (error) {
      failed.push({ pr: candidate.pr, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ...mergeResults(results), candidates, failed };
}

// The `worktree.removed` hook: deletes the local `branch` of the removed worktree when it is orphaned (no worktree has
// it checked out), not protected and every commit of it is on a remote branch. Local-only commits leave it in `left`.
// Returns null when there is nothing to do.
export async function deleteOrphanedBranch(run: Run, repo: string, branch: string): Promise<CleanupResult | null> {
  if (PROTECTED_BRANCHES.includes(branch)) return null;
  const originHead = await run('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], repo);
  if (originHead.ok && originHead.stdout.trim().replace(/^origin\//, '') === branch) return null;

  const exists = await run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo);
  if (!exists.ok) return null;
  const worktrees = await run('git', ['worktree', 'list', '--porcelain'], repo);
  if (!worktrees.ok || parseWorktrees(worktrees.stdout).some((w) => w.branch === branch)) return null;

  const result = emptyResult();
  const remote = await run('git', ['branch', '-r', '--contains', `refs/heads/${branch}`], repo);
  const onRemote = remote.ok && parseLines(remote.stdout).some((line) => !line.includes('->'));
  if (!onRemote) {
    result.left.push({ branch, reason: 'commits not on any remote branch', command: `git branch -D ${branch}` });
    return result;
  }
  // `-d` first: a user git hook may block `-D`; `-D` when `-d` refuses a branch not merged into HEAD
  const safe = await run('git', ['branch', '-d', branch], repo);
  const forced = safe.ok ? safe : await run('git', ['branch', '-D', branch], repo);
  if (forced.ok) result.branchesDeleted.push(branch);
  else
    result.left.push({
      branch,
      reason: `git branch -D failed: ${failureLine(forced)}`,
      command: `git branch -D ${branch}`,
    });
  return result;
}
