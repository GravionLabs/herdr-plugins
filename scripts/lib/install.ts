// `herdr-setup install`: installs plugins of this repository at a release tag. Everything it touches comes in through `Deps`.
import { parsePlugins, type Deps } from './doctor.ts';

export const REPO = 'GravionLabs/herdr-plugins';
// Fixed so the script also works from a downloaded release; a test keeps it equal to the plugin directories of the repo.
export const PLUGINS = [
  'agent-notify', 'command-palette', 'deliver-board', 'deliver-log', 'deliver-starter', 'deliver-view',
  'layout-bootstrap', 'link-trim', 'repo-open', 'review-popup', 'worktree-cleanup',
];

export interface InstallOptions {
  plugins: string[];
  ref?: string;
  dryRun: boolean;
}

export function parseInstallArgs(args: string[]): InstallOptions | string {
  const opts: InstallOptions = { plugins: [], dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--ref') {
      const v = args[++i];
      if (!v || v.startsWith('--')) return '--ref needs a tag';
      opts.ref = v;
    } else if (a.startsWith('--ref=')) {
      if (a.length === 6) return '--ref needs a tag';
      opts.ref = a.slice(6);
    } else if (a.startsWith('--')) {
      if (a !== '--json' && a !== '--yes') return `unknown option '${a}'`;
    } else opts.plugins.push(a);
  }
  const unknown = opts.plugins.filter((p) => !PLUGINS.includes(p));
  if (unknown.length) return `unknown plugin '${unknown.join("', '")}' (known: ${PLUGINS.join(', ')})`;
  return opts;
}

export function runInstall(deps: Deps, args: string[], out: (text: string) => void): number {
  const opts = parseInstallArgs(args);
  if (typeof opts === 'string') {
    out(`install: ${opts}`);
    return 1;
  }
  let ref = opts.ref;
  if (!ref) {
    const r = deps.run('gh', ['api', `repos/${REPO}/releases/latest`, '--jq', '.tag_name']);
    ref = r.ok ? r.stdout.trim() : '';
    if (!ref) {
      out(`install: no release found for ${REPO}; pass --ref <tag> or check \`gh auth status\``);
      return 1;
    }
  }
  const plugins = opts.plugins.length ? opts.plugins : PLUGINS;
  const list = deps.run('herdr', ['plugin', 'list', '--json']);
  const installed = list.ok ? (parsePlugins(list.stdout) ?? []) : [];

  out(`Plan: install at ${ref}`);
  for (const p of plugins) out(`  ${p}: ${installed.find((i) => i.name === p)?.ref ?? 'not installed'} -> ${ref}`);
  if (opts.dryRun) {
    out('dry run: nothing installed');
    return 0;
  }

  const failed: string[] = [];
  for (const p of plugins) {
    const r = deps.run('herdr', ['plugin', 'install', '-y', '--ref', ref, `${REPO}/${p}`], 300000);
    if (r.ok) out(`ok   ${p}`);
    else {
      failed.push(p);
      out(`FAIL ${p}: herdr plugin install failed`);
    }
  }

  const after = deps.run('herdr', ['plugin', 'list', '--json']);
  const now = after.ok ? parsePlugins(after.stdout) : null;
  if (!now) out('FAIL plugins: could not read `herdr plugin list --json`');
  else
    for (const p of plugins) {
      const cur = now.find((i) => i.name === p)?.ref;
      if (cur === ref) out(`ok   ${p}@${ref}`);
      else if (!failed.includes(p)) {
        failed.push(p);
        out(`FAIL ${p}: shows ${cur ?? 'no ref'}, expected ${ref}`);
      }
    }
  if (failed.length) out(`${failed.length} of ${plugins.length} failed: ${failed.join(', ')}`);
  return failed.length || !now ? 1 : 0;
}
