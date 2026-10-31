#!/usr/bin/env node
// herdr pane `palette` (popup): raw-mode loop over the pure modules. Enter returns the selected entry
// (running it comes in #42); Escape and Ctrl+C close with exit code 0.
import { parsePaletteContext } from '../lib/context.ts';
import { exampleEntries } from '../lib/entries.ts';
import { applyKey, initialState, type State } from '../lib/keys.ts';
import { render } from '../lib/view.ts';

const out = process.stdout;
const context = parsePaletteContext(process.env.PALETTE_CONTEXT);
void context; // used by the entry sources (#42, #43)

// Runs on every exit path (process.exit, uncaught exception, end of stdin), so it must be idempotent.
function restore(): void {
  out.write('\x1b[?25h\x1b[?1049l');
}
process.on('exit', restore);

let state: State = initialState(exampleEntries);

const draw = (): void => {
  const lines = render(state, out.rows || 24, out.columns || 80);
  out.write(`\x1b[H\x1b[2J${lines.join('\r\n')}`);
};

out.write('\x1b[?1049h\x1b[?25l');
draw();

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data: string) => {
  state = applyKey(state, data);
  if (state.status !== 'open') process.exit(0);
  draw();
});
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
process.stdin.resume();
out.on('resize', draw);
process.on('SIGWINCH', draw);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => process.exit(0));
