// Opens a finding in $EDITOR in a new split pane next to the focused pane.
import { isAbsolute, join, relative, sep } from 'node:path';
import { editorCommand, type Finding } from './review.ts';
import { failureLine, type Run } from './run.ts';

type Created = { result?: { pane?: { pane_id?: unknown }; pane_id?: unknown } };

function paneId(stdout: string): string | null {
  try {
    const result = (JSON.parse(stdout) as Created).result;
    const id = result?.pane?.pane_id ?? result?.pane_id;
    return typeof id === 'string' && id !== '' ? id : null;
  } catch {
    return null;
  }
}

// Characters that end or escape a single-quoted string in some pane shell (fish: `\'`, PowerShell: `'` and the
// typographic single quotes) or submit the typed line early (newline, other control characters).
const UNSAFE = /['\\‘-‛\x00-\x1f\x7f-\x9f]/;

// The absolute path of a finding's file inside `toplevel`, else the reason it is not opened. The file name comes
// from the review file: `..` must not leave the worktree, and the name is typed into a shell.
export function findingPath(toplevel: string, file: string): { path: string } | { reason: string } {
  const bad = UNSAFE.exec(file)?.[0];
  if (bad !== undefined) return { reason: `Not opened: ${JSON.stringify(file)} contains ${JSON.stringify(bad)}` };
  const path = join(toplevel, file);
  const rel = relative(toplevel, path);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return { reason: `Not opened: ${JSON.stringify(file)} is outside ${toplevel}` };
  }
  return { path };
}

// Returns null on success, else the reason.
export async function openFinding(
  run: Run,
  herdr: string,
  toplevel: string,
  pane: string | undefined,
  editor: string | undefined,
  finding: Finding,
): Promise<string | null> {
  const target = findingPath(toplevel, finding.file);
  if ('reason' in target) return target.reason;
  const args = ['pane', 'split', ...(pane ? [pane] : ['--current']), '--direction', 'right', '--cwd', toplevel, '--focus'];
  const split = await run(herdr, args, toplevel);
  if (!split.ok) return `herdr pane split failed: ${failureLine(split)}`;
  const id = paneId(split.stdout);
  if (!id) return 'herdr pane split returned no pane';
  const command = editorCommand(editor, target.path, finding.line);
  const ran = await run(herdr, ['pane', 'run', id, command], toplevel);
  return ran.ok ? null : `herdr pane run failed: ${failureLine(ran)}`;
}
