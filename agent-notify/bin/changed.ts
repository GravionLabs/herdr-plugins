#!/usr/bin/env node
// herdr event hook on `pane.agent_status_changed`: notifies when an agent pane turns done or blocked, once per pane
// and state within 30 s. Input: HERDR_PLUGIN_EVENT_JSON; config: HERDR_PLUGIN_CONFIG_DIR/config.json.
import { deprecations, parseConfig } from '../lib/config.ts';
import { noticeFor } from '../lib/errors.ts';
import { loadSeen, lookup, notifyError, readConfigFile, saveSeen, show } from '../lib/host.ts';
import { handle } from '../lib/notify.ts';

async function main(): Promise<void> {
  const raw = await readConfigFile();
  for (const line of deprecations(raw)) process.stderr.write(`agent-notify: ${line}\n`);
  const config = parseConfig(raw);
  await handle({ now: Date.now, loadSeen, saveSeen, lookup, show }, config, process.env.HERDR_PLUGIN_EVENT_JSON);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
  const shown = noticeFor('agent-notify', message, 'agent-notify failed');
  await notifyError(shown.title, shown.body);
});
