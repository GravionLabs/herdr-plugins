// Opens a finding in $EDITOR in a new split pane next to the focused pane.
import { join } from 'node:path';
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

// Returns null on success, else the reason.
export async function openFinding(
  run: Run,
  herdr: string,
  toplevel: string,
  pane: string | undefined,
  editor: string | undefined,
  finding: Finding,
): Promise<string | null> {
  const args = ['pane', 'split', ...(pane ? [pane] : ['--current']), '--direction', 'right', '--cwd', toplevel, '--focus'];
  const split = await run(herdr, args, toplevel);
  if (!split.ok) return `herdr pane split failed: ${failureLine(split)}`;
  const id = paneId(split.stdout);
  if (!id) return 'herdr pane split returned no pane';
  const command = editorCommand(editor, join(toplevel, finding.file), finding.line);
  const ran = await run(herdr, ['pane', 'run', id, command], toplevel);
  return ran.ok ? null : `herdr pane run failed: ${failureLine(ran)}`;
}
