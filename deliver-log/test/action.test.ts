import { describe, expect, it } from 'vitest';
import { toggleLog, type Deps } from '../lib/action.ts';
import type { Result } from '../lib/run.ts';
import { toggleCommand } from '../lib/toggle.ts';

const script = (dir: string) => `${dir}/scripts/Switch-LogPane.ps1`;

function setup(present: string[], result: Result = { ok: true, stdout: '', stderr: '' }) {
  const calls: { command: string; args: string[]; cwd: string }[] = [];
  const notes: { title: string; body?: string }[] = [];
  const deps: Deps = {
    run: async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      return result;
    },
    notify: async (title, body) => {
      notes.push({ title, body });
    },
    exists: (p) => present.includes(p),
    home: '/home/u',
  };
  return { deps, calls, notes };
}

describe('toggle command', () => {
  it('runs pwsh -NoProfile -File on the script of the skill', () => {
    expect(toggleCommand('/s/deliver')).toEqual({
      command: 'pwsh',
      args: ['-NoProfile', '-File', '/s/deliver/scripts/Switch-LogPane.ps1'],
    });
  });
});

describe('toggleLog', () => {
  it('runs the script of the first installed skill in the repository', async () => {
    const dir = '/repo/.agents/skills/deliver';
    const home = '/home/u/.claude/skills/deliver';
    const { deps, calls, notes } = setup([dir, script(dir), home, script(home)]);
    expect(await toggleLog(deps, '/repo', '/repo/sub')).toBe(true);
    expect(calls).toEqual([{ command: 'pwsh', args: ['-NoProfile', '-File', script(dir)], cwd: '/repo' }]);
    expect(notes).toEqual([]);
  });

  it('uses the home skill outside a repository and runs in the cwd', async () => {
    const dir = '/home/u/.agents/skills/deliver';
    const { deps, calls } = setup([dir, script(dir)]);
    await toggleLog(deps, null, '/tmp/x');
    expect(calls).toEqual([{ command: 'pwsh', args: ['-NoProfile', '-File', script(dir)], cwd: '/tmp/x' }]);
  });

  it('notifies how to install the skill when it is not found', async () => {
    const { deps, calls, notes } = setup([]);
    expect(await toggleLog(deps, '/repo', '/repo')).toBe(false);
    expect(calls).toEqual([]);
    expect(notes).toEqual([
      {
        title: 'deliver-log: deliver skill not installed',
        body: 'Install it: npx skills add GravionLabs/skills --skill deliver',
      },
    ]);
  });

  it('notifies the install hint when the skill lacks the script', async () => {
    const { deps, calls, notes } = setup(['/repo/.claude/skills/deliver']);
    expect(await toggleLog(deps, '/repo', '/repo')).toBe(false);
    expect(calls).toEqual([]);
    expect(notes[0]?.title).toBe('deliver-log: deliver skill not installed');
  });

  it('notifies the first stderr line when the script fails', async () => {
    const dir = '/repo/.claude/skills/deliver';
    const failed: Result = { ok: false, code: 1, stdout: '', stderr: '\nno log pane\nmore' };
    const { deps, notes } = setup([dir, script(dir)], failed);
    expect(await toggleLog(deps, '/repo', '/repo')).toBe(false);
    expect(notes).toEqual([{ title: 'deliver-log: toggle failed', body: 'no log pane' }]);
  });

  it('notifies the reason when the script succeeds without a pane and writes to stderr', async () => {
    const dir = '/repo/.claude/skills/deliver';
    const silent: Result = { ok: true, stdout: '', stderr: 'deliver log: no .agents/deliver-loop.log under /repo\n' };
    const { deps, notes } = setup([dir, script(dir)], silent);
    expect(await toggleLog(deps, '/repo', '/repo')).toBe(true);
    expect(notes).toEqual([
      {
        title: 'deliver-log: no log to show',
        body: 'deliver log: no .agents/deliver-loop.log under /repo',
      },
    ]);
  });
});
