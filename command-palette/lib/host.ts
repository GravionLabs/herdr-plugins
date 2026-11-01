// herdr side: pane open and notification through HERDR_BIN_PATH.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyFailure, type Classified } from './errors.ts';
import { parseConfig, type ParsedConfig } from './config.ts';

// HERDR_PLUGIN_CONFIG_DIR/config.json; a missing file or variable gives no entries and no problem.
export function loadConfig(): ParsedConfig {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  if (!dir) return parseConfig(null);
  let text: string;
  try {
    text = readFileSync(join(dir, 'config.json'), 'utf8');
  } catch {
    return parseConfig(null);
  }
  return parseConfig(text);
}

export const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

// Outcome of a command: `error` is set when the failure is a known error class (missing tool, not logged in, ...).
export type Outcome = { ok: boolean; error: Classified | null };

const failure = (command: string, code: string | number | null, stderr = ''): Outcome => ({
  ok: false,
  error: classifyFailure(command, code, stderr),
});

export function runChecked(command: string, args: string[]): Promise<Outcome> {
  return new Promise((resolve) => {
    let err = '';
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', (d: Buffer) => (err += d));
    child.on('error', (e: NodeJS.ErrnoException) => resolve(failure(command, e.code ?? null)));
    child.on('close', (code) => resolve(code === 0 ? { ok: true, error: null } : failure(command, code, err)));
  });
}

export const run = async (command: string, args: string[]): Promise<boolean> => (await runChecked(command, args)).ok;

export function openPaletteArgs(plugin: string, contextJson: string | null): string[] {
  const args = ['plugin', 'pane', 'open', '--plugin', plugin, '--entrypoint', 'palette'];
  if (contextJson) args.push('--env', `PALETTE_CONTEXT=${contextJson}`);
  return args;
}

export function notify(title: string, body?: string): Promise<boolean> {
  return run(herdrBin(), ['notification', 'show', title, ...(body ? ['--body', body] : [])]);
}

const TIMEOUT_MS = 10_000;

// Raw JSON of `herdr plugin action list`; null on failure, non-zero exit or timeout (10 s).
export function listActions(): Promise<string | null> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(herdrBin(), ['plugin', 'action', 'list'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: TIMEOUT_MS });
    child.stdout.on('data', (d: Buffer) => (out += d));
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out : null));
  });
}

// Runs an invoke command; not ok on failure or timeout (10 s).
export function invokeAction(c: { command: string; args: string[]; cwd?: string; env: Record<string, string> }): Promise<Outcome> {
  return new Promise((resolve) => {
    let err = '';
    const child = spawn(c.command, c.args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      cwd: c.cwd,
      env: { ...process.env, ...c.env },
      timeout: TIMEOUT_MS,
    });
    child.stderr.on('data', (d: Buffer) => (err += d));
    child.on('error', (e: NodeJS.ErrnoException) => resolve(failure(c.command, e.code ?? null)));
    child.on('close', (code) => resolve(code === 0 ? { ok: true, error: null } : failure(c.command, code, err)));
  });
}

// Starts the detached runner for an entry; false when the spawn fails.
export function spawnRunner(runnerPath: string, entryJson: string, contextJson: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (contextJson) env.PALETTE_CONTEXT = contextJson;
    const child = spawn(process.execPath, [runnerPath, entryJson], { detached: true, stdio: 'ignore', env });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
