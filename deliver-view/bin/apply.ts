#!/usr/bin/env node
// herdr action `apply`: sets the deliver agent view by hand and saves it for the startup hook.
import { spawn } from 'node:child_process';
import { applyView } from '../lib/view.ts';

try {
  await applyView(process.env, 'apply');
} catch (error) {
  process.exitCode = 1;
  const message = error instanceof Error ? error.message : String(error);
  const herdr = process.env.HERDR_BIN_PATH || 'herdr';
  spawn(herdr, ['notification', 'show', 'deliver-view failed', '--body', message], { stdio: 'ignore' }).on('error', () => {});
}
