#!/usr/bin/env node
// herdr action `data`: prints the board as one versioned JSON document (see README, "The data action").
// Input: `--cwd <repository>`. Reads only; writes only the gh cache under HERDR_PLUGIN_STATE_DIR.
import { execFile } from 'node:child_process';
import { buildData, parseArgs } from '../lib/data.ts';
import { DEFAULT_TTL_MS, type RunFn } from '../lib/ghcache.ts';

const run: RunFn = (command, args, cwd) =>
  new Promise((resolve) => {
    execFile(command, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve({ ok: true, stdout });
      const code = (error as NodeJS.ErrnoException).code ?? null;
      resolve({ ok: false, code: typeof code === 'string' || typeof code === 'number' ? code : null, stdout: String(stdout ?? ''), stderr });
    });
  });

const envelope = await buildData(run, parseArgs(process.argv.slice(2)).cwd, { dir: process.env.HERDR_PLUGIN_STATE_DIR || undefined, ttlMs: DEFAULT_TTL_MS });
process.stdout.write(`${JSON.stringify(envelope)}\n`, () => process.exit('error' in envelope ? 1 : 0));
