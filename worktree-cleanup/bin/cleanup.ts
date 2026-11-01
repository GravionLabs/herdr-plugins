#!/usr/bin/env node
// herdr action `cleanup`: removes the worktrees and local branches of the merged PRs into release/next in the
// repository of the focused pane, through the installed `deliver` skill's Remove-PbiWorktrees.ps1.
// Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd). Output: a notification, details in the plugin log.
import { cleanup } from '../lib/cleanup.ts';
import { cwdFromContext } from '../lib/context.ts';
import { noRepository, notice, noticeFor } from '../lib/errors.ts';
import { gitToplevel, notify, removeScript, report } from '../lib/host.ts';
import { run } from '../lib/run.ts';
import { INSTALL_COMMAND } from '../lib/skill.ts';

async function main(): Promise<void> {
  const cwd = cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || process.cwd();
  const repo = await gitToplevel(cwd);
  if (!repo) {
    const shown = notice('worktree-cleanup', noRepository());
    return notify(shown.title, `${shown.body} (${cwd})`);
  }
  const script = removeScript(repo);
  if (!script) return notify('worktree-cleanup: deliver skill not installed', `Install it: ${INSTALL_COMMAND}`);

  const result = await cleanup(run, repo, script);
  process.stdout.write(`${repo}: ${result.candidates.length} merged PRs with leftovers\n`);
  await report(result, result.failed);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
  const shown = noticeFor('worktree-cleanup', message, 'worktree-cleanup failed');
  await notify(shown.title, shown.body);
});
