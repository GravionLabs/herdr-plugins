// Context of the focused pane for the palette. Pure, so it is testable without herdr.
//
// SPIKE (#40, input for #42): does `herdr plugin action invoke`, started by a detached process after the
// popup closed, see the original pane as focused, or must the run pass pane/cwd explicitly?
//
// Not verified live: this was written without a running herdr session, and `herdr plugin action invoke
// --help` (0.9.5) lists only `--plugin <ID>`, no `--current` or pane option.
// Documented (plugins.mdx, v0.9.5): a popup "has no pane ID, does not change plugin focus context" and its
// process gets no HERDR_PANE_ID; "the underlying tiled pane remains available through
// HERDR_PLUGIN_CONTEXT_JSON". An action started by `plugin action invoke` gets HERDR_PLUGIN_CONTEXT_JSON
// "when available for that invocation".
// Assumed (unverified): focus is unchanged by the popup, so an invoke after it closed builds its context
// from the same focused pane. Likely, but not proven.
// Decision for #42: do not rely on it. Capture PALETTE_CONTEXT (pane id + cwd) when the popup opens and hand
// it explicitly to the later run (env or cwd of the spawned process); treat the focus-based context of
// the invoked action only as a fallback. Verify live with a detached `herdr plugin action invoke` that
// prints HERDR_PLUGIN_CONTEXT_JSON before building on it.

export type PaletteContext = {
  paneId: string | null;
  cwd: string | null;
};

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

// Pane id and cwd of the focused pane from HERDR_PLUGIN_CONTEXT_JSON; the workspace cwd when the pane has none.
// Null when there is no usable context.
export function contextFromJson(contextJson: string | undefined): PaletteContext | null {
  if (!contextJson) return null;
  let context: unknown;
  try {
    context = JSON.parse(contextJson);
  } catch {
    return null;
  }
  if (typeof context !== 'object' || context === null || Array.isArray(context)) return null;
  const record = context as Record<string, unknown>;
  const paneId = text(record.focused_pane_id);
  const cwd = text(record.focused_pane_cwd) ?? text(record.workspace_cwd);
  if (paneId === null && cwd === null) return null;
  return { paneId, cwd };
}

// Parses PALETTE_CONTEXT as set by the open action; null when absent or invalid.
export function parsePaletteContext(value: string | undefined): PaletteContext | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const { paneId, cwd } = parsed as Record<string, unknown>;
    return { paneId: text(paneId), cwd: text(cwd) };
  } catch {
    return null;
  }
}
