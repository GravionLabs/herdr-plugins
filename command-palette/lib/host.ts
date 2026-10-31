// herdr side: pane open and notification through HERDR_BIN_PATH.
import { spawn } from 'node:child_process';

export const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

export function run(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

export function openPaletteArgs(plugin: string, contextJson: string | null): string[] {
  const args = ['plugin', 'pane', 'open', '--plugin', plugin, '--entrypoint', 'palette'];
  if (contextJson) args.push('--env', `PALETTE_CONTEXT=${contextJson}`);
  return args;
}

export function notify(title: string): Promise<boolean> {
  return run(herdrBin(), ['notification', 'show', title]);
}
