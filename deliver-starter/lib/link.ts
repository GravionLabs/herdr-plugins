// The issue behind a clicked GitHub issue URL. Pure.

export type IssueLink = { repo: string; number: number };

export function parseIssueUrl(url: string | undefined): IssueLink | null {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)$/.exec((url ?? '').trim());
  if (!match) return null;
  const number = Number(match[2]);
  return number >= 1 ? { repo: match[1] as string, number } : null;
}
