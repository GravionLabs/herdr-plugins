#!/usr/bin/env node
// herdr action `open`: opens the `palette` popup. Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane),
// passed on to the popup as PALETTE_CONTEXT. Without context the popup still opens.
import { contextFromJson } from '../lib/context.ts';
import { notice, noticeFor } from '../lib/errors.ts';
import { herdrBin, notify, openPaletteArgs, runChecked } from '../lib/host.ts';

async function main(): Promise<void> {
  const plugin = process.env.HERDR_PLUGIN_ID || 'command-palette';
  const context = contextFromJson(process.env.HERDR_PLUGIN_CONTEXT_JSON);
  const outcome = await runChecked(herdrBin(), openPaletteArgs(plugin, context ? JSON.stringify(context) : null));
  if (outcome.ok) return;

  process.exitCode = 1;
  const shown = outcome.error ? notice('command-palette', outcome.error) : { title: 'Could not open the command palette', body: '' };
  await notify(shown.title, shown.body);
}

main().catch(async (error: unknown) => {
  const shown = noticeFor('command-palette', error instanceof Error ? error.message : String(error), 'command-palette failed');
  process.exitCode = 1;
  await notify(shown.title, shown.body);
});
