import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { ApplyIo } from '../scripts/lib/apply.ts';
import { main, realDeps } from '../scripts/herdr-setup.ts';
import { defaultConfigPath, readTable, readValue } from '../scripts/lib/config.ts';
import { runDoctor, versionAtLeast, type Deps } from '../scripts/lib/doctor.ts';

const GOOD_CONFIG = `[ui]
mouse_capture = true # on

[ui.toast]
delivery = "herdr"

[ui.sidebar.agents]
rows = [
  ["agent"],
  [{ token = "$deliver", bold = true }, "$deliver_pr"],
]
`;

const PLUGIN_JSON = JSON.stringify({
  id: 'cli:plugin',
  result: {
    plugins: [
      { name: 'agent-notify', plugin_id: 'agent-notify', enabled: true, source: { kind: 'github', owner: 'GravionLabs', repo: 'herdr-plugins', requested_ref: 'v0.4.0', resolved_commit: 'cb697ffec327' } },
      { name: 'local-one', plugin_id: 'local-one', enabled: false, source: { kind: 'local' } },
    ],
  },
});

const home = join('h', 'me');
const skillDir = join(home, '.claude', 'skills', 'deliver');

function deps(over: Partial<Deps> & { config?: string | null; tools?: Record<string, boolean>; herdrVersion?: string; skill?: boolean; pluginOut?: string } = {}): Deps & ApplyIo {
  const tools = { herdr: true, pwsh: true, gh: true, 'gh auth': true, ...over.tools };
  return {
    run: (command, args) => {
      if (command === 'herdr' && args[0] === '--version') return { ok: tools.herdr, stdout: `herdr ${over.herdrVersion ?? '0.9.5'}\n` };
      if (command === 'herdr') return { ok: tools.herdr, stdout: over.pluginOut ?? PLUGIN_JSON };
      if (command === 'gh' && args[0] === 'auth') return { ok: tools['gh auth'], stdout: '' };
      return { ok: tools[command as 'pwsh' | 'gh'] ?? false, stdout: 'x 1\n' };
    },
    exists: (p) => (over.skill ?? true) && p === skillDir,
    readFile: () => (over.config === undefined ? GOOD_CONFIG : over.config),
    env: {},
    platform: 'linux',
    home,
    nodeVersion: 'v26.1.0',
    cwd: '.',
    writeFile: () => {},
    confirm: () => false,
    now: () => new Date(2026, 0, 2, 3, 4, 5),
    ...over,
  };
}

const failing = (d: Deps): string[] => runDoctor(d).filter((c) => !c.ok).map((c) => c.name);

describe('config reading', () => {
  it('reads table keys, dotted keys and ignores comments', () => {
    expect(readValue(GOOD_CONFIG, 'ui.toast.delivery')).toBe('herdr');
    expect(readValue(GOOD_CONFIG, 'ui.mouse_capture')).toBe('true');
    expect(readValue('[ui]\ntoast.delivery = "off"\n', 'ui.toast.delivery')).toBe('off');
    expect(readValue('', 'ui.toast.delivery')).toBeNull();
  });

  it('returns the multi-line text of a table or null', () => {
    expect(readTable(GOOD_CONFIG, 'ui.sidebar.agents')).toContain('$deliver_pr');
    expect(readTable(GOOD_CONFIG, 'ui.nothing')).toBeNull();
  });

  it('picks the config path from HERDR_CONFIG_PATH or the OS default', () => {
    expect(defaultConfigPath('linux', { HERDR_CONFIG_PATH: 'x.toml' }, home)).toBe('x.toml');
    expect(defaultConfigPath('darwin', {}, home)).toBe(join(home, '.config', 'herdr', 'config.toml'));
    expect(defaultConfigPath('win32', { APPDATA: 'A' }, home)).toBe(join('A', 'herdr', 'config.toml'));
    expect(defaultConfigPath('win32', {}, home)).toBe(join(home, 'AppData', 'Roaming', 'herdr', 'config.toml'));
  });
});

