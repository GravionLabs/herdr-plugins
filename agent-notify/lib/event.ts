// Payload of `pane.agent_status_changed` (HERDR_PLUGIN_EVENT_JSON), bare or wrapped in the socket envelope
// `{event, data}`: `{pane_id, workspace_id, agent_status, agent, display_agent, title, state_labels}`. Pure.

export type NotifyState = 'done' | 'blocked';

export type StatusEvent = {
  paneId: string;
  workspaceId: string;
  state: NotifyState;
  agent: string | null;
  displayAgent: string | null;
};

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export function parseJson(json: string | undefined): Json | null {
  if (!json) return null;
  try {
    const data: unknown = JSON.parse(json);
    return isObject(data) ? data : null;
  } catch {
    return null;
  }
}

// The event when the new status is `done` or `blocked`; null for every other status and for malformed input.
export function statusEvent(eventJson: string | undefined): StatusEvent | null {
  const event = parseJson(eventJson);
  if (!event) return null;
  const data = isObject(event.data) ? event.data : event;
  const state = data.agent_status;
  if (state !== 'done' && state !== 'blocked') return null;
  const paneId = text(data.pane_id);
  const workspaceId = text(data.workspace_id);
  if (!paneId || !workspaceId) return null;
  return { paneId, workspaceId, state, agent: text(data.agent), displayAgent: text(data.display_agent) };
}
