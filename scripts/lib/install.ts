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

  // One call lists the top-level directories at the ref; plugins that are not there (newer than the tag) are skipped.
  const dirs = deps.run('gh', ['api', `repos/${REPO}/contents/?ref=${encodeURIComponent(ref)}`, '--jq', '.[] | select(.type == "dir") | .name']);
  const present = dirs.ok ? new Set(dirs.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) : null;
  const usable = present && present.size > 0 ? present : null;
  if (!usable) out(`warning: could not list the plugins in ${ref}; installing all of them without checking`);
  const missing = usable ? plugins.filter((p) => !usable.has(p)) : [];
  const explicit = opts.plugins.length > 0;

  out(`Plan: install at ${ref}`);
  for (const p of plugins) {
    if (missing.includes(p)) out(`  ${p}: skipped (not in ${ref})`);
    else out(`  ${p}: ${installed.find((i) => i.name === p)?.ref ?? 'not installed'} -> ${ref}`);
  }
  // Plugins the user named but the tag does not have are an error; the ones of the default list are only skipped.
  const failed: string[] = explicit ? [...missing] : [];
  for (const p of failed) out(`FAIL ${p}: not in ${ref}`);
  if (opts.dryRun) {
    out('dry run: nothing installed');
    return failed.length ? 1 : 0;
  }

  const todo = plugins.filter((p) => !missing.includes(p));
  for (const p of todo) {
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
    for (const p of todo) {
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
