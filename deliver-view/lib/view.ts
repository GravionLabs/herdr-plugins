import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

export type ViewSort = { field: string | { token: string }; order: 'asc' | 'desc' };

export type ViewParams = {
  source: string;
  label: string;
  filter: null;
  sort: ViewSort[];
};

const STATE_FILE = 'view.json';

// The `agent.view.set` params of the view "deliver". No filter: every agent stays listed.
// Sorts are stable and evaluated in order:
//   1. attention desc: blocked agents on top;
//   2. token `deliver` asc: agents with the token before the others (a missing value sorts last);
//   3. state_change_seq desc: the most recent state change first.
export function deliverView(pluginId: string): ViewParams {
  return {
    source: `plugin:${pluginId}`,
    label: 'deliver',
    filter: null,
    sort: [
      { field: 'attention', order: 'desc' },
      { field: { token: 'deliver' }, order: 'asc' },
      { field: 'state_change_seq', order: 'desc' },
    ],
  };
}

// Saves the view under the plugin state directory so a startup hook can reapply it.
export function saveView(stateDir: string, view: ViewParams): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, STATE_FILE), `${JSON.stringify(view, null, 2)}\n`);
}

// The saved view, or null when none was saved or the file is unreadable or not a view.
export function loadView(stateDir: string): ViewParams | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(stateDir, STATE_FILE), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const view = parsed as Partial<ViewParams>;
    if (typeof view.source !== 'string' || !Array.isArray(view.sort)) return null;
    return view as ViewParams;
  } catch {
    return null;
  }
}

// One request over the herdr API socket (newline-delimited JSON, one response line).
// herdr 0.9.5 has no CLI command for agent.view.set; HERDR_BIN_PATH is only used to notify about a failure.
export function sendRequest(socketPath: string, method: string, params: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`${JSON.stringify({ id: 'deliver-view', method, params })}\n`));
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      const end = buffer.indexOf('\n');
      if (end === -1) return;
      socket.end();
      try {
        const response = JSON.parse(buffer.slice(0, end)) as { error?: { message?: string } };
        if (response.error) reject(new Error(response.error.message ?? 'herdr rejected the request'));
        else resolve(response);
      } catch (error) {
        reject(error);
      }
    });
    socket.on('close', () => reject(new Error('herdr closed the socket without a response')));
  });
}

export type Env = Record<string, string | undefined>;

// Sets the view. Mode `apply` (action) saves the default view first; mode `startup` reapplies the saved
// view and falls back to the default when nothing was saved.
export async function applyView(env: Env, mode: 'apply' | 'startup'): Promise<void> {
  const socketPath = env.HERDR_SOCKET_PATH;
  const stateDir = env.HERDR_PLUGIN_STATE_DIR;
  if (!socketPath) throw new Error('HERDR_SOCKET_PATH is not set (run inside herdr)');
  if (!stateDir) throw new Error('HERDR_PLUGIN_STATE_DIR is not set (run inside herdr)');
  const defaults = deliverView(env.HERDR_PLUGIN_ID || 'deliver-view');
  let view = defaults;
  if (mode === 'apply') saveView(stateDir, defaults);
  else view = loadView(stateDir) ?? defaults;
  await sendRequest(socketPath, 'agent.view.set', view);
}
