#!/usr/bin/env node
// herdr action `open`: opens the `review` popup for the branch of the focused pane.
// Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd and id), passed on to the pane as REVIEW_POPUP_CWD / REVIEW_POPUP_PANE.
import { cwdFromContext, paneFromContext } from '../lib/context.ts';
import { noticeFor } from '../lib/errors.ts';
import { herdrBin, notify } from '../lib/host.ts';
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
  const shown = noticeFor('review-popup', result.stderr, 'review-popup: could not open the popup');
  await notify(shown.title, shown.body);
}

main().catch(async (error: unknown) => {
  const shown = noticeFor('review-popup', error instanceof Error ? error.message : String(error), 'review-popup failed');
  process.exitCode = 1;
  await notify(shown.title, shown.body);
});