describe('doctor checks', () => {
  it('passes with a good setup', () => {
    expect(failing(deps())).toEqual([]);
  });

  it('compares versions', () => {
    expect(versionAtLeast([0, 10, 0], [0, 9, 5])).toBe(true);
    expect(versionAtLeast([0, 9, 4], [0, 9, 5])).toBe(false);
  });

  it('fails an old, missing or unreadable herdr', () => {
    expect(failing(deps({ herdrVersion: '0.9.4' }))).toContain('herdr');
    expect(failing(deps({ tools: { herdr: false } }))).toContain('herdr');
    expect(failing(deps({ herdrVersion: 'dev' }))).toContain('herdr');
  });

  it('fails Node below 26 with a hint', () => {
    const c = runDoctor(deps({ nodeVersion: 'v24.0.0' })).find((x) => x.name === 'node')!;
    expect(c.ok).toBe(false);
    expect(c.hint).toContain('26');
  });

  it('fails missing pwsh, gh and a gh without login', () => {
    expect(failing(deps({ tools: { pwsh: false } }))).toEqual(['pwsh']);
    expect(failing(deps({ tools: { gh: false } }))).toEqual(['gh', 'gh login']);
    expect(failing(deps({ tools: { 'gh auth': false } }))).toEqual(['gh login']);
  });

  describe('deliver skill lookup', () => {
    const repo = join(home, 'work', 'proj');
    const only = (dir: string, git = true): Deps => ({
      ...deps(),
      cwd: join(repo, 'sub'),
      run: (c, a) => (c === 'git' ? { ok: git, stdout: git ? `${repo}\n` : '' } : deps().run(c, a)),
      exists: (p) => p === dir,
    });
    const skillCheck = (d: Deps) => runDoctor(d).find((c) => c.name === 'deliver skill')!;

    it('finds the skill in the project .claude directory', () => {
      const dir = join(repo, '.claude', 'skills', 'deliver');
      expect(skillCheck(only(dir))).toMatchObject({ ok: true, detail: dir });
    });
    it('finds the skill in the project .agents directory', () => {
      const dir = join(repo, '.agents', 'skills', 'deliver');
      expect(skillCheck(only(dir))).toMatchObject({ ok: true, detail: dir });
    });
    it('finds the skill in home only', () => {
      expect(skillCheck(only(skillDir))).toMatchObject({ ok: true, detail: skillDir });
    });
    it('fails with the lookup order in the hint when neither has it', () => {
      const c = skillCheck(only(join(home, 'elsewhere')));
      expect(c.ok).toBe(false);
      expect(c.hint).toContain('<repo>/.claude/skills/deliver');
    });
    it('ignores the project when git fails outside a repository', () => {
      expect(skillCheck(only(join(repo, '.claude', 'skills', 'deliver'), false)).ok).toBe(false);
      expect(skillCheck(only(skillDir, false))).toMatchObject({ ok: true, detail: skillDir });
    });
  });

  it('fails when the deliver skill is missing', () => {
    expect(failing(deps({ skill: false }))).toEqual(['deliver skill']);
  });

  it('fails toast delivery off, also by default', () => {
    expect(failing(deps({ config: GOOD_CONFIG.replace('"herdr"', '"off"') }))).toEqual(['ui.toast.delivery']);
    expect(failing(deps({ config: GOOD_CONFIG.replace('[ui.toast]\ndelivery = "herdr"', '') }))).toEqual(['ui.toast.delivery']);
  });

  it('fails mouse_capture false, passes when absent', () => {
    expect(failing(deps({ config: GOOD_CONFIG.replace('mouse_capture = true', 'mouse_capture = false') }))).toEqual(['ui.mouse_capture']);
    expect(failing(deps({ config: GOOD_CONFIG.replace('mouse_capture = true', '') }))).toEqual([]);
  });

  it('hints at herdr and apply, never all, for toast delivery and sidebar rows', () => {
    const hints = runDoctor(deps({ config: '' })).filter((c) => !c.ok && c.name !== 'deliver skill').map((c) => c.hint ?? '');
    const toast = hints.find((h) => h.includes('ui.toast')) ?? '';
    expect(toast).toContain('delivery = "herdr"');
    expect(toast).not.toContain('"all"');
    expect(toast).toContain('herdr-setup.ts apply');
    expect(hints.find((h) => h.includes('$deliver'))).toContain('herdr-setup.ts apply');
  });

  it('fails sidebar rows without $deliver or without the table', () => {
    expect(failing(deps({ config: GOOD_CONFIG.replaceAll('$deliver', '$other') }))).toEqual(['sidebar rows']);
    expect(failing(deps({ config: '' }))).toEqual(['ui.toast.delivery', 'sidebar rows']);
    expect(failing(deps({ config: null }))).toEqual(['ui.toast.delivery', 'sidebar rows']);
  });

  it('reports the installed plugins as structured data', () => {
    const c = runDoctor(deps()).find((x) => x.name === 'plugins')!;
    expect(c.ok).toBe(true);
    expect(c.detail).toBe('agent-notify enabled v0.4.0; local-one disabled no ref');
    expect(c.plugins).toEqual([
      { name: 'agent-notify', plugin_id: 'agent-notify', enabled: true, ref: 'v0.4.0', resolved_commit: 'cb697ffec327' },
      { name: 'local-one', plugin_id: 'local-one', enabled: false, ref: null, resolved_commit: null },
    ]);
  });

  it('says none installed for an empty list', () => {
    const c = runDoctor(deps({ pluginOut: '{"result":{"plugins":[]}}' })).find((x) => x.name === 'plugins')!;
    expect(c).toMatchObject({ ok: true, detail: 'none installed', plugins: [] });
  });

  it('fails the plugins check on failure or malformed output, never throws', () => {
    expect(failing(deps({ tools: { herdr: false } }))).toContain('plugins');
    for (const bad of ['agent-notify (agent-notify) enabled', '', 'null', '{"result":{}}', '{"result":{"plugins":"x"}}']) {
      expect(failing(deps({ pluginOut: bad }))).toEqual(['plugins']);
    }
  });

  it('skips malformed plugin entries', () => {
    const c = runDoctor(deps({ pluginOut: '{"result":{"plugins":[null,5,{"enabled":true},{"name":"a"}]}}' })).find((x) => x.name === 'plugins')!;
    expect(c.plugins).toEqual([{ name: 'a', plugin_id: 'a', enabled: false, ref: null, resolved_commit: null }]);
  });

  it('known limitation: inline TOML tables are not read as tables', () => {
    expect(readValue('ui = { mouse_capture = false }\n', 'ui.mouse_capture')).toBeNull();
  });
});

