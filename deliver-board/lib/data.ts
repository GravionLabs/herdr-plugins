// The `data` action: the board as one versioned JSON document (poimen ADR 0004). I/O only through the injected `run`
// and the cache; every command is read-only (`gh api` GET, `gh pr list`, `git rev-parse`, `git ls-remote`, `git remote get-url`).
import { buildRows, fetchIssuePages, ISSUES_PAGE_SIZE, parseIssues, parsePullRequests, parseRemoteHeads, type ChecksSummary, type PullRequest, type Row } from './board.ts';
import { cachedApi, cachedCommand, type CacheOptions, type RunFn } from './ghcache.ts';
import { ghErrorLine } from './context.ts';

export const DATA_VERSION = 1;
export const PLUGIN_ID = 'deliver-board';

export type DataPr = { number: number; url: string; state: string; checks: ChecksSummary };
export type DataRow = {
  number: number;
  title: string;
  url: string;
  assignee: string;
  labels: string[];
  branch: string | null;
  pr: DataPr | null;
};
export type BoardData = { repo: string | null; rows: DataRow[] };
export type DataSuccess = { version: 1; plugin: 'deliver-board'; generated: string; data: BoardData };
export type DataFailure = { version: 1; plugin: 'deliver-board'; error: { code: string; message: string } };
export type DataEnvelope = DataSuccess | DataFailure;

export function serializePr(pr: PullRequest): DataPr {
  return { number: pr.number, url: pr.url, state: pr.state, checks: { ...pr.checks } };
}

export function serializeRow(row: Row): DataRow {
  return {
    number: row.number,
    title: row.title,
    url: row.url,
    assignee: row.assignee,
    labels: [...row.labels],
    branch: row.branch,
    pr: row.pr ? serializePr(row.pr) : null,
  };
}

// `owner/name` of a GitHub remote URL (https or ssh); null for anything else.
export function repoOfRemote(url: string): string | null {
  const match = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match?.[1] ?? null;
}

// `--cwd <repository>` (also `--cwd=<repository>`); null when missing or empty.
export function parseArgs(argv: string[]): { cwd: string | null } {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--cwd') return { cwd: argv[i + 1] || null };
    if (arg.startsWith('--cwd=')) return { cwd: arg.slice('--cwd='.length) || null };
  }
  return { cwd: null };
}

export const failure = (code: string, message: string): DataFailure => ({
  version: DATA_VERSION,
  plugin: PLUGIN_ID,
  error: { code, message },
});

export async function buildData(run: RunFn, cwd: string | null, cache: CacheOptions, now: () => Date = () => new Date()): Promise<DataEnvelope> {
  if (!cwd) return failure('invalid_arguments', 'missing --cwd <repository>');
  const top = await run('git', ['rev-parse', '--show-toplevel'], cwd);
  if (!top.ok) return failure('not_a_repository', `Not a git repository: ${cwd}`);
  const repo = top.stdout.trim();

  const [issues, prs, heads, remote] = await Promise.all([
    fetchIssuePages((page) =>
      cachedApi(run, repo, `repos/{owner}/{repo}/issues?labels=pbi&state=open&per_page=${ISSUES_PAGE_SIZE}&page=${page}`, cache),
    ).catch((error: unknown) => ({ ok: false as const, failure: { code: null, stderr: error instanceof Error ? error.message : String(error) } })),
    cachedCommand(
      run,
      'gh',
      ['pr', 'list', '--base', 'release/next', '--state', 'all', '--limit', '100', '--json', 'number,headRefName,state,url,statusCheckRollup'],
      repo,
      cache,
    ),
    run('git', ['ls-remote', '--heads', 'origin'], repo),
    run('git', ['remote', 'get-url', 'origin'], repo),
  ]);

  const failed = !issues.ok ? issues : !prs.ok ? prs : null;
  if (failed && !failed.ok) {
    if ('rateLimit' in failed) return failure('rate_limited', failed.rateLimit.message);
    return failure('gh_failed', ghErrorLine(failed.failure));
  }
  if (!issues.ok || !prs.ok) return failure('gh_failed', 'gh failed');
  try {
    const rows = buildRows(parseIssues(issues.body), parsePullRequests(prs.body), heads.ok ? parseRemoteHeads(heads.stdout) : []);
    return {
      version: DATA_VERSION,
      plugin: PLUGIN_ID,
      generated: now().toISOString(),
      data: { repo: remote.ok ? repoOfRemote(remote.stdout) : null, rows: rows.map(serializeRow) },
    };
  } catch (error) {
    return failure('invalid_gh_output', error instanceof Error ? error.message : String(error));
  }
}
