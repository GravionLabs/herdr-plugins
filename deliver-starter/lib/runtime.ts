// Process side shared by the entry points: real dependencies and the config file.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { configIssues, parseConfig, type Config } from './config.ts';
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

// Schema problems of config.json as one line naming file and key (`+N more` for further ones); null when valid or missing.
export function configNotice(): string | null {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  if (!dir) return null;
  let text: string;
  try {
    text = readFileSync(join(dir, 'config.json'), 'utf8');
  } catch {
    return null;
  }
  const issues = configIssues(text);
  if (issues.length === 0) return null;
  return `${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}; using defaults for invalid keys`;
}
