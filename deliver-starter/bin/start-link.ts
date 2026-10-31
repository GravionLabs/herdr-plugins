#!/usr/bin/env node
// herdr action `start-link` (link handler): the interactive start for the clicked issue URL, without the popup.
// Input: HERDR_PLUGIN_CLICKED_URL, HERDR_PLUGIN_CONTEXT_JSON (focused pane cwd).
import { cwdFromContext } from '../lib/context.ts';
import { gitToplevel, notify } from '../lib/host.ts';
import { parseIssueUrl } from '../lib/link.ts';
import { loadConfig, realDeps } from '../lib/runtime.ts';
import { startFromLink } from '../lib/link-start.ts';

async function main(): Promise<void> {
  const cwd = cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || process.cwd();
  const link = parseIssueUrl(process.env.HERDR_PLUGIN_CLICKED_URL);
  const repo = await gitToplevel(cwd);
  const outcome = await startFromLink(realDeps(), repo, loadConfig(), link);
  if (outcome.ok) return;
  process.exitCode = 1;
  await notify('deliver-starter: not started', outcome.reason);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  await notify('deliver-starter failed', message);
});
