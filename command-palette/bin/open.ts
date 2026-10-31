#!/usr/bin/env node
// herdr action `open`: opens the `palette` popup. Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane),
// passed on to the popup as PALETTE_CONTEXT. Without context the popup still opens.
import { contextFromJson } from '../lib/context.ts';
import { herdrBin, notify, openPaletteArgs, run } from '../lib/host.ts';

async function main(): Promise<void> {
  const plugin = process.env.HERDR_PLUGIN_ID || 'command-palette';
  const context = contextFromJson(process.env.HERDR_PLUGIN_CONTEXT_JSON);
  if (await run(herdrBin(), openPaletteArgs(plugin, context ? JSON.stringify(context) : null))) return;

  process.exitCode = 1;
  await notify('Could not open the command palette');
}

main();
