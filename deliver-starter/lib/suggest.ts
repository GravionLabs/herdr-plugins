// Suggestions for the popup: the open Epics, Features, PBIs and Bugs from `gh issue list`. Pure except `loadIssues`.
import { classifyFailure, describe } from './errors.ts';
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
export type Loaded = { ok: true; issues: Issue[] } | { ok: false; reason: string };

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

// Issues of the JSON of `gh issue list --json number,title,labels,assignees,milestone`; other levels and bad entries are skipped.
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

// One `gh issue list` call in the repository; a failure becomes a readable reason, never a throw.
export async function loadIssues(run: Run, repo: string, limit: number): Promise<Loaded> {
  const args = ['issue', 'list', '--state', 'open', '--json', 'number,title,labels,assignees,milestone', '--limit', String(limit)];
  const result = await run('gh', args, repo);
  if (!result.ok) {
    const found = classifyFailure('gh', result.code, result.stderr);
    return { ok: false, reason: found ? describe(found) : failureLine(result) };
  }
  const issues = parseIssues(result.stdout);
  return issues ? { ok: true, issues } : { ok: false, reason: 'unreadable gh output' };
}
