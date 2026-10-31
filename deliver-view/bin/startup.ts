#!/usr/bin/env node
// herdr [[startup]] hook: reapplies the saved deliver agent view from HERDR_PLUGIN_STATE_DIR.
import { spawn } from 'node:child_process';
import { applyView } from '../lib/view.ts';

try {
  await applyView(process.env, 'startup');
} catch (error) {
  process.exitCode = 1;
  const message = error instanceof Error ? error.message : String(error);
  const herdr = process.env.HERDR_BIN_PATH || 'herdr';
  spawn(herdr, ['notification', 'show', 'deliver-view failed', '--body', message], { stdio: 'ignore' }).on('error', () => {});
}
