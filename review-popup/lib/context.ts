// herdr invocation context: the focused pane's cwd. Pure.

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


// The id of the focused pane from HERDR_PLUGIN_CONTEXT_JSON, else null.
export function paneFromContext(contextJson: string | undefined): string | null {
  const context = parse(contextJson);
  return context ? text(context.focused_pane_id) : null;
}
