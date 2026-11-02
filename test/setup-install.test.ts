import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../scripts/herdr-setup.ts';
import { PLUGINS, parseInstallArgs, runInstall } from '../scripts/lib/install.ts';
import type { Deps } from '../scripts/lib/doctor.ts';
import { readdirSync } from 'node:fs';

const root = join(import.meta.dirname, '..');

function listJson(refs: Record<string, string>): string {
  return JSON.stringify({ result: { plugins: Object.entries(refs).map(([name, ref]) => ({ name, plugin_id: name, enabled: true, source: { requested_ref: ref } })) } });
}

// A fake herdr + gh: install sets the ref unless the plugin is in `failing`.
function fake(opts: { tag?: string | null; initial?: Record<string, string>; failing?: string[]; stale?: string[] } = {}) {
  const calls: string[][] = [];
  const refs = { ...(opts.initial ?? {}) };
  const deps = {
    run: (command: string, args: string[]) => {
      calls.push([command, ...args]);
      if (command === 'gh') return opts.tag === null ? { ok: false, stdout: '' } : { ok: true, stdout: `${opts.tag ?? 'v0.4.0'}\n` };
      if (args[1] === 'list') return { ok: true, stdout: listJson(refs) };
      const name = args[args.length - 1]!.split('/').pop()!;
      if (opts.failing?.includes(name)) return { ok: false, stdout: '' };
      if (!opts.stale?.includes(name)) refs[name] = args[args.indexOf('--ref') + 1]!;
      return { ok: true, stdout: '' };
    },
  } as unknown as Deps;
  return { deps, calls, installs: () => calls.filter((c) => c[1] === 'plugin' && c[2] === 'install') };
}

const run = (f: ReturnType<typeof fake>, args: string[]) => {
  const lines: string[] = [];
  const code = runInstall(f.deps, args, (t) => lines.push(t));
  return { code, text: lines.join('\n') };
};

describe('install', () => {
  it('lists exactly the plugin directories of the repo', () => {
    const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'herdr-plugin.toml'))).map((d) => d.name);
    expect([...PLUGINS].sort()).toEqual(dirs.sort());
  });

  it('installs all plugins at the latest release tag', () => {
    const f = fake({ tag: 'v1.2.3' });
    const r = run(f, []);
    expect(r.code).toBe(0);
    expect(f.calls[0]).toEqual(['gh', 'api', 'repos/GravionLabs/herdr-plugins/releases/latest', '--jq', '.tag_name']);
    expect(f.installs()).toHaveLength(PLUGINS.length);
    expect(f.installs()[0]).toEqual(['herdr', 'plugin', 'install', '-y', '--ref', 'v1.2.3', 'GravionLabs/herdr-plugins/agent-notify']);
    expect(r.text).toContain('agent-notify@v1.2.3');
  });

  it('installs the named plugins at --ref without asking gh', () => {
    const f = fake();
    const r = run(f, ['link-trim', '--ref', 'v0.3.0', 'repo-open']);
    expect(r.code).toBe(0);
    expect(f.calls.some((c) => c[0] === 'gh')).toBe(false);
    expect(f.installs().map((c) => c.slice(4))).toEqual([
      ['--ref', 'v0.3.0', 'GravionLabs/herdr-plugins/link-trim'],
      ['--ref', 'v0.3.0', 'GravionLabs/herdr-plugins/repo-open'],
    ]);
  });

  it('prints the plan with the current ref and installs nothing on --dry-run', () => {
    const f = fake({ initial: { 'link-trim': 'v0.3.0' } });
    const r = run(f, ['link-trim', 'repo-open', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.text).toContain('link-trim: v0.3.0 -> v0.4.0');
    expect(r.text).toContain('repo-open: not installed -> v0.4.0');
    expect(f.installs()).toHaveLength(0);
  });

  it('continues after a failing plugin and exits 1', () => {
    const f = fake({ failing: ['link-trim'] });
    const r = run(f, ['link-trim', 'repo-open']);
    expect(r.code).toBe(1);
    expect(f.installs()).toHaveLength(2);
    expect(r.text).toContain('FAIL link-trim');
    expect(r.text).toContain('ok   repo-open');
    expect(r.text).toContain('1 of 2 failed: link-trim');
  });

  it('fails when the list afterwards does not show the tag', () => {
    const r = run(fake({ stale: ['repo-open'] }), ['repo-open']);
    expect(r.code).toBe(1);
    expect(r.text).toContain('FAIL repo-open: shows no ref, expected v0.4.0');
  });

  it('fails clearly when no release is found', () => {
    const f = fake({ tag: null });
    const r = run(f, []);
    expect(r.code).toBe(1);
    expect(r.text).toContain('no release found');
    expect(f.installs()).toHaveLength(0);
  });

  it('rejects bad arguments', () => {
    expect(parseInstallArgs(['nope'])).toContain("unknown plugin 'nope'");
    expect(parseInstallArgs(['--ref'])).toContain('--ref needs a tag');
    expect(parseInstallArgs(['--ref', '--dry-run'])).toContain('--ref needs a tag');
    expect(parseInstallArgs(['--ref='])).toContain('--ref needs a tag');
    expect(parseInstallArgs(['--bogus'])).toContain("unknown option '--bogus'");
    expect(parseInstallArgs(['--ref=v1', 'link-trim'])).toEqual({ plugins: ['link-trim'], ref: 'v1', dryRun: false });
    expect(run(fake(), ['nope']).code).toBe(1);
  });

  it('is reachable through main', () => {
    const f = fake();
    const lines: string[] = [];
    expect(main(['install', '--dry-run', 'link-trim'], f.deps as never, (t) => lines.push(t))).toBe(0);
    expect(lines.join('\n')).toContain('Plan: install at v0.4.0');
  });
});
