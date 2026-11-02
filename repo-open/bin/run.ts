#!/usr/bin/env node
// Detached runner started by the picker after the popup closed: argv[2] is the repository as JSON.
// Opens it (lib/open.ts), records it in recent.json on success, notifies on failure.
import { loadConfig, herdrBin, notify, run } from '../lib/host.ts';
import type { Repo } from '../lib/discover.ts';
import { openRepo } from '../lib/open.ts';
import { readState, record, writeState } from '../lib/recent.ts';

function parseRepo(json: string | undefined): Repo | null {
  try {
    const value: unknown = JSON.parse(json ?? '');
    if (typeof value !== 'object' || value === null) return null;
    const { name, path, rel } = value as Record<string, unknown>;
    if (typeof name !== 'string' || typeof path !== 'string' || typeof rel !== 'string' || !name || !path) return null;
    return { name, path, rel };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const repo = parseRepo(process.argv[2]);
  if (!repo) {
    process.exitCode = 1;
    return;
  }
  try {
    await openRepo(run, herdrBin(), repo, loadConfig().config.tabs);
  } catch (error) {
    process.exitCode = 1;
    await notify(`repo-open: ${repo.name} failed`, error instanceof Error ? error.message : String(error)).catch(() => false);
    return;
  }
  const dir = process.env.HERDR_PLUGIN_STATE_DIR;
  writeState(dir, record(readState(dir), repo.path, Date.now()));
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => process.exit());
