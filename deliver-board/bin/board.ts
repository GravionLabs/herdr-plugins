#!/usr/bin/env node
// herdr pane `board` (popup): open PBIs, claims, branches and PR state of the focused pane's repository.
// Input: DELIVER_BOARD_CWD (set by the `open` action) or HERDR_PLUGIN_CONTEXT_JSON. Reads only, never writes.
import { execFile, spawn } from 'node:child_process';
import { buildRows, parseIssues, parsePullRequests, parseRemoteHeads, type Row } from '../lib/board.ts';
import { cwdFromContext, ghErrorLine } from '../lib/context.ts';
import { keyAction, moveSelection, renderBoard } from '../lib/view.ts';

type Result = { ok: true; stdout: string } | { ok: false; code: string | number | null; stderr: string };

function run(command: string, args: string[], cwd: string): Promise<Result> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve({ ok: true, stdout });
      const code = (error as NodeJS.ErrnoException).code ?? null;
      resolve({
        ok: false,
        code: typeof code === 'string' || typeof code === 'number' ? code : null,
        stderr,
      });
    });
  });
}

function opener(platform: NodeJS.Platform): string | null {
  if (platform === 'darwin') return 'open';
  if (platform === 'linux') return 'xdg-open';
  return null;
}

function openUrl(url: string): Promise<boolean> {
  const command = opener(process.platform);
  if (!command || !url) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = spawn(command, [url], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

const out = process.stdout;
const write = (lines: string[]): void => {
  out.write(`\x1b[H\x1b[2J${lines.join('\r\n')}`);
};

function onKeys(handler: (data: string) => void): void {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', handler);
  process.stdin.resume();
}

function exit(code = 0): never {
  out.write('\x1b[?25h\x1b[?1049l');
  process.exit(code);
}

async function main(): Promise<void> {
  out.write('\x1b[?1049h\x1b[?25l');
  const cwd = process.env.DELIVER_BOARD_CWD || cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || process.cwd();
  const top = await run('git', ['rev-parse', '--show-toplevel'], cwd);
  if (!top.ok) {
    write([`Not a git repository: ${cwd}`, '', 'Press any key to close.']);
    onKeys(() => exit(0));
    return;
  }
  const repo = top.stdout.trim();

  let rows: Row[] = [];
  let selected = 0;
  let status = 'Loading…';
  const draw = (): void => write(renderBoard(rows, selected, out.columns || 120, status));

  const load = async (): Promise<void> => {
    status = 'Loading…';
    draw();
    const [issues, prs, heads] = await Promise.all([
      run(
        'gh',
        [
          'issue',
          'list',
          '--label',
          'pbi',
          '--state',
          'open',
          '--limit',
          '200',
          '--json',
          'number,title,assignees,labels,url',
        ],
        repo,
      ),
      run(
        'gh',
        [
          'pr',
          'list',
          '--base',
          'release/next',
          '--state',
          'all',
          '--limit',
          '100',
          '--json',
          'number,headRefName,state,url,statusCheckRollup',
        ],
        repo,
      ),
      run('git', ['ls-remote', '--heads', 'origin'], repo),
    ]);
    const failed = !issues.ok ? issues : !prs.ok ? prs : null;
    if (failed && !failed.ok) {
      rows = [];
      status = ghErrorLine(failed);
    } else if (issues.ok && prs.ok) {
      try {
        rows = buildRows(
          parseIssues(issues.stdout),
          parsePullRequests(prs.stdout),
          heads.ok ? parseRemoteHeads(heads.stdout) : [],
        );
        status = `${repo}  ${rows.length} open PBIs  (updated ${new Date().toLocaleTimeString()})`;
      } catch (error) {
        rows = [];
        status = error instanceof Error ? error.message : String(error);
      }
    }
    selected = moveSelection(selected, 'refresh', rows.length);
    draw();
  };

  out.on('resize', draw);
  onKeys(async (data) => {
    const action = keyAction(data);
    if (action === 'quit') exit(0);
    if (action === 'refresh') return load();
    if (action === 'up' || action === 'down') {
      selected = moveSelection(selected, action, rows.length);
      return draw();
    }
    if (action === 'open') {
      const row = rows[selected];
      if (!row) return;
      if (!(await openUrl(row.url))) {
        status = `Could not open ${row.url}`;
        draw();
      }
    }
  });
  await load();
}

main().catch((error: unknown) => {
  write([`deliver-board: ${error instanceof Error ? error.message : String(error)}`, '', 'Press any key to close.']);
  onKeys(() => exit(1));
});
