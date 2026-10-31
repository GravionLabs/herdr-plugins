#!/usr/bin/env node
// Detached runner started by the palette: argv[2] is the entry as JSON, PALETTE_CONTEXT the original pane.
// Failure or timeout of the invoke becomes a notification; nothing is shown on success.
import { parsePaletteContext } from '../lib/context.ts';
import type { Entry } from '../lib/entries.ts';
import { herdrPlatform, parseActions } from '../lib/actions.ts';
import { herdrBin, invokeAction, listActions, loadConfig, notify } from '../lib/host.ts';
import { entryKey, prune, readState, record, writeState } from '../lib/recent.ts';
import { failureTitle, invokeCommand } from '../lib/run.ts';

// After a successful run: count the entry and drop keys of entries that no longer exist. A failing write is ignored.
async function recordRun(entry: Entry): Promise<void> {
  try {
    const dir = process.env.HERDR_PLUGIN_STATE_DIR;
    const key = entryKey(entry);
    if (!dir || key === null) return;
    let state = record(readState(dir), key, Date.now());
    const listed = await listActions();
    if (listed !== null) {
      const known = [...parseActions(listed, herdrPlatform()), ...loadConfig().entries].map(entryKey);
      state = prune(state, [...known.filter((k): k is string => k !== null), key]);
    }
    writeState(dir, state);
  } catch {
    // the history is best effort
  }
}

async function main(): Promise<void> {
  let entry: Entry;
  try {
    entry = JSON.parse(process.argv[2] ?? '') as Entry;
  } catch {
    process.exitCode = 1;
    return;
  }
  const command = invokeCommand(entry, parsePaletteContext(process.env.PALETTE_CONTEXT), herdrBin());
  if (command && (await invokeAction(command))) {
    await recordRun(entry);
    return;
  }
  process.exitCode = 1;
  await notify(failureTitle(entry)).catch(() => false);
}

// Exit explicitly: the spawn timeout timer of a failed spawn would keep the process alive for 10 s.
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => process.exit());
