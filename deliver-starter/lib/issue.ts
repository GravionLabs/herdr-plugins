// Check of an issue for `/deliver`: it exists, is open and is a PBI, Feature or Epic. Pure on the `gh` JSON.

const LEVELS = ['pbi', 'feature', 'epic'];

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
  return `#${nr} is not a PBI, Feature or Epic`;
}

// One readable reason for a failed `gh issue view`.
export function viewFailure(nr: number, code: string | number | null, stderr: string): string {
  if (code === 'ENOENT') return 'gh is not installed: install the GitHub CLI from https://cli.github.com';
  if (/could not resolve|not found|no issue/i.test(stderr)) return `#${nr} does not exist`;
  if (code === 4 || /gh auth login|authentication/i.test(stderr)) return 'gh is not authenticated: run `gh auth login`';
  const first = stderr.split('\n').find((line) => line.trim() !== '');
  return `#${nr}: ${first?.trim() ?? `gh failed (exit code ${code ?? 'unknown'})`}`;
}
