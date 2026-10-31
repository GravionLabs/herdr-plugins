#!/usr/bin/env node
// herdr event hook on `pane.agent_status_changed`: notifies when an agent pane turns done or blocked, once per pane
// and state within 30 s. Input: HERDR_PLUGIN_EVENT_JSON; config: HERDR_PLUGIN_CONFIG_DIR/config.json.
import { parseConfig } from '../lib/config.ts';
import { loadSeen, lookup, readConfigFile, saveSeen, show } from '../lib/host.ts';
import { handle } from '../lib/notify.ts';

async function main(): Promise<void> {
  const config = parseConfig(await readConfigFile());
  await handle({ now: Date.now, loadSeen, saveSeen, lookup, show }, config, process.env.HERDR_PLUGIN_EVENT_JSON);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
