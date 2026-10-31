// The start: validation, interactive in a herdr worktree, unattended through the loop script.
import type { Target } from './args.ts';
import { branchName, interactiveCommand, loopScript, tabLabel, unattendedCommand } from './command.ts';
import type { Config, Mode } from './config.ts';
import { checkIssue, viewFailure } from './issue.ts';
import { failureLine, type Run } from './run.ts';
import { findDeliverSkill, INSTALL_COMMAND } from './skill.ts';

export type Deps = {
  run: Run;
  herdr: string;
  exists: (path: string) => boolean;
  home: string;
};

export type Outcome = { ok: true } | { ok: false; reason: string; installHint?: boolean };

const fail = (reason: string): Outcome => ({ ok: false, reason });

// Checks every number with `gh issue view`; the first problem is the reason. `repoSlug` (owner/name) pins the repository.
export async function validate(deps: Deps, cwd: string, target: Target, repoSlug?: string): Promise<string | null> {
  for (const nr of target.numbers) {
    const args = ['issue', 'view', String(nr), '--json', 'state,title,labels'];
    if (repoSlug) args.push('--repo', repoSlug);
    const result = await deps.run('gh', args, cwd);
    if (!result.ok) return viewFailure(nr, result.code, result.stderr);
    const verdict = checkIssue(nr, result.stdout);
    if (verdict) return verdict;
  }
  return null;
}

type Created = { result?: { root_pane?: { pane_id?: unknown } } };

function paneId(stdout: string): string | null {
  try {
    const id = (JSON.parse(stdout) as Created).result?.root_pane?.pane_id;
    return typeof id === 'string' && id !== '' ? id : null;
  } catch {
    return null;
  }
}

async function runIn(deps: Deps, stdout: string, command: string, cwd: string, what: string): Promise<Outcome> {
  const pane = paneId(stdout);
  if (!pane) return fail(`herdr ${what} returned no pane`);
  const ran = await deps.run(deps.herdr, ['pane', 'run', pane, command], cwd);
  return ran.ok ? { ok: true } : fail(`herdr pane run failed: ${failureLine(ran)}`);
}

// `repo` is the git toplevel of the focused pane's cwd.
export async function startInteractive(deps: Deps, repo: string, config: Config, target: Target): Promise<Outcome> {
  const created = await deps.run(
    deps.herdr,
    ['worktree', 'create', '--cwd', repo, '--branch', branchName(target), '--base', 'origin/release/next', '--focus'],
    repo,
  );
  if (!created.ok) return fail(`herdr worktree create failed: ${failureLine(created)}`);
  return runIn(deps, created.stdout, interactiveCommand(config.harness, target), repo, 'worktree create');
}

export async function startUnattended(deps: Deps, repo: string, target: Target): Promise<Outcome> {
  const skill = findDeliverSkill(repo, deps.home, deps.exists);
  if (!skill || !deps.exists(loopScript(skill))) {
    return { ok: false, reason: `deliver skill not installed. Install it: ${INSTALL_COMMAND}`, installHint: true };
  }
  const tab = await deps.run(deps.herdr, ['tab', 'create', '--cwd', repo, '--label', tabLabel(target), '--focus'], repo);
  if (!tab.ok) return fail(`herdr tab create failed: ${failureLine(tab)}`);
  return runIn(deps, tab.stdout, unattendedCommand(skill, target), repo, 'tab create');
}

export function start(deps: Deps, repo: string, config: Config, mode: Mode, target: Target): Promise<Outcome> {
  return mode === 'unattended' ? startUnattended(deps, repo, target) : startInteractive(deps, repo, config, target);
}
