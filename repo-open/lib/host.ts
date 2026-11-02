// Side effects: config file, herdr calls through HERDR_BIN_PATH, the detached runner.
import { execFile, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseConfig, type ParsedConfig } from './config.ts';

export const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

// HERDR_PLUGIN_CONFIG_DIR/config.json; a missing file or variable gives the defaults and no problem.
export function loadConfig(): ParsedConfig {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  let text: string | null = null;
  if (dir) {
    try {
      text = readFileSync(join(dir, 'config.json'), 'utf8');
    } catch {
      text = null;
    }
  }
  return parseConfig(text, homedir());
}

export type Result = { ok: true; stdout: string } | { ok: false; reason: string };

export type Run = (command: string, args: string[]) => Promise<Result>;

const TIMEOUT_MS = 10_000;

// Runs a command without a shell; never throws. `reason`: the first stderr line, else the exit code.
export const run: Run = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve({ ok: true, stdout });
      const line = String(stderr ?? '').split('\n').find((l) => l.trim() !== '');
      const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
      resolve({ ok: false, reason: line?.trim() ?? `exit code ${code}` });
    });
  });

export const openPickerArgs = (plugin: string): string[] => ['plugin', 'pane', 'open', '--plugin', plugin, '--entrypoint', 'picker'];

export async function notify(title: string, body?: string): Promise<boolean> {
  return (await run(herdrBin(), ['notification', 'show', title, ...(body ? ['--body', body] : [])])).ok;
}

// Starts the detached runner for a repository; false when the spawn fails.
export function spawnRunner(runnerPath: string, repoJson: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [runnerPath, repoJson], { detached: true, stdio: 'ignore' });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
