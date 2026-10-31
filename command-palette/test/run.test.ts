import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
