#!/usr/bin/env node
// herdr action `open`: opens the `review` popup for the branch of the focused pane.
// Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd and id), passed on to the pane as REVIEW_POPUP_CWD / REVIEW_POPUP_PANE.
import { cwdFromContext, paneFromContext } from '../lib/context.ts';
import { herdrBin } from '../lib/host.ts';
import { run } from '../lib/run.ts';

async function main(): Promise<void> {
  const plugin = process.env.HERDR_PLUGIN_ID || 'review-popup';
  const context = process.env.HERDR_PLUGIN_CONTEXT_JSON;
  const cwd = cwdFromContext(context);
  const pane = paneFromContext(context);
  const args = ['plugin', 'pane', 'open', '--plugin', plugin, '--entrypoint', 'review'];
  if (cwd) args.push('--env', `REVIEW_POPUP_CWD=${cwd}`);
  if (pane) args.push('--env', `REVIEW_POPUP_PANE=${pane}`);
  const result = await run(herdrBin(), args, cwd || process.cwd());
  if (result.ok) return;
  process.exitCode = 1;
  await run(herdrBin(), ['notification', 'show', 'review-popup: could not open the popup'], process.cwd());
}

main();
