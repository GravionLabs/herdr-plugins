// Suggestions for the popup: the open Epics, Features, PBIs and Bugs from the REST issues API. Pure except `loadIssues`.
import { classifyFailure, describe } from './errors.ts';
import { cachedApi, DEFAULT_TTL_MS, type CacheOptions } from './ghcache.ts';
import { failureLine, type Run } from './run.ts';

export type Level = 'Epic' | 'Feature' | 'PBI' | 'Bug';
export type Issue = {
  number: number;
  level: Level;
  title: string;
  milestone: string | null;
  needsRefinement: boolean;
  needsDecision: boolean;
  assignees: string[];
};
export type Loaded = { ok: true; issues: Issue[] } | { ok: false; reason: string; rateLimited?: true };

const LEVELS: Record<string, Level> = { pbi: 'PBI', feature: 'Feature', epic: 'Epic', bug: 'Bug' };

// Order of the level filter (Ctrl+L): all levels, then each level, then all again.
export const LEVEL_CYCLE: (Level | null)[] = [null, 'Epic', 'Feature', 'PBI', 'Bug'];
export const nextLevel = (level: Level | null): Level | null =>
  LEVEL_CYCLE[(LEVEL_CYCLE.indexOf(level) + 1) % LEVEL_CYCLE.length]!;

const names = (list: unknown, key: string): string[] =>
  Array.isArray(list)
    ? list.map((x) => String((x as Record<string, unknown> | null)?.[key] ?? '')).filter((x) => x !== '')
    : [];

const milestoneTitle = (value: unknown): string | null => {
  const title = typeof value === 'object' && value !== null ? (value as Record<string, unknown>).title : null;
  return typeof title === 'string' && title !== '' ? title : null;
};

// Issues of the JSON of `repos/{owner}/{repo}/issues` (pull requests, other levels and bad entries are skipped).
// Null when the JSON is unreadable or not a list.
export function parseIssues(json: string): Issue[] | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const issues: Issue[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    if (raw.pull_request !== undefined) continue;
    if (!Number.isInteger(raw.number) || typeof raw.title !== 'string') continue;
    const labels = names(raw.labels, 'name').map((l) => l.toLowerCase());
    const prefix = /^\[([^\]]+)\]/.exec(raw.title)?.[1]?.toLowerCase() ?? '';
    const level = LEVELS[prefix] ?? labels.map((l) => LEVELS[l]).find((l) => l !== undefined);
    if (!level) continue;
    issues.push({
      number: raw.number as number,
      level,
      title: raw.title,
      milestone: milestoneTitle(raw.milestone),
      needsRefinement: labels.includes('needs-refinement'),
      needsDecision: labels.includes('needs-decision'),
      assignees: names(raw.assignees, 'login'),
    });
  }
  return issues;
}

// The text after `#` of the token being typed (last token, no trailing space), or null when it does not start with `#`.
export function activeQuery(text: string): string | null {
  const match = /(?:^|\s)#([^\s]*)$/.exec(text);
  return match ? match[1]! : null;
}

// Live filter: the query matches the start of the number or any part of the title.
export function filterIssues(issues: Issue[], query: string): Issue[] {
  const q = query.trim().toLowerCase();
  if (q === '') return issues;
  return issues.filter((i) => String(i.number).startsWith(q) || i.title.toLowerCase().includes(q));
}

// Narrows the list to one level and one milestone; null keeps everything.
export function scopeIssues(issues: Issue[], scope: { level: Level | null; milestone: string | null }): Issue[] {
  return issues.filter(
    (i) => (scope.level === null || i.level === scope.level) && (scope.milestone === null || i.milestone === scope.milestone),
  );
}

// Replaces the `#…` token being typed by the issue number and a space.
export const insertNumber = (text: string, nr: number): string => text.replace(/#[^\s]*$/, `${nr} `);

export function markers(issue: Issue): string {
  return [
    issue.needsRefinement ? '[needs-refinement]' : '',
    issue.needsDecision ? '[needs-decision]' : '',
    issue.assignees.length > 0 ? `[@${issue.assignees.join(',@')}]` : '',
  ]
    .filter((m) => m !== '')
    .join(' ');
}

// Cache of the state directory for the REST calls (HERDR_PLUGIN_STATE_DIR); no directory means no cache.
export const stateCache = (): CacheOptions => ({ dir: process.env.HERDR_PLUGIN_STATE_DIR || undefined, ttlMs: DEFAULT_TTL_MS });

// The open issues through `gh api` (REST, ETag-revalidated, cached in the state directory), 100 per page up to `limit`;
// a failure becomes a readable reason, never a throw. A rate limit names its reset time.
export async function loadIssues(run: Run, repo: string, limit: number, cache: CacheOptions = { dir: undefined, ttlMs: 0 }): Promise<Loaded> {
  const perPage = Math.min(Math.max(limit, 1), 100);
  const issues: Issue[] = [];
  for (let page = 1; issues.length < limit; page++) {
    const got = await cachedApi(run, repo, `repos/{owner}/{repo}/issues?state=open&per_page=${perPage}&page=${page}`, cache);
    if (!got.ok) {
      if ('rateLimit' in got) return { ok: false, reason: got.rateLimit.message, rateLimited: true };
      const found = classifyFailure('gh', got.failure.code, got.failure.stderr);
      return { ok: false, reason: found ? describe(found) : failureLine({ ok: false, code: got.failure.code, stdout: '', stderr: got.failure.stderr }) };
    }
    const parsed = parseIssues(got.body);
    if (!parsed) return { ok: false, reason: 'unreadable gh output' };
    issues.push(...parsed);
    if ((JSON.parse(got.body) as unknown[]).length < perPage) break;
  }
  return { ok: true, issues: issues.slice(0, limit) };
}
