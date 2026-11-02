#!/usr/bin/env node
// herdr pane `review` (popup): last deliver review of the PBI behind the focused pane's branch; on a branch without
// PBI number (the deliver pane on release/next) a list of all reviews to choose from. Reads only.
// Input: REVIEW_POPUP_CWD / REVIEW_POPUP_PANE (set by the `open` action) or HERDR_PLUGIN_CONTEXT_JSON.
import { cwdFromContext } from '../lib/context.ts';
import { noticeFor } from '../lib/errors.ts';
import { herdrBin, notify } from '../lib/host.ts';
import { load, realRead } from '../lib/load.ts';
import { back, choose, keyAction, move, render, type State } from '../lib/review.ts';
import { run } from '../lib/run.ts';
import { openFinding } from '../lib/split.ts';

const out = process.stdout;

function exit(code = 0): never {
  out.write('\x1b[?25h\x1b[?1049l');
  process.exit(code);
}

async function main(): Promise<void> {
  out.write('\x1b[?1049h\x1b[?25l');
  const cwd = process.env.REVIEW_POPUP_CWD || cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || process.cwd();
  const pane = process.env.REVIEW_POPUP_PANE || undefined;
  const { state: first, toplevel } = await load(run, realRead, cwd);
  let state: State = first;
  let notice = '';
  const draw = (): void => {
    out.write(`\x1b[H\x1b[2J${[...render(state, out.columns || 100), ...(notice ? ['', notice] : [])].join('\r\n')}`);
  };
  out.on('resize', draw);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (data: string) => {
    const key = keyAction(data);
    if (key === 'quit') exit(0);
    if (key === 'up' || key === 'down') {
      state = move(state, key);
      notice = '';
      return draw();
    }
    if (key === 'back') {
      state = back(state);
      notice = '';
      return draw();
    }
    if (key === 'open' && state.kind === 'pick') {
      const entry = state.entries[state.selected];
      state = choose(state);
      notice = entry && !entry.review ? `Cannot show #${entry.pbi}: ${entry.file}` : '';
      return draw();
    }
    if (key === 'open' && state.kind === 'review') {
      const finding = state.review.review.blocking[state.selected];
      const dir = state.toplevel ?? toplevel;
      if (!finding || !dir) return;
      const reason = await openFinding(run, herdrBin(), dir, pane, process.env.EDITOR, finding);
      if (reason === null) exit(0);
      notice = reason;
      draw();
    }
  });
  process.stdin.resume();
  draw();
}

main().catch(async (error: unknown) => {
  const shown = noticeFor('review-popup', error instanceof Error ? error.message : String(error), 'review-popup failed');
  await notify(shown.title, shown.body).catch(() => undefined);
  out.write(`${shown.title}\r\n${shown.body}\r\n`);
  setTimeout(() => exit(1), 3000);
});
