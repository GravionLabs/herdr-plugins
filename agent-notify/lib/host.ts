// herdr and OS side: pane lookup, herdr notification, optional macOS notification, seen-state file. No background
// process is started: every command is awaited before the hook exits.
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './config.ts';
import type { Seen } from './dedupe.ts';
import { parseJson, text, type NotifyState } from './event.ts';
import type { Message, PaneFacts } from './message.ts';

const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

const exec = (command: string, args: string[]): Promise<string> =>
  new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : String(stdout)));
  });

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

// `result` of a `herdr <noun> get` call.
async function get(args: string[]): Promise<Record<string, unknown>> {
  return record(parseJson(await exec(herdrBin(), args))?.result);
}

export async function lookup(paneId: string, workspaceId: string): Promise<PaneFacts> {
  const pane = record((await get(['pane', 'get', paneId])).pane);
  const tabId = text(pane.tab_id);
  const workspace = record((await get(['workspace', 'get', workspaceId])).workspace);
  const tab = tabId ? record((await get(['tab', 'get', tabId])).tab) : {};
  const tokens: Record<string, string> = {};
  for (const [name, value] of Object.entries(record(pane.tokens))) if (typeof value === 'string') tokens[name] = value;
  return { workspace: text(workspace.label), tab: text(tab.label), tokens };
}

// The AppleScript string literal of `value`.
export const quote = (value: string): string => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

export async function show(message: Message, state: NotifyState, config: Config): Promise<void> {
  const args = ['notification', 'show', message.title];
  if (message.body) args.push('--body', message.body);
  if (config.sound) args.push('--sound', state === 'done' ? 'done' : 'request');
  await exec(herdrBin(), args);
  if (config.systemNotification && process.platform === 'darwin') {
    await exec('osascript', ['-e', `display notification ${quote(message.body)} with title ${quote(message.title)}`]);
  }
}

const dir = (name: string): string => process.env[name] || process.cwd();

export function readConfigFile(): Promise<string | undefined> {
  return readFile(join(dir('HERDR_PLUGIN_CONFIG_DIR'), 'config.json'), 'utf8').catch(() => undefined);
}

export async function loadSeen(): Promise<Seen> {
  const raw = await readFile(join(dir('HERDR_PLUGIN_STATE_DIR'), 'seen.json'), 'utf8').catch(() => undefined);
  const seen: Seen = {};
  for (const [k, v] of Object.entries(parseJson(raw) ?? {})) if (typeof v === 'number') seen[k] = v;
  return seen;
}

export async function saveSeen(seen: Seen): Promise<void> {
  const stateDir = dir('HERDR_PLUGIN_STATE_DIR');
  await mkdir(stateDir, { recursive: true });
  await writeFile(join(stateDir, 'seen.json'), JSON.stringify(seen));
}
