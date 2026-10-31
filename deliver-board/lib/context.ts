// Repository lookup and error wording for the board. Pure, so it is testable without herdr or gh.

// The cwd of the focused pane from HERDR_PLUGIN_CONTEXT_JSON; the workspace cwd when the pane has none.
export function cwdFromContext(contextJson: string | undefined): string | null {
  if (!contextJson) return null;
  let context: unknown;
  try {
    context = JSON.parse(contextJson);
  } catch {
    return null;
  }
  if (typeof context !== 'object' || context === null) return null;
  const { focused_pane_cwd: pane, workspace_cwd: workspace } = context as Record<string, unknown>;
  if (typeof pane === 'string' && pane !== '') return pane;
  if (typeof workspace === 'string' && workspace !== '') return workspace;
  return null;
}

export type CommandFailure = {
  code?: string | number | null;
  stderr?: string;
};

// One readable line for a failed `gh` call instead of a stack trace.
export function ghErrorLine(failure: CommandFailure): string {
  if (failure.code === 'ENOENT') return 'gh is not installed: install the GitHub CLI from https://cli.github.com';
  const stderr = (failure.stderr ?? '').trim();
  if (failure.code === 4 || /gh auth login|not logged in|authentication/i.test(stderr)) {
    return 'gh is not authenticated: run `gh auth login`';
  }
  const first = stderr.split('\n').find((line) => line.trim() !== '');
  return `gh failed: ${first?.trim() ?? `exit code ${failure.code ?? 'unknown'}`}`;
}
