import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { backupName, planApply, unifiedDiff, type ApplyIo } from '../scripts/lib/apply.ts';
import type { Deps } from '../scripts/lib/doctor.ts';
import { main } from '../scripts/herdr-setup.ts';

const CONFIG = join('h', 'herdr', 'config.toml');

// All blocks the apply adds to an empty config.
const EMPTY_RESULT = `[ui.toast]
delivery = "herdr"

[ui.sidebar.agents]
rows = [
  ["state_icon", { token = "workspace", bold = true }, { token = "state_text", rules = [{ equals = "done", fg = "#5f5" }, { equals = "blocked", fg = "#f55" }] }],
  [{ token = "agent", dim = true }, "terminal_title_stripped"],
  [{ token = "$deliver", bold = true }, { token = "$deliver_step", rules = [{ contains = "blocked", fg = "#f55" }, { contains = "merged", fg = "#5f5" }] }, "$deliver_pr"],
]

[[keys.command]]
key = "prefix+d"
type = "plugin_action"
command = "deliver-starter.start"
description = "start /deliver"

[[keys.command]]
key = "prefix+shift+o"
type = "plugin_action"
command = "deliver-log.toggle"
description = "toggle the deliver log pane"

[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "command-palette.open"
description = "command palette"
`;

function world(initial: string | null, opts: { reloadOk?: boolean; confirm?: boolean; writeFails?: boolean; unreadable?: boolean } = {}) {
  const files = new Map<string, string>();
  if (initial !== null) files.set(CONFIG, initial);
  const runs: string[][] = [];
  const asked: string[] = [];
  const deps: Deps & ApplyIo = {
    run: (command, args) => {
      runs.push([command, ...args]);
      return { ok: opts.reloadOk ?? true, stdout: '{"diagnostics":[]}\n' };
    },
    exists: (p) => files.has(p),
    readFile: (p) => (opts.unreadable ? null : (files.get(p) ?? null)),
    env: { HERDR_CONFIG_PATH: CONFIG },
    platform: 'linux',
    home: 'h',
    nodeVersion: 'v26.1.0',
    cwd: '.',
    writeFile: (p, c) => {
      if (opts.writeFails) throw new Error('disk full');
      files.set(p, c);
    },
    confirm: (q) => {
      asked.push(q);
      return opts.confirm ?? true;
    },
    now: () => new Date(2026, 0, 2, 3, 4, 5),
  };
  const apply = (...flags: string[]) => {
    const lines: string[] = [];
    const code = main(['apply', ...flags], deps, (t) => lines.push(t));
    return { code, text: lines.join('\n') };
  };
  return { files, runs, asked, apply };
}

const backups = (files: Map<string, string>): string[] => [...files.keys()].filter((k) => k.includes('.bak-'));

