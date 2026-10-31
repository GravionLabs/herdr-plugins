// Applies a layout through the herdr CLI. Panes are matched by label, so a second run creates nothing.
import type { Layout } from './layout.ts';
import { failureLine, type Run } from './run.ts';

export type Pane = { id: string; label: string | null; cwd: string | null; agent: boolean; tabId: string | null };

// `misplaced`: layout panes whose known cwd is not the repository root (an agent root pane cannot be moved, a reused pane is left alone).
export type Outcome = { created: string[]; reused: string[]; misplaced: string[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

// `herdr pane list` output -> panes.
export function parsePanes(json: string): Pane[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('herdr pane list: invalid JSON');
  }
  const result = isObject(data) && isObject(data.result) ? data.result : {};
  const list = Array.isArray(result.panes) ? result.panes : [];
  const panes: Pane[] = [];
  for (const raw of list) {
    if (!isObject(raw)) continue;
    const id = text(raw.pane_id);
    if (id) panes.push({ id, label: text(raw.label), cwd: text(raw.cwd), agent: text(raw.agent) !== null, tabId: text(raw.tab_id) });
  }
  return panes;
}

// The id of the pane `herdr pane split` created.
export function parseSplit(json: string): string {
  try {
    const data: unknown = JSON.parse(json);
    const result = isObject(data) && isObject(data.result) ? data.result : {};
    const id = isObject(result.pane) ? text(result.pane.pane_id) : null;
    if (id) return id;
  } catch {
    // falls through
  }
  throw new Error('herdr pane split: no pane id in the response');
}

export const splitArgs = (from: string, direction: string, ratio: number, cwd: string): string[] => [
  'pane', 'split', from, '--direction', direction, '--ratio', String(ratio), '--cwd', cwd, '--no-focus',
];

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

// Brings the workspace to `layout`. `rootId` is the focused pane (first pane of the layout); `workspaceId` scopes
// the pane list. Existing panes labelled like a layout pane are reused and never get their command run again.
export async function applyLayout(
  run: Run,
  herdr: string,
  layout: Layout,
  repo: string,
  rootId: string,
  workspaceId: string | null,
): Promise<Outcome> {
  const call = async (args: string[]): Promise<string> => {
    const result = await run(herdr, args, repo);
    if (!result.ok) throw new Error(`herdr ${args.slice(0, 2).join(' ')}: ${failureLine(result)}`);
    return result.stdout;
  };

  const listArgs = ['pane', 'list', ...(workspaceId ? ['--workspace', workspaceId] : [])];
  const all = parsePanes(await call(listArgs));
  // `pane list --workspace` covers every tab; only the tab of the root pane counts for name reuse.
  const rootTab = all.find((pane) => pane.id === rootId)?.tabId ?? null;
  const existing = rootTab ? all.filter((pane) => pane.tabId === rootTab) : all;
  const ids = new Map<string, string>(); // layout name -> pane id
  const outcome: Outcome = { created: [], reused: [], misplaced: [] };

  for (const [index, spec] of layout.panes.entries()) {
    const found = existing.find((pane) => pane.label === spec.name);
    if (found) {
      ids.set(spec.name, found.id);
      outcome.reused.push(spec.name);
      if (found.cwd !== null && found.cwd !== repo) outcome.misplaced.push(spec.name);
      continue;
    }
    let paneId: string;
    if (index === 0 || !spec.split) {
      paneId = rootId;
      await call(['pane', 'rename', paneId, spec.name]);
      const root = existing.find((pane) => pane.id === rootId);
      if (root && root.cwd !== repo) {
        if (!root.agent) await call(['pane', 'run', paneId, `cd -- ${shellQuote(repo)}`]);
        else if (root.cwd !== null) outcome.misplaced.push(spec.name);
      }
    } else {
      const from = ids.get(spec.split.from);
      if (!from) throw new Error(`pane "${spec.name}": split.from "${spec.split.from}" has no pane`);
      paneId = parseSplit(await call(splitArgs(from, spec.split.direction, spec.split.ratio, repo)));
      await call(['pane', 'rename', paneId, spec.name]);
    }
    if (spec.command) await call(['pane', 'run', paneId, spec.command]);
    ids.set(spec.name, paneId);
    outcome.created.push(spec.name);
  }
  return outcome;
}
