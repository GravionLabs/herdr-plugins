#!/usr/bin/env node
// Detached runner started by the palette: argv[2] is the entry as JSON, PALETTE_CONTEXT the original pane.
// Failure or timeout of the invoke becomes a notification; nothing is shown on success.
import { parsePaletteContext } from '../lib/context.ts';
import type { Entry } from '../lib/entries.ts';
import { herdrBin, invokeAction, notify } from '../lib/host.ts';
import { failureTitle, invokeCommand } from '../lib/run.ts';

async function main(): Promise<void> {
  let entry: Entry;
  try {
    entry = JSON.parse(process.argv[2] ?? '') as Entry;
  } catch {
    process.exitCode = 1;
    return;
  }
  const command = invokeCommand(entry, parsePaletteContext(process.env.PALETTE_CONTEXT), herdrBin());
  if (command && (await invokeAction(command))) return;
  process.exitCode = 1;
  await notify(failureTitle(entry)).catch(() => false);
}

main().catch(() => {
  process.exitCode = 1;
});
