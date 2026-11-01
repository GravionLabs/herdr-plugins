// herdr and OS side: pane lookup, herdr notification, optional OS notification, seen-state file. No background
// process is started: every command is awaited before the hook exits.
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './config.ts';
import type { Seen } from './dedupe.ts';
import { parseJson, text, type NotifyState } from './event.ts';
import type { Message, PaneFacts } from './message.ts';

const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

const exec = (command: string, args: string[], env?: Record<string, string>): Promise<string> =>
  new Promise((resolve) => {
    const options = { maxBuffer: 8 * 1024 * 1024, ...(env ? { env: { ...process.env, ...env } } : {}) };
    execFile(command, args, options, (error, stdout) => resolve(error ? '' : String(stdout)));
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

// Fixed WinRT toast script: title and body arrive through the environment, never interpolated into the script.
export const TOAST_SCRIPT = [
  "$t = [Security.SecurityElement]::Escape($env:HERDR_NOTIFY_TITLE)",
  "$b = [Security.SecurityElement]::Escape($env:HERDR_NOTIFY_BODY)",
  "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
  "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
  "$x = New-Object Windows.Data.Xml.Dom.XmlDocument",
  "$x.LoadXml(\"<toast><visual><binding template='ToastGeneric'><text>$t</text><text>$b</text></binding></visual></toast>\")",
  "$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
  "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($x))",
].join('; ');

// The OS notification of `message`. A missing tool resolves quietly: the herdr notification is already shown.
export async function systemNotify(message: Message): Promise<void> {
  if (process.platform === 'darwin') {
    await exec('osascript', ['-e', `display notification ${quote(message.body)} with title ${quote(message.title)}`]);
  } else if (process.platform === 'linux') {
    await exec('notify-send', ['--', message.title, message.body]);
  } else if (process.platform === 'win32') {
    await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', TOAST_SCRIPT], {
      HERDR_NOTIFY_TITLE: message.title,
      HERDR_NOTIFY_BODY: message.body,
    });
  }
}

// A failure of the hook itself as a herdr notification.
export async function notifyError(title: string, body: string): Promise<void> {
  await exec(herdrBin(), ['notification', 'show', title, '--body', body]);
}

export async function show(message: Message, state: NotifyState, config: Config): Promise<void> {
  const args = ['notification', 'show', message.title];
  if (message.body) args.push('--body', message.body);
  if (config.sound) args.push('--sound', state === 'done' ? 'done' : 'request');
  await exec(herdrBin(), args);
  if (config.systemNotification) await systemNotify(message);
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
