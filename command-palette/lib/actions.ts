// Entries from the output of `herdr plugin action list`. Pure.
import type { Entry } from './entries.ts';

const OWN_ACTION = 'command-palette.open';

// herdr names platforms macos/linux; Node says darwin/linux.
export const herdrPlatform = (nodePlatform: string = process.platform): string =>
  nodePlatform === 'darwin' ? 'macos' : nodePlatform;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

// Empty for unparseable or unexpected input. Own action and actions for other platforms are left out.
export function parseActions(json: string, platform: string): Entry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const actions = (parsed as { result?: { actions?: unknown } } | null)?.result?.actions;
  if (!Array.isArray(actions)) return [];
  const entries: Entry[] = [];
  for (const item of actions) {
    if (typeof item !== 'object' || item === null) continue;
    const { plugin_id, action_id, title, platforms } = item as Record<string, unknown>;
    const plugin = str(plugin_id);
    const action = str(action_id);
    if (!plugin || !action) continue;
    if (`${plugin}.${action}` === OWN_ACTION) continue;
    if (Array.isArray(platforms) && platforms.length > 0 && !platforms.includes(platform)) continue;
    entries.push({
      id: `${plugin}.${action}`,
      group: plugin,
      title: str(title) ?? action,
      run: { kind: 'action', plugin, action },
    });
  }
  return entries;
}
