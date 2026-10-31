#!/usr/bin/env node
// herdr action `apply`: applies the project layout to the workspace of the focused pane, cwd = repository root.
// Input: HERDR_PLUGIN_CONTEXT_JSON (focused pane id, cwd, workspace id), HERDR_PLUGIN_CONFIG_DIR.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyLayout } from '../lib/apply.ts';
import { CONFIG_FILE, CONFIG_LAYOUT_FILE, REPO_LAYOUT_FILE, resolveLayout } from '../lib/layout.ts';
import { run } from '../lib/run.ts';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';

const read = (path: string): Promise<string | null> =>
  readFile(path, 'utf8').then(
    (content) => content,
    () => null,
  );

async function notify(title: string, body?: string): Promise<void> {
  await run(herdr, ['notification', 'show', title, ...(body ? ['--body', body] : [])], process.cwd());
}

const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

async function main(): Promise<void> {
  let context: Record<string, unknown> = {};
  try {
    context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON ?? '{}');
  } catch {
    // no usable context
  }
  const paneId = str(context.focused_pane_id) ?? process.env.HERDR_PANE_ID ?? null;
  const cwd = str(context.focused_pane_cwd) ?? str(context.workspace_cwd) ?? process.cwd();
  const workspaceId = str(context.workspace_id) ?? process.env.HERDR_WORKSPACE_ID ?? null;
  if (!paneId) return notify('layout-bootstrap: no focused pane');

  const top = await run('git', ['rev-parse', '--show-toplevel'], cwd);
  if (!top.ok) return notify('layout-bootstrap: not a git repository', cwd);
  const repo = top.stdout.trim();

  const configDir = process.env.HERDR_PLUGIN_CONFIG_DIR ?? '';
  const { layout, source } = resolveLayout({
    repoLayout: await read(join(repo, REPO_LAYOUT_FILE)),
    configLayout: configDir ? await read(join(configDir, CONFIG_LAYOUT_FILE)) : null,
    config: configDir ? await read(join(configDir, CONFIG_FILE)) : null,
  });
  const outcome = await applyLayout(run, herdr, layout, repo, paneId, workspaceId);
  process.stdout.write(
    `${repo}: ${source} layout, created ${outcome.created.join(', ') || '-'}, reused ${outcome.reused.join(', ') || '-'}${outcome.misplaced.length ? `, not in repo root ${outcome.misplaced.join(', ')}` : ''}\n`,
  );
  const away = outcome.misplaced.length ? `; not in the repository root: ${outcome.misplaced.join(', ')}` : '';
  await notify(`Layout applied: ${outcome.created.length} created, ${outcome.reused.length} reused${away}`);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
  await notify('layout-bootstrap failed', message);
});
