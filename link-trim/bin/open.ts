#!/usr/bin/env node
// herdr action `open`: opens the clicked URL without trailing punctuation.
// Input: HERDR_PLUGIN_CLICKED_URL (set by herdr for a matching [[link_handlers]] entry).
import { execFile } from 'node:child_process';
import { opener } from '../lib/open.ts';
import { trimTrailingPunctuation } from '../lib/trim.ts';

function run(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, args, (error) => resolve(!error));
  });
}

async function main(): Promise<void> {
  const clicked = process.env.HERDR_PLUGIN_CLICKED_URL ?? '';
  const url = trimTrailingPunctuation(clicked);
  const open = url === '' ? null : opener(process.platform, url);
  const opened = open !== null && (await run(open.command, open.args));
  if (opened) return;

  process.exitCode = 1;
  const herdr = process.env.HERDR_BIN_PATH || 'herdr';
  await run(herdr, ['notification', 'show', 'Could not open link', '--body', url || clicked]);
}

main();