describe('planApply', () => {
  it('builds every block for an empty config', () => {
    const plan = planApply('');
    expect(plan.after).toBe(EMPTY_RESULT);
    expect(plan.changes).toHaveLength(5);
    expect(plan.hints).toEqual([]);
  });

  it('is idempotent: the result needs nothing more', () => {
    const again = planApply(EMPTY_RESULT);
    expect(again.changes).toEqual([]);
    expect(again.after).toBe(EMPTY_RESULT);
  });

  it('adds only what is missing in a partial config and keeps the rest verbatim', () => {
    const partial = `[ui]\nmouse_capture = true\n\n[ui.toast]\ndelivery = "all"\n\n[[keys.command]]\nkey = "prefix+d"\ncommand = "deliver-starter.start"\n`;
    const plan = planApply(partial);
    expect(plan.after.startsWith(partial)).toBe(true);
    expect(plan.changes).toEqual(['add [ui.sidebar.agents] with the "space first" rows', 'bind prefix+shift+o to deliver-log.toggle', 'bind prefix+a to command-palette.open']);
  });

  it('turns delivery off into herdr in place and keeps the comment', () => {
    const plan = planApply(`[ui.toast]\ndelivery = "off" # quiet\nother = 1\n`);
    expect(plan.after.startsWith(`[ui.toast]\ndelivery = "herdr" # quiet\nother = 1\n`)).toBe(true);
    expect(plan.changes[0]).toBe('set ui.toast.delivery to "herdr" (was "off")');
  });

  it('handles a dotted delivery key under [ui]', () => {
    expect(planApply('[ui]\ntoast.delivery = "off"\n').after.startsWith('[ui]\ntoast.delivery = "herdr"\n')).toBe(true);
  });

  it('adds a missing delivery key into an existing [ui.toast] table', () => {
    expect(planApply('[ui.toast]\nsound = true\n').after.startsWith('[ui.toast]\ndelivery = "herdr"\nsound = true\n')).toBe(true);
  });

  it('hints instead of adding a second toast definition', () => {
    const plan = planApply('[ui]\ntoast = { sound = true }\n');
    expect(plan.hints[0]).toContain('ui.toast');
    expect(plan.after).not.toContain('[ui.toast]');
  });

  it('never touches a delivery value the user set', () => {
    for (const v of ['"all"', '"herdr"', '"none"']) {
      expect(planApply(`[ui.toast]\ndelivery = ${v}\n`).after).toContain(`delivery = ${v}`);
      expect(planApply(`[ui.toast]\ndelivery = ${v}\n`).changes.join()).not.toContain('delivery');
    }
  });

  it('keeps existing sidebar rows and hints when they name no $deliver token', () => {
    const own = `[ui.sidebar.agents]\nrows = [\n  ["agent"],\n  ["workspace"]\n]\n`;
    const plan = planApply(own);
    expect(plan.after.startsWith(own)).toBe(true);
    expect(plan.after).not.toContain('state_icon');
    expect(plan.hints[0]).toContain('$deliver');
  });

  it('does not hint when the existing rows name $deliver', () => {
    expect(planApply(`[ui.sidebar.agents]\nrows = [\n  ["$deliver"]\n]\n`).hints).toEqual([]);
  });

  it('adds the rows into an existing sidebar table without rows', () => {
    const plan = planApply('[ui.sidebar.agents]\nrow_gap = 1\n');
    expect(plan.after.startsWith('[ui.sidebar.agents]\nrows = [\n  ["state_icon"')).toBe(true);
    expect(plan.after).toContain('\nrow_gap = 1\n');
    expect(plan.after.match(/\[ui\.sidebar\.agents\]/g)).toHaveLength(1);
  });

  it('hints when the sidebar agents are defined in a form it does not edit', () => {
    const plan = planApply('[ui.sidebar]\nagents = { row_gap = 1 }\n');
    expect(plan.hints.join()).toContain('ui.sidebar.agents');
    expect(plan.after).not.toContain('state_icon');
  });

  it('skips actions that already have a key, also the toggle-log alias, with any key', () => {
    const bound = (action: string, key: string) => `[[keys.command]]\nkey = "${key}"\ntype = "plugin_action"\ncommand = "${action}"\n\n`;
    const text = bound('deliver-starter.start', 'prefix+f1') + bound('deliver-log.toggle-log', 'prefix+f2') + bound('command-palette.open', 'prefix+f3');
    expect(planApply(text).changes.filter((c) => c.startsWith('bind'))).toEqual([]);
  });

  it('chooses the next free candidate when a key collides', () => {
    const text = `[[keys.command]]\nkey = "prefix+d"\ncommand = "other.thing"\n\n[[keys.command]]\nkey = "PREFIX+shift+o"\ncommand = "other.two"\n`;
    expect(planApply(text).changes.filter((c) => c.startsWith('bind'))).toEqual(['bind prefix+shift+s to deliver-starter.start', 'bind prefix+shift+u to deliver-log.toggle', 'bind prefix+a to command-palette.open']);
  });

  it('avoids keys bound in [keys] and the herdr defaults', () => {
    const plan = planApply('[keys]\nnew_tab = "prefix+a"\n');
    expect(plan.changes).toContain('bind prefix+shift+m to command-palette.open');
    expect(plan.after).not.toMatch(/key = "prefix\+(b|c|s)"/);
  });

  it('skips an entry with a hint when every candidate is taken', () => {
    const keys = ['prefix+d', 'prefix+shift+s', 'prefix+i'].map((k) => `[[keys.command]]\nkey = "${k}"\ncommand = "x.${k}"\n`).join('\n');
    const plan = planApply(keys);
    expect(plan.hints.join()).toContain('no free key for deliver-starter.start');
    expect(plan.after).not.toContain('command = "deliver-starter.start"');
  });

  it('does not take a key twice within one run', () => {
    const keys = planApply('').after.match(/^key = .*$/gm)!;
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('preserves CRLF line endings in the whole file', () => {
    const crlf = '[ui]\r\nmouse_capture = true\r\n';
    const plan = planApply(crlf);
    expect(plan.after.startsWith(crlf)).toBe(true);
    expect(plan.after.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(plan.after.endsWith('\r\n')).toBe(true);
    expect(planApply(plan.after).changes).toEqual([]);
  });

  it('adds a missing final newline before appending', () => {
    expect(planApply('[ui]\nmouse_capture = true').after.startsWith('[ui]\nmouse_capture = true\n\n[ui.toast]')).toBe(true);
  });

  it('ignores commented-out settings', () => {
    const plan = planApply('# [ui.toast]\n# delivery = "herdr"\n');
    expect(plan.after).toContain('\n[ui.toast]\ndelivery = "herdr"\n');
  });
});

describe('diff and backup name', () => {
  it('shows added and changed lines with context', () => {
    const d = unifiedDiff('a\nb\nc\nd\ne\nf\ng\n', 'a\nB\nc\nd\ne\nf\ng\nh\n', 'x.toml');
    expect(d).toBe('--- x.toml\n+++ x.toml (after apply)\n@@ -1,4 +1,4 @@\n a\n-b\n+B\n c\n d\n@@ -6,2 +6,3 @@\n f\n g\n+h');
  });

  it('shows everything as added for a new file and nothing for equal text', () => {
    expect(unifiedDiff('', 'a\n', 'x')).toContain('@@ -1,0 +1,1 @@\n+a');
    expect(unifiedDiff('a\n', 'a\n', 'x')).toBe('--- x\n+++ x (after apply)');
  });

  it('names the backup with a colon-free local timestamp', () => {
    expect(backupName('c.toml', new Date(2026, 0, 2, 3, 4, 5))).toBe('c.toml.bak-20260102-030405');
  });
});

describe('herdr-setup apply', () => {
  it('writes a backup, the new config, then reloads and reports the diagnostics', () => {
    const w = world('[ui]\nmouse_capture = true\n');
    const r = w.apply('--yes');
    expect(r.code).toBe(0);
    expect(w.asked).toEqual([]);
    expect(w.files.get(`${CONFIG}.bak-20260102-030405`)).toBe('[ui]\nmouse_capture = true\n');
    expect(w.files.get(CONFIG)).toBe('[ui]\nmouse_capture = true\n\n' + EMPTY_RESULT);
    expect(w.runs).toEqual([['herdr', 'server', 'reload-config']]);
    expect(r.text).toContain('+delivery = "herdr"');
    expect(r.text).toContain('{"diagnostics":[]}');
  });

  it('writes no backup when there is no config file yet', () => {
    const w = world(null);
    expect(w.apply('--yes').code).toBe(0);
    expect(w.files.get(CONFIG)).toBe(EMPTY_RESULT);
    expect(backups(w.files)).toEqual([]);
  });

  it('asks first and writes only after a yes', () => {
    const w = world('');
    expect(w.apply().code).toBe(0);
    expect(w.asked).toHaveLength(1);
    expect(w.files.get(CONFIG)).toBe(EMPTY_RESULT);
  });

  it('writes nothing and does not reload when the answer is no', () => {
    const w = world('[ui]\nx = 1\n', { confirm: false });
    const r = w.apply();
    expect(r.text).toContain('aborted: nothing written');
    expect(w.files.get(CONFIG)).toBe('[ui]\nx = 1\n');
    expect(backups(w.files)).toEqual([]);
    expect(w.runs).toEqual([]);
  });

  it('--dry-run only shows the diff', () => {
    const w = world('[ui]\nx = 1\n');
    const r = w.apply('--dry-run');
    expect(r.code).toBe(0);
    expect(r.text).toContain('would change');
    expect(r.text).toContain('+[ui.toast]');
    expect(w.asked).toEqual([]);
    expect(w.files.get(CONFIG)).toBe('[ui]\nx = 1\n');
    expect(backups(w.files)).toEqual([]);
    expect(w.runs).toEqual([]);
  });

  it('a second run reports nothing to do and writes nothing', () => {
    const w = world('');
    w.apply('--yes');
    const before = new Map(w.files);
    w.runs.length = 0;
    const r = w.apply('--yes');
    expect(r.code).toBe(0);
    expect(r.text).toContain('nothing to do');
    expect(w.files).toEqual(before);
    expect(w.runs).toEqual([]);
  });

  it('reports hints for conflicts and leaves the user keys alone', () => {
    const own = `[ui.toast]\ndelivery = "all"\n\n[ui.sidebar.agents]\nrows = [["agent"]]\n\n[[keys.command]]\nkey = "prefix+d"\ncommand = "mine.thing"\n`;
    const w = world(own);
    const r = w.apply('--yes');
    expect(r.text).toContain('hint: ui.sidebar.agents rows are already set');
    expect(w.files.get(CONFIG)!.startsWith(own)).toBe(true);
    expect(w.files.get(CONFIG)).toContain('key = "prefix+shift+s"');
  });

  it('keeps CRLF in the written file and the backup', () => {
    const w = world('[ui]\r\nx = 1\r\n');
    w.apply('--yes');
    expect(w.files.get(CONFIG)!.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(w.files.get(`${CONFIG}.bak-20260102-030405`)).toBe('[ui]\r\nx = 1\r\n');
  });

  it('fails with exit 1 when the reload fails, after the file is written', () => {
    const w = world('', { reloadOk: false });
    const r = w.apply('--yes');
    expect(r.code).toBe(1);
    expect(r.text).toContain('herdr server reload-config failed');
    expect(w.files.get(CONFIG)).toBe(EMPTY_RESULT);
  });

  it('fails with exit 1 and no reload when the write fails', () => {
    const w = world('x = 1\n', { writeFails: true });
    const r = w.apply('--yes');
    expect(r.code).toBe(1);
    expect(r.text).toContain('failed to write: disk full');
    expect(w.runs).toEqual([]);
  });

  it('aborts without writing when the config exists but cannot be read', () => {
    const w = world('[ui.toast]\ndelivery = "off"\n', { unreadable: true });
    const r = w.apply('--yes');
    expect(r.code).toBe(1);
    expect(r.text).toContain('cannot be read');
    expect(w.files.get(CONFIG)).toBe('[ui.toast]\ndelivery = "off"\n');
    expect(backups(w.files)).toEqual([]);
    expect(w.runs).toEqual([]);
  });

  it('lists apply in the help', () => {
    const lines: string[] = [];
    main(['--help'], world('').apply as never, (t) => lines.push(t));
    expect(lines.join()).toContain('--dry-run');
  });
});

describe('planApply robustness', () => {
  it('hints at a delivery value other than off or herdr and leaves it alone', () => {
    for (const v of ['all', 'system']) {
      const plan = planApply(`[ui.toast]\ndelivery = "${v}"\n`);
      expect(plan.hints.join('\n')).toContain(`ui.toast.delivery is "${v}"`);
      expect(plan.after).toContain(`delivery = "${v}"`);
    }
    expect(planApply('[ui.toast]\ndelivery = "herdr"\n').hints.join()).not.toContain('delivery');
  });

  it('recognises a table after a leading BOM and keeps the BOM', () => {
    const plan = planApply('\uFEFF[ui.toast]\ndelivery = "off"\n');
    expect(plan.after.startsWith('\uFEFF[ui.toast]\ndelivery = "herdr"\n')).toBe(true);
    expect(plan.after.match(/\[ui\.toast\]/g)).toHaveLength(1);
  });

  it('adds a hint and no key entries for an inline keys.command array', () => {
    for (const text of ['[keys]\ncommand = [{ key = "prefix+d", command = "x" }]\n', 'keys.command = [{ key = "prefix+d" }]\n']) {
      const plan = planApply(text);
      expect(plan.hints.join('\n')).toContain('inline array');
      expect(plan.after).not.toContain('[[keys.command]]');
    }
  });
});

describe('herdr-setup apply as a script', () => {
  const script = join(import.meta.dirname, '..', 'scripts', 'herdr-setup.ts');
  const spawn = (dir: string, file: string, args: string[]) =>
    spawnSync(process.execPath, [script, 'apply', ...args], {
      encoding: 'utf8',
      // An empty PATH makes herdr missing, so the reload fails fast and nothing touches a real herdr.
      env: { ...process.env, PATH: dir, Path: dir, HERDR_CONFIG_PATH: file },
      timeout: 25000,
    });

  it('exits 1 when the config path is not a readable file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-apply-'));
    try {
      const r = spawn(dir, dir, ['--yes']);
      expect(r.status).toBe(1);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('dry-run writes nothing, --yes writes the file and a backup next to it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-apply-'));
    try {
      const file = join(dir, 'config.toml');
      writeFileSync(file, '[ui]\nx = 1\n');
      const dry = spawn(dir, file, ['--dry-run']);
      expect(dry.status).toBe(0);
      expect(readdirSync(dir)).toEqual(['config.toml']);

      const real = spawn(dir, file, ['--yes']);
      expect(real.status).toBe(1); // the reload fails: no herdr on the PATH
      expect(real.stdout).toContain('reload-config failed');
      expect(readFileSync(file, 'utf8')).toContain('[ui.toast]');
      const bak = readdirSync(dir).filter((f) => f.startsWith('config.toml.bak-'));
      expect(bak).toHaveLength(1);
      expect(readFileSync(join(dir, bak[0]!), 'utf8')).toBe('[ui]\nx = 1\n');

      expect(existsSync(file)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('answers no without a terminal input', () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-apply-'));
    try {
      const file = join(dir, 'config.toml');
      const r = spawnSync(process.execPath, [script, 'apply'], {
        encoding: 'utf8',
        input: 'n\n',
        env: { ...process.env, PATH: dir, Path: dir, HERDR_CONFIG_PATH: file },
        timeout: 25000,
      });
      expect(r.stdout).toContain('aborted');
      expect(existsSync(file)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
