// What the detached runner executes for an entry. Pure.
import { homedir } from 'node:os';
import type { PaletteContext } from './context.ts';
import type { Entry } from './entries.ts';

export type Command = { command: string; args: string[]; cwd?: string; env: Record<string, string> };

// `plugin action invoke` has no pane option (#40), so the original pane goes in explicitly: cwd and HERDR_PANE_ID.
// A config command is spawned as given (argument array, no shell): cwd of the entry, else of the context, else `home`.
export function invokeCommand(
  entry: Entry,
  context: PaletteContext | null,
  herdr: string,
  home: string = homedir(),
): Command | null {
  if (entry.run?.kind === 'command') {
    const [command, ...args] = entry.run.command;
    if (!command) return null;
    return { command, args, cwd: entry.run.cwd || context?.cwd || home, env: {} };
  }
  if (entry.run?.kind !== 'action') return null;
  const env: Record<string, string> = {};
  if (context?.paneId) env.HERDR_PANE_ID = context.paneId;
  const command: Command = {
    command: herdr,
    args: ['plugin', 'action', 'invoke', entry.run.action, '--plugin', entry.run.plugin],
    env,
  };
  if (context?.cwd) command.cwd = context.cwd;
  return command;
}

export const failureTitle = (entry: Entry): string => `command-palette: ${entry.title} failed`;
