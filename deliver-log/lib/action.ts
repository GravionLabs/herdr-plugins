import { noticeFor } from './errors.ts';
import { findDeliverSkill, INSTALL_COMMAND } from './skill.ts';
import { failureLine, firstStderrLine, type Run } from './run.ts';
import { scriptPath, toggleCommand } from './toggle.ts';

export type Deps = {
  run: Run;
  notify: (title: string, body?: string) => Promise<void>;
  exists: (path: string) => boolean;
  home: string;
};

// Toggles the log pane; `repo` is the git toplevel of the focused pane (null outside a repository), `cwd` its cwd.
export async function toggleLog(deps: Deps, repo: string | null, cwd: string): Promise<boolean> {
  const skill = findDeliverSkill(repo, deps.home, deps.exists);
  if (!skill || !deps.exists(scriptPath(skill))) {
    await deps.notify('deliver-log: deliver skill not installed', `Install it: ${INSTALL_COMMAND}`);
    return false;
  }
  const { command, args } = toggleCommand(skill);
  const result = await deps.run(command, args, repo ?? cwd);
  if (result.ok) {
    // The script exits 0 without a pane (no log, outside herdr) and names the reason on stderr.
    const reason = firstStderrLine(result);
    if (reason) await deps.notify('deliver-log: no log to show', reason);
    return true;
  }
  const shown = noticeFor('deliver-log', failureLine(result), 'deliver-log: toggle failed');
  await deps.notify(shown.title, shown.body);
  return false;
}
