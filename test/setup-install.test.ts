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
function fake(opts: { tag?: string | null; initial?: Record<string, string>; failing?: string[]; stale?: string[]; dirs?: string[] | null } = {}) {
  const calls: string[][] = [];
  const refs = { ...(opts.initial ?? {}) };
  const deps = {
    run: (command: string, args: string[]) => {
      calls.push([command, ...args]);
      if (command === 'gh' && args[1]?.includes('/contents/')) {
        if (opts.dirs === null) return { ok: false, stdout: '' };
        return { ok: true, stdout: (opts.dirs ?? PLUGINS).join('\n') + '\n' };
      }
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

  it('installs the named plugins at --ref without asking gh for the latest release', () => {
    const f = fake();
    const r = run(f, ['link-trim', '--ref', 'v0.3.0', 'repo-open']);
    expect(r.code).toBe(0);
    expect(f.calls.some((c) => c[0] === 'gh' && c[2]?.includes('releases/latest'))).toBe(false);
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

  describe('plugins that are not in the tag', () => {
    const old = PLUGINS.filter((p) => p !== 'repo-open');

    it('skips them in a default install and exits 0', () => {
      const f = fake({ dirs: old });
      const r = run(f, []);
      expect(r.code).toBe(0);
      expect(f.calls.filter((c) => c[0] === 'gh' && c[2]?.includes('/contents/'))).toEqual([
        ['gh', 'api', 'repos/GravionLabs/herdr-plugins/contents/?ref=v0.4.0', '--jq', '.[] | select(.type == "dir") | .name'],
      ]);
      expect(f.installs()).toHaveLength(old.length);
      expect(f.installs().some((c) => c.includes('GravionLabs/herdr-plugins/repo-open'))).toBe(false);
      expect(r.text).toContain('  repo-open: skipped (not in v0.4.0)');
      expect(r.text).not.toContain('FAIL');
    });

    it('fails when a plugin named on the command line is missing, but installs the others', () => {
      const f = fake({ dirs: old });
      const r = run(f, ['link-trim', 'repo-open', '--ref', 'v0.4.0']);
      expect(r.code).toBe(1);
      expect(r.text).toContain('  repo-open: skipped (not in v0.4.0)');
      expect(r.text).toContain('FAIL repo-open: not in v0.4.0');
      expect(r.text).toContain('1 of 2 failed: repo-open');
      expect(f.installs()).toHaveLength(1);
    });

    it('falls back to installing everything with a warning when the lookup fails', () => {
      for (const dirs of [null, []]) {
        const f = fake({ dirs });
        const r = run(f, []);
        expect(r.code).toBe(0);
        expect(r.text).toContain('warning: could not list the plugins in v0.4.0');
        expect(r.text).not.toContain('skipped');
        expect(f.installs()).toHaveLength(PLUGINS.length);
      }
    });

    it('installs everything without a warning when all are present', () => {
      const r = run(fake(), []);
      expect(r.code).toBe(0);
      expect(r.text).not.toContain('warning');
      expect(r.text).not.toContain('skipped');
    });

    it('shows the same plan on --dry-run and installs nothing', () => {
      const f = fake({ dirs: old });
      const r = run(f, ['--dry-run']);
      expect(r.code).toBe(0);
      expect(r.text).toContain('  repo-open: skipped (not in v0.4.0)');
      expect(r.text).toContain('  link-trim: not installed -> v0.4.0');
      expect(r.text).toContain('dry run: nothing installed');
      expect(f.installs()).toHaveLength(0);
      expect(run(fake({ dirs: old }), ['repo-open', '--dry-run']).code).toBe(1);
    });
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

  describe('flags around the command', () => {
    const go = (argv: string[]) => {
      const f = fake();
      const lines: string[] = [];
      const code = main(argv, f.deps as never, (t) => lines.push(t));
      return { code, text: lines.join('\n'), f };
    };

    it('honours --dry-run before the command and installs nothing', () => {
      const r = go(['--dry-run', 'install']);
      expect(r.code).toBe(0);
      expect(r.text).toContain('Plan: install at v0.4.0');
      expect(r.f.installs()).toHaveLength(0);
    });

    it('takes --ref <tag> before the command', () => {
      const r = go(['--ref', 'v0.5.0', 'install', 'link-trim']);
      expect(r.code).toBe(0);
      expect(r.f.installs()).toEqual([['herdr', 'plugin', 'install', '-y', '--ref', 'v0.5.0', 'GravionLabs/herdr-plugins/link-trim']]);
    });

    it('treats install --dry-run like --dry-run install', () => {
      const r = go(['install', '--dry-run']);
      expect(r.text).toContain('Plan: install at v0.4.0');
      expect(r.f.installs()).toHaveLength(0);
    });

    it('takes a plugin followed by --ref after the command', () => {
      const r = go(['install', 'link-trim', '--ref', 'v1']);
      expect(r.f.installs().map((c) => c.slice(4))).toEqual([['--ref', 'v1', 'GravionLabs/herdr-plugins/link-trim']]);
    });

    it('still rejects an unknown command, also after a --ref value', () => {
      const r = go(['--ref', 'v1', 'frobnicate']);
      expect(r.code).toBe(1);
      expect(r.text).toContain("unknown command 'frobnicate'");
      expect(r.f.installs()).toHaveLength(0);
    });
  });
});
