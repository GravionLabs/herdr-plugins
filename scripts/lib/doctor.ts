// The doctor checks of scripts/herdr-setup.ts. Everything the checks touch comes in through `Deps`, so tests fake it.
import { deliverSkillCandidates } from '../../deliver-log/lib/skill.ts';
import { defaultConfigPath, readTable, readValue } from './config.ts';

export const MIN_HERDR = '0.9.5';
export const MIN_NODE = 26;

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
  plugins?: PluginInfo[];
}

export interface PluginInfo {
  name: string;
  plugin_id: string;
  enabled: boolean;
  ref: string | null;
  resolved_commit: string | null;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
}

export interface Deps {
  run: (command: string, args: string[], timeoutMs?: number) => RunResult;
  exists: (path: string) => boolean;
  readFile: (path: string) => string | null;
  env: Record<string, string | undefined>;
  platform: string;
  home: string;
  nodeVersion: string;
  cwd: string;
}

const version = (text: string): number[] | null => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export function versionAtLeast(found: number[], min: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if (found[i]! !== min[i]!) return found[i]! > min[i]!;
  }
  return true;
}

function tool(name: string, deps: Deps, args: string[], hint: string, label: string): Check {
  const r = deps.run(name, args);
  return r.ok ? { name: label, ok: true, detail: r.stdout.trim().split(/\r?\n/)[0] ?? '' } : { name: label, ok: false, detail: 'not found', hint };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

// Parses `herdr plugin list --json` ({"result":{"plugins":[...]}}); null when the shape is not that.
export function parsePlugins(stdout: string): PluginInfo[] | null {
  try {
    const list: unknown = (JSON.parse(stdout) as { result?: { plugins?: unknown } } | null)?.result?.plugins;
    if (!Array.isArray(list)) return null;
    return list.flatMap((p: unknown) => {
      if (!p || typeof p !== 'object') return [];
      const o = p as Record<string, unknown>;
      const name = str(o.name) ?? str(o.plugin_id);
      if (!name) return [];
      const src = o.source && typeof o.source === 'object' ? (o.source as Record<string, unknown>) : {};
      return [{ name, plugin_id: str(o.plugin_id) ?? name, enabled: o.enabled === true, ref: str(src.requested_ref), resolved_commit: str(src.resolved_commit) }];
    });
  } catch {
    return null;
  }
}

function pluginsCheck(deps: Deps): Check {
  const r = deps.run('herdr', ['plugin', 'list', '--json']);
  if (!r.ok) return { name: 'plugins', ok: false, detail: 'herdr plugin list failed', hint: 'check that herdr runs' };
  const plugins = parsePlugins(r.stdout);
  if (!plugins) return { name: 'plugins', ok: false, detail: 'unreadable output of `herdr plugin list --json`', hint: 'check that herdr >= ' + MIN_HERDR + ' is installed' };
  const detail = plugins.map((p) => `${p.name} ${p.enabled ? 'enabled' : 'disabled'} ${p.ref ?? 'no ref'}`).join('; ') || 'none installed';
  return { name: 'plugins', ok: true, detail, plugins };
}

export function runDoctor(deps: Deps): Check[] {
  const checks: Check[] = [];

  const herdr = deps.run('herdr', ['--version']);
  const hv = herdr.ok ? version(herdr.stdout) : null;
  if (!herdr.ok) checks.push({ name: 'herdr', ok: false, detail: 'not found', hint: 'install herdr >= ' + MIN_HERDR });
  else if (!hv) checks.push({ name: 'herdr', ok: false, detail: `unreadable version: ${herdr.stdout.trim()}`, hint: 'install herdr >= ' + MIN_HERDR });
  else {
    const ok = versionAtLeast(hv, version(MIN_HERDR)!);
    checks.push({ name: 'herdr', ok, detail: hv.join('.'), ...(ok ? {} : { hint: `upgrade herdr to >= ${MIN_HERDR}` }) });
  }

  const major = Number(/^v?(\d+)/.exec(deps.nodeVersion)?.[1] ?? 0);
  checks.push({ name: 'node', ok: major >= MIN_NODE, detail: deps.nodeVersion, ...(major >= MIN_NODE ? {} : { hint: `install Node >= ${MIN_NODE}` }) });

  checks.push(tool('pwsh', deps, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], 'install PowerShell 7 (pwsh)', 'pwsh'));
  const gh = tool('gh', deps, ['--version'], 'install the GitHub CLI (gh)', 'gh');
  checks.push(gh);
  if (gh.ok) {
    const auth = deps.run('gh', ['auth', 'status']);
    checks.push({ name: 'gh login', ok: auth.ok, detail: auth.ok ? 'logged in' : 'not logged in', ...(auth.ok ? {} : { hint: 'run `gh auth login`' }) });
  } else checks.push({ name: 'gh login', ok: false, detail: 'gh missing', hint: 'install gh, then run `gh auth login`' });

  const skill = deliverSkillCandidates(null, deps.home).find((d) => deps.exists(d));
  checks.push({ name: 'deliver skill', ok: !!skill, detail: skill ?? 'not installed', ...(skill ? {} : { hint: 'run `npx skills add GravionLabs/skills --skill deliver`' }) });

  const configPath = defaultConfigPath(deps.platform, deps.env, deps.home);
  const text = deps.readFile(configPath);
  const source = text === null ? 'no config file, defaults apply' : configPath;
  const body = text ?? '';

  const toast = readValue(body, 'ui.toast.delivery') ?? 'off';
  checks.push({ name: 'ui.toast.delivery', ok: toast !== 'off', detail: toast, ...(toast !== 'off' ? {} : { hint: `set delivery = "all" under [ui.toast] in ${configPath}` }) });

  const mouse = readValue(body, 'ui.mouse_capture') ?? 'true';
  checks.push({ name: 'ui.mouse_capture', ok: mouse !== 'false', detail: mouse, ...(mouse !== 'false' ? {} : { hint: `set mouse_capture = true under [ui] in ${configPath}` }) });

  const rows = readTable(body, 'ui.sidebar.agents');
  const named = rows !== null && /["']\$deliver["']/.test(rows);
  checks.push({ name: 'sidebar rows', ok: named, detail: named ? 'name $deliver' : rows === null ? 'no [ui.sidebar.agents]' : 'no $deliver row', ...(named ? {} : { hint: 'add a $deliver token to [ui.sidebar.agents] rows (see the deliver-view docs)' }) });

  checks.push(pluginsCheck(deps));

  checks.push({ name: 'config', ok: true, detail: source });
  return checks;
}
