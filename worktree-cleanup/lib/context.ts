// herdr invocation context: the focused pane's cwd and the payload of the `worktree.removed` event. Pure.

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

function parse(json: string | undefined): Json | null {
  if (!json) return null;
  try {
    const data: unknown = JSON.parse(json);
    return isObject(data) ? data : null;
  } catch {
    return null;
  }
}

// The cwd of the focused pane from HERDR_PLUGIN_CONTEXT_JSON; the workspace cwd when the pane has none.
export function cwdFromContext(contextJson: string | undefined): string | null {
  const context = parse(contextJson);
  if (!context) return null;
  return text(context.focused_pane_cwd) ?? text(context.workspace_cwd);
}

export type RemovedWorktree = {
  path: string | null;
  branch: string | null;
  // the main checkout of the repository, when herdr still knew the workspace of the removed worktree
  repoRoot: string | null;
};

// HERDR_PLUGIN_EVENT_JSON of `worktree.removed`: `{workspace_id, workspace, worktree: {path, branch, ...}, forced}`,
// either bare or wrapped in the socket envelope `{event, data}`.
export function removedWorktreeFromEvent(eventJson: string | undefined): RemovedWorktree | null {
  const event = parse(eventJson);
  if (!event) return null;
  const data = isObject(event.data) ? event.data : event;
  const worktree = isObject(data.worktree) ? data.worktree : {};
  const workspace = isObject(data.workspace) ? data.workspace : {};
  const provenance = isObject(workspace.worktree) ? workspace.worktree : {};
  const branch = text(worktree.branch)?.replace(/^refs\/heads\//, '') ?? null;
  const path = text(worktree.path) ?? text(data.path);
  if (!branch && !path) return null;
  return { path, branch, repoRoot: text(provenance.repo_root) };
}
