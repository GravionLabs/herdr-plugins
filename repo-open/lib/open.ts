// Opens a repository: focuses its existing workspace, or creates one with the configured tabs.
// All herdr calls go through `run`, so the tests use a fake runner that records them.
import { sep } from 'node:path';
import { focusTab, type Tab } from './config.ts';
import type { Repo } from './discover.ts';
import type { Run } from './host.ts';

export type Workspace = { id: string; label: string | null };
export type Pane = { workspaceId: string; cwd: string | null };
export type Outcome = { kind: 'focused' | 'created'; workspaceId: string; label: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

function result(json: string, what: string): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(json);
    if (isObject(data) && isObject(data.result)) return data.result;
  } catch {
    // falls through
  }
  throw new Error(`herdr ${what}: unexpected response`);
}

export function parseWorkspaces(json: string): Workspace[] {
  const list = result(json, 'workspace list').workspaces;
  return (Array.isArray(list) ? list : [])
    .filter(isObject)
    .map((w) => ({ id: text(w.workspace_id), label: text(w.label) }))
    .filter((w): w is Workspace => w.id !== null);
}

export function parsePanes(json: string): Pane[] {
  const list = result(json, 'pane list').panes;
  return (Array.isArray(list) ? list : [])
    .filter(isObject)
    .map((p) => ({ workspaceId: text(p.workspace_id), cwd: text(p.foreground_cwd) ?? text(p.cwd) }))
    .filter((p): p is Pane => p.workspaceId !== null);
}

// `.result.<key>.<idKey>` of a create response.
function createdId(json: string, what: string, key: string, idKey: string): string {
  const value = result(json, what)[key];
  const id = isObject(value) ? text(value[idKey]) : null;
  if (!id) throw new Error(`herdr ${what}: no ${key} in the response`);
  return id;
}

const inside = (path: string, repo: string): boolean => path === repo || path.startsWith(repo.endsWith(sep) ? repo : repo + sep);

// The workspace of `repo`: the first one with a pane inside the repository, else one labelled with its name
// whose panes report no cwd elsewhere (two repositories can share a name). Null when there is none.
export function findWorkspace(repo: Repo, workspaces: Workspace[], panes: Pane[]): Workspace | null {
  const byCwd = workspaces.find((w) => panes.some((p) => p.workspaceId === w.id && p.cwd !== null && inside(p.cwd, repo.path)));
  if (byCwd) return byCwd;
  return (
    workspaces.find(
      (w) => w.label === repo.name && panes.every((p) => p.workspaceId !== w.id || p.cwd === null || inside(p.cwd, repo.path)),
    ) ?? null
  );
}

// The label of a new workspace: the name, or the relative path when another workspace already uses the name.
export const workspaceLabel = (repo: Repo, workspaces: Workspace[]): string =>
  workspaces.some((w) => w.label === repo.name) ? repo.rel : repo.name;

export async function openRepo(run: Run, herdr: string, repo: Repo, tabs: Tab[]): Promise<Outcome> {
  const call = async (args: string[]): Promise<string> => {
    const r = await run(herdr, args);
    if (!r.ok) throw new Error(`herdr ${args.slice(0, 2).join(' ')}: ${r.reason}`);
    return r.stdout;
  };

  const workspaces = parseWorkspaces(await call(['workspace', 'list']));
  const existing = findWorkspace(repo, workspaces, parsePanes(await call(['pane', 'list'])));
  if (existing) {
    await call(['workspace', 'focus', existing.id]);
    return { kind: 'focused', workspaceId: existing.id, label: existing.label ?? repo.name };
  }

  const label = workspaceLabel(repo, workspaces);
  const created = await call(['workspace', 'create', '--cwd', repo.path, '--label', label, '--no-focus']);
  const workspaceId = createdId(created, 'workspace create', 'workspace', 'workspace_id');
  const tabIds = new Map<string, string>();
  for (const [index, tab] of tabs.entries()) {
    let tabId: string;
    let paneId: string;
    if (index === 0) {
      tabId = createdId(created, 'workspace create', 'tab', 'tab_id');
      paneId = createdId(created, 'workspace create', 'root_pane', 'pane_id');
      await call(['tab', 'rename', tabId, tab.label]);
    } else {
      const json = await call(['tab', 'create', '--workspace', workspaceId, '--cwd', repo.path, '--label', tab.label, '--no-focus']);
      tabId = createdId(json, 'tab create', 'tab', 'tab_id');
      paneId = createdId(json, 'tab create', 'root_pane', 'pane_id');
    }
    if (tab.command) await call(['pane', 'run', paneId, tab.command]);
    tabIds.set(tab.label, tabId);
  }
  await call(['tab', 'focus', tabIds.get(focusTab(tabs).label)!]);
  await call(['workspace', 'focus', workspaceId]);
  return { kind: 'created', workspaceId, label };
}
