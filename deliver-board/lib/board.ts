// Pure parsing of the `gh` and `git` output the board reads: PBIs, their claims, pushed branches,
// PRs into release/next and their check state. No I/O here, so it is testable with recorded output.

export const SHOWN_LABELS = ['needs-decision', 'in-progress', 'merged'] as const;

export type ChecksState = 'passing' | 'failing' | 'pending' | 'none';

export type ChecksSummary = {
  state: ChecksState;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
};

export type Issue = {
  number: number;
  title: string;
  assignees: string[];
  labels: string[];
  url: string;
};

export type PullRequest = {
  number: number;
  headRefName: string;
  state: string;
  url: string;
  checks: ChecksSummary;
};

export type Row = {
  number: number;
  title: string;
  assignee: string;
  labels: string[];
  branch: string | null;
  pr: PullRequest | null;
  url: string;
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function parseArray(json: string, what: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(`could not read the ${what} from gh: invalid JSON`);
  }
  if (!Array.isArray(data)) throw new Error(`could not read the ${what} from gh: expected a list`);
  return data;
}

// The REST issues API (`repos/{owner}/{repo}/issues`; pull requests are skipped) or `gh issue list --json number,title,assignees,labels,url`
export function parseIssues(json: string): Issue[] {
  return parseArray(json, 'issues')
    .filter(isObject)
    .filter((item) => typeof item.number === 'number' && item.pull_request === undefined)
    .map((item) => ({
      number: item.number as number,
      title: text(item.title),
      assignees: (Array.isArray(item.assignees) ? item.assignees : [])
        .filter(isObject)
        .map((a) => text(a.login))
        .filter((login) => login !== ''),
      labels: (Array.isArray(item.labels) ? item.labels : [])
        .filter(isObject)
        .map((l) => text(l.name))
        .filter((name) => name !== ''),
      url: text(item.html_url) || text(item.url),
    }));
}

// `gh pr list --json number,headRefName,state,url,statusCheckRollup`
export function parsePullRequests(json: string): PullRequest[] {
  return parseArray(json, 'pull requests')
    .filter(isObject)
    .filter((item) => typeof item.number === 'number')
    .map((item) => ({
      number: item.number as number,
      headRefName: text(item.headRefName),
      state: text(item.state) || 'OPEN',
      url: text(item.url),
      checks: summarizeChecks(item.statusCheckRollup),
    }));
}

type Bucket = 'passed' | 'failed' | 'pending' | 'skipped';

// Same buckets as `gh pr checks`: pass, fail, pending, skipping.
function bucketOf(check: Json): Bucket {
  if (check.__typename === 'StatusContext') {
    const state = text(check.state);
    if (state === 'SUCCESS') return 'passed';
    if (state === 'FAILURE' || state === 'ERROR') return 'failed';
    return 'pending';
  }
  if (text(check.status) !== 'COMPLETED') return 'pending';
  const conclusion = text(check.conclusion);
  if (conclusion === 'SUCCESS') return 'passed';
  if (conclusion === 'SKIPPED' || conclusion === 'NEUTRAL') return 'skipped';
  if (conclusion === '') return 'pending';
  return 'failed';
}

export function summarizeChecks(rollup: unknown): ChecksSummary {
  const summary: ChecksSummary = {
    state: 'none',
    passed: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
  };
  for (const check of Array.isArray(rollup) ? rollup.filter(isObject) : []) summary[bucketOf(check)] += 1;
  if (summary.failed > 0) summary.state = 'failing';
  else if (summary.pending > 0) summary.state = 'pending';
  else if (summary.passed > 0 || summary.skipped > 0) summary.state = 'passing';
  return summary;
}

// One line like `gh pr checks` prints at its top: "2 passed, 1 failed, 1 pending".
export function formatChecks(checks: ChecksSummary): string {
  if (checks.state === 'none') return 'no checks';
  const parts: string[] = [];
  if (checks.failed) parts.push(`${checks.failed} failed`);
  if (checks.pending) parts.push(`${checks.pending} pending`);
  if (checks.passed) parts.push(`${checks.passed} passed`);
  if (checks.skipped) parts.push(`${checks.skipped} skipped`);
  return parts.join(', ');
}

// `git ls-remote --heads origin`: "<sha>\trefs/heads/<branch>" per line.
export function parseRemoteHeads(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.split('\t')[1]?.trim() ?? '')
    .filter((ref) => ref.startsWith('refs/heads/'))
    .map((ref) => ref.slice('refs/heads/'.length));
}

// Work branches are named `<type>/<nr>-<slug>`, e.g. `feat/2-deliver-board`.
export function issueNumberOfBranch(branch: string): number | null {
  const match = /^[a-z]+\/(\d+)-/.exec(branch);
  return match ? Number(match[1]) : null;
}

// The open PR wins over closed or merged ones; among equals the newest (highest number).
function pickPullRequest(candidates: PullRequest[]): PullRequest | null {
  const rank = (pr: PullRequest): number => (pr.state === 'OPEN' ? 1 : 0);
  const sorted = [...candidates].sort((a, b) => rank(b) - rank(a) || b.number - a.number);
  return sorted[0] ?? null;
}

export function buildRows(issues: Issue[], pullRequests: PullRequest[], branches: string[]): Row[] {
  return [...issues]
    .sort((a, b) => a.number - b.number)
    .map((issue) => {
      const pr = pickPullRequest(pullRequests.filter((p) => issueNumberOfBranch(p.headRefName) === issue.number));
      const branch = pr?.headRefName ?? branches.find((b) => issueNumberOfBranch(b) === issue.number) ?? null;
      return {
        number: issue.number,
        title: issue.title,
        assignee: issue.assignees.join(', '),
        labels: SHOWN_LABELS.filter((label) => issue.labels.includes(label)),
        branch,
        pr,
        url: pr?.url || issue.url,
      };
    });
}

export const ISSUES_PAGE_SIZE = 100;
export const ISSUES_MAX_PAGES = 2;

type PageResult<F> = { ok: true; body: string } | ({ ok: false } & F);

// Fetches REST issue pages (page size 100, at most 200 issues) until a short page; returns one merged JSON list.
export async function fetchIssuePages<F>(fetchPage: (page: number) => Promise<PageResult<F>>): Promise<PageResult<F>> {
  const all: unknown[] = [];
  for (let page = 1; page <= ISSUES_MAX_PAGES; page++) {
    const result = await fetchPage(page);
    if (!result.ok) return result;
    const items = parseArray(result.body, 'issues');
    all.push(...items);
    if (items.length < ISSUES_PAGE_SIZE) break;
  }
  return { ok: true, body: JSON.stringify(all) };
}
