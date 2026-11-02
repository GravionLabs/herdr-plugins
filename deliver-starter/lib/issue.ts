// Check of an issue for `/deliver`: it exists, is open and is a PBI, Bug, Feature or Epic. Pure on the `gh` JSON.

import { classifyFailure, describe } from './errors.ts';

const LEVELS = ['pbi', 'bug', 'feature', 'epic'];

// Reason for the JSON of `gh issue view <nr> --json state,title,labels` when the issue cannot be started, else null.
export function checkIssue(nr: number, json: string): string | null {
  let issue: { state?: unknown; title?: unknown; labels?: unknown };
  try {
    issue = JSON.parse(json);
  } catch {
    return `#${nr}: unreadable gh output`;
  }
  if (typeof issue.state === 'string' && issue.state.toUpperCase() !== 'OPEN') {
    return `#${nr} is ${issue.state.toLowerCase()}`;
  }
  const title = typeof issue.title === 'string' ? issue.title : '';
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((l: unknown) => String((l as { name?: unknown } | null)?.name ?? '').toLowerCase())
    : [];
  const prefix = /^\[([^\]]+)\]/.exec(title)?.[1]?.toLowerCase();
  if ((prefix && LEVELS.includes(prefix)) || labels.some((l) => LEVELS.includes(l))) return null;
  return `#${nr} is not a PBI, Bug, Feature or Epic`;
}

// One readable reason for a failed `gh issue view`.
export function viewFailure(nr: number, code: string | number | null, stderr: string): string {
  const found = classifyFailure('gh', code, stderr);
  if (found) return describe(found);
  if (/could not resolve|not found|no issue/i.test(stderr)) return `#${nr} does not exist`;
  const first = stderr.split('\n').find((line) => line.trim() !== '');
  return `#${nr}: ${first?.trim() ?? `gh failed (exit code ${code ?? 'unknown'})`}`;
}