describe('herdr-setup cli', () => {
  const run = (argv: string[], d: Deps & ApplyIo = deps()) => {
    const lines: string[] = [];
    const code = main(argv, d, (t) => lines.push(t));
    return { code, text: lines.join('\n') };
  };

  it('prints help with exit 0, and exit 1 without a command', () => {
    expect(run(['--help'])).toMatchObject({ code: 0 });
    expect(run(['--help']).text).toContain('doctor');
    expect(run([]).code).toBe(1);
  });

  it('rejects an unknown command', () => {
    const r = run(['frobnicate']);
    expect(r.code).toBe(1);
    expect(r.text).toContain("unknown command 'frobnicate'");
  });

  it('prints one line per check and a hint for failures', () => {
    const ok = run(['doctor']);
    expect(ok.code).toBe(0);
    expect(ok.text).not.toContain('hint:');
    const bad = run(['doctor'], deps({ skill: false }));
    expect(bad.code).toBe(1);
    expect(bad.text).toContain('FAIL deliver skill');
    expect(bad.text).toContain('hint: run `npx skills add');
  });

  it('prints the checks as JSON', () => {
    const r = run(['doctor', '--json'], deps({ nodeVersion: 'v20.0.0' }));
    const data = JSON.parse(r.text);
    expect(r.code).toBe(1);
    expect(data.ok).toBe(false);
    expect(data.checks.find((c: { name: string }) => c.name === 'node')).toMatchObject({ ok: false });
  });

  it('runs as a script against a config file from HERDR_CONFIG_PATH', () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-setup-'));
    try {
      const file = join(dir, 'config.toml');
      writeFileSync(file, GOOD_CONFIG);
      const r = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'herdr-setup.ts'), 'doctor', '--json'], {
        encoding: 'utf8',
        // An empty PATH makes every host tool (herdr, gh, pwsh) missing, so the checks fail fast.
        env: { ...process.env, PATH: dir, Path: dir, HERDR_CONFIG_PATH: file },
        timeout: 25000,
      });
      const data = JSON.parse(r.stdout);
      expect(data.checks.find((c: { name: string }) => c.name === 'ui.toast.delivery')).toMatchObject({ ok: true, detail: 'herdr' });
      expect(data.ok).toBe(false);
      expect(r.status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it('real deps read missing files as null', () => {
    expect(realDeps().readFile(join(tmpdir(), 'no-such-herdr-config.toml'))).toBeNull();
    expect(realDeps().run('definitely-not-a-tool-xyz', []).ok).toBe(false);
  });
});
