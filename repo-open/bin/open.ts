#!/usr/bin/env node
// herdr action `open`: opens the `picker` popup. A failure shows a notification and exits with code 1.
import { herdrBin, notify, openPickerArgs, run } from '../lib/host.ts';

async function main(): Promise<void> {
  const plugin = process.env.HERDR_PLUGIN_ID || 'repo-open';
  const result = await run(herdrBin(), openPickerArgs(plugin));
  if (result.ok) return;
  process.exitCode = 1;
  await notify('Could not open the repository picker', result.reason);
}

main().catch(async (error: unknown) => {
  process.exitCode = 1;
  await notify('repo-open failed', error instanceof Error ? error.message : String(error));
});
