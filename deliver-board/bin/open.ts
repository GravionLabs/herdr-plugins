#!/usr/bin/env node
// herdr action `open`: opens the `board` popup for the repository of the focused pane.
// Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd), passed on to the pane as DELIVER_BOARD_CWD.
import { spawn } from 'node:child_process';
import { cwdFromContext } from '../lib/context.ts';

function run(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function main(): Promise<void> {
  const herdr = process.env.HERDR_BIN_PATH || 'herdr';
  const plugin = process.env.HERDR_PLUGIN_ID || 'deliver-board';
  const cwd = cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON);
  const args = ['plugin', 'pane', 'open', '--plugin', plugin, '--entrypoint', 'board'];
  if (cwd) args.push('--env', `DELIVER_BOARD_CWD=${cwd}`);
  if (await run(herdr, args)) return;

  process.exitCode = 1;
  await run(herdr, ['notification', 'show', 'Could not open the deliver board']);
}

main();
