#!/usr/bin/env node
// herdr action `toggle-log`: shows or hides the log pane of Invoke-DeliverLoop.ps1 for the focused tab, through the
// installed `deliver` skill's Switch-LogPane.ps1. Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { toggleLog } from '../lib/action.ts';
import { cwdFromContext } from '../lib/context.ts';
import { noticeFor } from '../lib/errors.ts';
import { gitToplevel, notify } from '../lib/host.ts';
import { run } from '../lib/run.ts';

async function main(): Promise<void> {
  const cwd = cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || process.cwd();
  const repo = await gitToplevel(cwd);
  const ok = await toggleLog({ run, notify, exists: existsSync, home: homedir() }, repo, cwd);
  if (!ok) process.exitCode = 1;
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
  const shown = noticeFor('deliver-log', message, 'deliver-log failed');
  await notify(shown.title, shown.body);
});
