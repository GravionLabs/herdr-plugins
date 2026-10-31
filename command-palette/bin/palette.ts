#!/usr/bin/env node
// herdr pane `palette` (popup): placeholder loop until the entries land (#41-#43).
// Escape and Ctrl+C close it with exit code 0 and restore cursor and screen.
import { parsePaletteContext } from '../lib/context.ts';

const out = process.stdout;
const context = parsePaletteContext(process.env.PALETTE_CONTEXT);

function exit(code = 0): never {
  out.write('\x1b[?25h\x1b[?1049l');
  process.exit(code);
}

out.write('\x1b[?1049h\x1b[?25l');
const where = context?.cwd ? `${context.cwd}${context.paneId ? ` (${context.paneId})` : ''}` : 'no context';
out.write(`\x1b[H\x1b[2JCommand palette\r\n\r\n${where}\r\n\r\nEscape or Ctrl+C closes`);

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data: string) => {
  if (data === '\x1b' || data === '\x03') exit(0);
});
process.stdin.resume();
process.on('SIGINT', () => exit(0));
process.on('SIGTERM', () => exit(0));
