// Milestone picker for the popup: the open milestones from the GitHub API, the current one first. Pure except
// `loadMilestones`.
import { classifyFailure, describe } from './errors.ts';
import { cachedApi, type CacheOptions } from './ghcache.ts';
import { failureLine, type Run } from './run.ts';

export type Milestone = {
  number: number;
  title: string;
  open: number;
  closed: number;
  due: string | null; // YYYY-MM-DD
  current: boolean;
};
export type LoadedMilestones = { ok: true; milestones: Milestone[] } | { ok: false; reason: string; rateLimited?: true };

const count = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

// Milestones of the JSON of `gh api repos/{owner}/{repo}/milestones`, in API order; bad entries are skipped.
// Null when the JSON is unreadable or not a list.
export function parseMilestones(json: string): Milestone[] | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const milestones: Milestone[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    if (!Number.isInteger(raw.number) || typeof raw.title !== 'string' || raw.title.trim() === '') continue;
    if (raw.state !== undefined && raw.state !== 'open') continue;
    const due = typeof raw.due_on === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.due_on) ? raw.due_on.slice(0, 10) : null;
    milestones.push({
      number: raw.number as number,
      title: raw.title,
      open: count(raw.open_issues),
      closed: count(raw.closed_issues),
      due,
      current: false,
    });
  }
  return milestones;
}

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;

// [major, minor, patch] of an `x.y.z` title, null for other names.
const version = (title: string): number[] | null => {
  const match = VERSION.exec(title.trim());
  return match ? match.slice(1).map(Number) : null;
};

function compare(a: Milestone, b: Milestone): number {
  const va = version(a.title);
  const vb = version(b.title);
  if (va && vb) return va[0]! - vb[0]! || va[1]! - vb[1]! || va[2]! - vb[2]! || a.number - b.number;
  if (va || vb) return va ? -1 : 1;
  return a.number - b.number;
}

// Marks the current milestone and orders it first; the rest by version (`x.y.z` titles ascending), then other names by
// number. Current: the lowest `x.y.z` milestone with open work (as `github-milestone current`; a name that is not a
// version is never current, an already released milestone without open work is skipped).
export function orderMilestones(milestones: Milestone[]): Milestone[] {
  const sorted = [...milestones].map((m) => ({ ...m, current: false })).sort(compare);
  const current = sorted.find((m) => m.open > 0 && version(m.title) !== null);
  if (!current) return sorted;
  current.current = true;
  return [current, ...sorted.filter((m) => m !== current)];
}

// The text after `@` of the token being typed (last token, no trailing space), or null when it does not start with `@`.
export function activeMilestoneQuery(text: string): string | null {
  const match = /(?:^|\s)@([^\s]*)$/.exec(text);
  return match ? match[1]! : null;
}

// Live filter: the query matches any part of the milestone name, case-insensitive.
export function filterMilestones(milestones: Milestone[], query: string): Milestone[] {
  const q = query.trim().toLowerCase();
  return q === '' ? milestones : milestones.filter((m) => m.title.toLowerCase().includes(q));
}

// The argument line for a milestone: `--milestone <name> `, the name quoted when it has spaces or quotes.
export const milestoneArgs = (name: string): string =>
  `--milestone ${/[\s"']/.test(name) ? JSON.stringify(name) : name} `;

export function describeMilestone(m: Milestone): string {
  const due = m.due ? `, due ${m.due}` : '';
  return `${m.title}  (${m.open} open, ${m.closed} closed${due})${m.current ? '  current' : ''}`;
}

// One `gh api` call in the repository (ETag-revalidated, cached in the state directory); a failure becomes a readable
// reason, never a throw.
export async function loadMilestones(run: Run, repo: string, cache: CacheOptions = { dir: undefined, ttlMs: 0 }): Promise<LoadedMilestones> {
  const got = await cachedApi(run, repo, 'repos/{owner}/{repo}/milestones?state=open&per_page=100', cache);
  if (!got.ok) {
    if ('rateLimit' in got) return { ok: false, reason: got.rateLimit.message, rateLimited: true };
    const found = classifyFailure('gh', got.failure.code, got.failure.stderr);
    return { ok: false, reason: found ? describe(found) : failureLine({ ok: false, code: got.failure.code, stdout: '', stderr: got.failure.stderr }) };
  }
  const milestones = parseMilestones(got.body);
  return milestones ? { ok: true, milestones: orderMilestones(milestones) } : { ok: false, reason: 'unreadable gh output' };
}
