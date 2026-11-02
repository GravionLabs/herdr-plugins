#!/usr/bin/env node
// herdr pane `picker` (popup): raw-mode loop over the pure modules. Enter starts the detached runner (bin/run.ts)
// for the selected repository and exits, which closes the popup; Escape and Ctrl+C close with exit code 0.
import { fileURLToPath } from 'node:url';
import { configHint } from '../lib/config.ts';
import { discover } from '../lib/discover.ts';
import { loadConfig, notify, spawnRunner } from '../lib/host.ts';
import { applyKey, initialState, type State } from '../lib/keys.ts';
import { readState } from '../lib/recent.ts';
import { render } from '../lib/view.ts';

const out = process.stdout;

// Runs on every exit path (process.exit, uncaught exception, end of stdin), so it must be idempotent.
function restore(): void {
  out.write('\x1b[?25h\x1b[?1049l');
}
process.on('exit', restore);

const { config, problems } = loadConfig();
let state: State = initialState(await discover(config.roots, config.depth), {
  hint: configHint(problems),
  recent: readState(process.env.HERDR_PLUGIN_STATE_DIR),
  now: Date.now(),
  empty: `No repositories below ${config.roots.join(', ')}`,
});

const draw = (): void => {
  const lines = render(state, out.rows || 24, out.columns || 80);
  out.write(`\x1b[H\x1b[2J${lines.join('\r\n')}`);
};

// The popup exits only after the runner was spawned; a failing spawn notifies and exits 1.
async function pick(): Promise<void> {
  const repo = state.picked!;
  const runner = fileURLToPath(new URL('./run.ts', import.meta.url));
  if (await spawnRunner(runner, JSON.stringify(repo))) process.exit(0);
  await notify(`repo-open: ${repo.name} failed`, 'could not start the runner').catch(() => false);
  process.exit(1);
}

out.write('\x1b[?1049h\x1b[?25l');
draw();

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data: string) => {
  state = applyKey(state, data);
  if (state.status === 'pick') {
    process.stdin.pause();
    void pick();
    return;
  }
  if (state.status !== 'open') process.exit(0);
  draw();
});
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
process.stdin.resume();
out.on('resize', draw);
process.on('SIGWINCH', draw);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => process.exit(0));
