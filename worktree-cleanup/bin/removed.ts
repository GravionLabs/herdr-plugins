#!/usr/bin/env node
// herdr event hook on `worktree.removed`: deletes the local branch of the removed worktree once it is orphaned and
// every commit of it is on a remote branch. Input: HERDR_PLUGIN_EVENT_JSON, HERDR_PLUGIN_CONTEXT_JSON.
// Silent when there is nothing to do; otherwise a notification, details in the plugin log.
import { deleteOrphanedBranch } from '../lib/cleanup.ts';
import { cwdFromContext, removedWorktreeFromEvent } from '../lib/context.ts';
import { noticeFor } from '../lib/errors.ts';
import { gitToplevel, notify, report } from '../lib/host.ts';
import { run } from '../lib/run.ts';

async function main(): Promise<void> {
  const removed = removedWorktreeFromEvent(process.env.HERDR_PLUGIN_EVENT_JSON);
  if (!removed?.branch) return;
  const cwd = removed.repoRoot ?? cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON);
  const repo = cwd ? await gitToplevel(cwd) : null;
  if (!repo) return;
  const result = await deleteOrphanedBranch(run, repo, removed.branch);
  if (result) await report(result);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
  const shown = noticeFor('worktree-cleanup', message, 'worktree-cleanup failed');
  await notify(shown.title, shown.body);
});
