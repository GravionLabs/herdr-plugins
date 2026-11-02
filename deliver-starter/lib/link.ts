// The issue behind a clicked GitHub issue URL. Pure.

export type IssueLink = { repo: string; number: number };

// GitHub owner (letters, digits, `-`) and repository names (also `.` and `_`, never `.` or `..`). The slug goes to
// `gh --repo` as one argument; anything else in the clicked text (`;`, `&`, quotes, `%2e`) is refused.
const ISSUE_URL = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9._-]+)\/issues\/(\d+)$/;

export function parseIssueUrl(url: string | undefined): IssueLink | null {
  const match = ISSUE_URL.exec((url ?? '').trim());
  if (!match) return null;
  const [, owner, name, digits] = match as unknown as [string, string, string, string];
  if (name === '.' || name === '..') return null;
  const number = Number(digits);
  return Number.isSafeInteger(number) && number >= 1 ? { repo: `${owner}/${name}`, number } : null;
}
