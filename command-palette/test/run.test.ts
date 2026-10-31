import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/entries.ts';
import { failureTitle, invokeCommand } from '../lib/run.ts';

const entry: Entry = {
  id: 'deliver-board.open',
  group: 'deliver-board',
  title: 'Open the deliver board',
  run: { kind: 'action', plugin: 'deliver-board', action: 'open' },
};

describe('invokeCommand', () => {
  it('invokes the action and targets the original pane via cwd and HERDR_PANE_ID', () => {
    expect(invokeCommand(entry, { paneId: 'p_1', cwd: '/work/repo' }, 'herdr')).toEqual({
      command: 'herdr',
      args: ['plugin', 'action', 'invoke', 'open', '--plugin', 'deliver-board'],
      cwd: '/work/repo',
      env: { HERDR_PANE_ID: 'p_1' },
    });
  });

  it('works without context', () => {
    expect(invokeCommand(entry, null, 'herdr')).toEqual({
      command: 'herdr',
      args: ['plugin', 'action', 'invoke', 'open', '--plugin', 'deliver-board'],
      env: {},
    });
  });

  it('returns null for an entry that cannot be run', () => {
    expect(invokeCommand({ id: 'x', group: 'g', title: 't' }, null, 'herdr')).toBeNull();
  });

  describe('config command', () => {
    const cmd = (cwd?: string): Entry => ({
      id: 'config.0',
      group: 'config',
      title: 'show agent-log',
      run: { kind: 'command', command: ['herdr', 'pane', 'split', '--current'], ...(cwd ? { cwd } : {}) },
    });

    it('spawns the array without a shell in the entry cwd first', () => {
      expect(invokeCommand(cmd('/entry'), { paneId: 'p_1', cwd: '/ctx' }, 'herdr', '/home/u')).toEqual({
        command: 'herdr',
        args: ['pane', 'split', '--current'],
        cwd: '/entry',
        env: {},
      });
    });

    it('falls back to the context cwd, then to home', () => {
      expect(invokeCommand(cmd(), { paneId: 'p_1', cwd: '/ctx' }, 'herdr', '/home/u')?.cwd).toBe('/ctx');
      expect(invokeCommand(cmd(), null, 'herdr', '/home/u')?.cwd).toBe('/home/u');
      expect(invokeCommand(cmd(), { paneId: 'p_1', cwd: '' }, 'herdr', '/home/u')?.cwd).toBe('/home/u');
    });
  });

  it('names the failure notification', () => {
    expect(failureTitle(entry)).toBe('command-palette: Open the deliver board failed');
  });
});

describe('bin/run.ts', () => {
  const runner = new URL('../bin/run.ts', import.meta.url).pathname;
  const fakeHerdr = (script: string): { bin: string; log: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'palette-'));
    const bin = join(dir, 'herdr');
    const log = join(dir, 'log');
    writeFileSync(bin, `#!/bin/sh\necho "$HERDR_PANE_ID $@" >> ${log}\n${script}\n`);
    chmodSync(bin, 0o755);
    return { bin, log };
  };
  const start = (bin: string) =>
    spawnSync(process.execPath, [runner, JSON.stringify(entry)], {
      env: { ...process.env, HERDR_BIN_PATH: bin, PALETTE_CONTEXT: '{"paneId":"p_1","cwd":"/tmp"}' },
    });

  it('shows nothing on success', () => {
    const { bin, log } = fakeHerdr('exit 0');
    expect(start(bin).status).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe('p_1 plugin action invoke open --plugin deliver-board\n');
  });

  it('notifies and exits 1 when the invoke fails', () => {
    const { bin, log } = fakeHerdr('[ "$1" = notification ] && exit 0; exit 3');
    expect(start(bin).status).toBe(1);
    expect(readFileSync(log, 'utf8')).toContain(' notification show command-palette: Open the deliver board failed');
  });

  it('swallows a failing notification and still exits 1', () => {
    const { bin } = fakeHerdr('exit 3');
    expect(start(bin).status).toBe(1);
  });
});

describe('bin/run.ts with a config command', () => {
  const runner = new URL('../bin/run.ts', import.meta.url).pathname;
  const start = (command: string[], bin: string) =>
    spawnSync(
      process.execPath,
      [runner, JSON.stringify({ id: 'config.0', group: 'config', title: 't', run: { kind: 'command', command } })],
      { env: { ...process.env, HERDR_BIN_PATH: bin, PALETTE_CONTEXT: '{"paneId":"p_1","cwd":"/tmp"}' } },
    );
  const notifier = () => {
    const dir = mkdtempSync(join(tmpdir(), 'palette-'));
    const bin = join(dir, 'herdr');
    const log = join(dir, 'log');
    writeFileSync(bin, `#!/bin/sh\necho "$@" >> ${log}\n`);
    chmodSync(bin, 0o755);
    return { bin, log };
  };

  it('runs silently on success', () => {
    const { bin, log } = notifier();
    expect(start(['true'], bin).status).toBe(0);
    expect(existsSync(log)).toBe(false);
  });

  it('notifies on a non-zero exit', () => {
    const { bin, log } = notifier();
    expect(start(['false'], bin).status).toBe(1);
    expect(readFileSync(log, 'utf8')).toBe('notification show command-palette: t failed\n');
  });

  it('notifies on a spawn error', () => {
    const { bin, log } = notifier();
    expect(start(['/nonexistent/binary'], bin).status).toBe(1);
    expect(readFileSync(log, 'utf8')).toContain('notification show');
  });
});
