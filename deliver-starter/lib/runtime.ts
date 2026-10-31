// Process side shared by the entry points: real dependencies and the config file.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseConfig, type Config } from './config.ts';
import { herdrBin } from './host.ts';
import { run } from './run.ts';
import type { Deps } from './start.ts';

export const realDeps = (): Deps => ({ run, herdr: herdrBin(), exists: existsSync, home: homedir() });

// HERDR_PLUGIN_CONFIG_DIR/config.json; defaults when the file or the variable is missing.
export function loadConfig(): Config {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  if (!dir) return parseConfig(null);
  try {
    return parseConfig(readFileSync(join(dir, 'config.json'), 'utf8'));
  } catch {
    return parseConfig(null);
  }
}
