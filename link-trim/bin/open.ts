#!/usr/bin/env node
// herdr action `open`: opens the clicked URL without trailing punctuation.
// Input: HERDR_PLUGIN_CLICKED_URL (set by herdr for a matching [[link_handlers]] entry).
import { spawn } from 'node:child_process';
import { trimTrailingPunctuation } from '../lib/trim.ts';

function opener(platform: NodeJS.Platform): string | null {
  if (platform === 'darwin') return 'open';
  if (platform === 'linux') return 'xdg-open';
  return null;
}

function run(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function main(): Promise<void> {
  const clicked = process.env.HERDR_PLUGIN_CLICKED_URL ?? '';
  const url = trimTrailingPunctuation(clicked);
  const command = opener(process.platform);
  const opened = url !== '' && command !== null && (await run(command, [url]));
  if (opened) return;

  process.exitCode = 1;
  const herdr = process.env.HERDR_BIN_PATH || 'herdr';
  await run(herdr, ['notification', 'show', 'Could not open link', '--body', url || clicked]);
}

main();
