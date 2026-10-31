#!/usr/bin/env node
// herdr action `start`: opens the `form` popup for the repository of the focused pane.
// Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd), passed on to the pane as DELIVER_STARTER_CWD.
import { cwdFromContext } from '../lib/context.ts';
import { herdrBin, notify } from '../lib/host.ts';
import { run } from '../lib/run.ts';

async function main(): Promise<void> {
  const plugin = process.env.HERDR_PLUGIN_ID || 'deliver-starter';
  const cwd = cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON);
  const args = ['plugin', 'pane', 'open', '--plugin', plugin, '--entrypoint', 'form'];
  if (cwd) args.push('--env', `DELIVER_STARTER_CWD=${cwd}`);
  const result = await run(herdrBin(), args, cwd || process.cwd());
  if (result.ok) return;
  process.exitCode = 1;
  await notify('deliver-starter: could not open the popup');
}

main();
