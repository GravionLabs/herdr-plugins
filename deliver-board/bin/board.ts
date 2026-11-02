#!/usr/bin/env node
// herdr pane `board` (popup): open PBIs, claims, branches and PR state of the focused pane's repository.
// Input: DELIVER_BOARD_CWD (set by the `open` action) or HERDR_PLUGIN_CONTEXT_JSON. Reads only, never writes.
import { execFile } from 'node:child_process';
import { buildRows, fetchIssuePages, ISSUES_PAGE_SIZE, parseIssues, parsePullRequests, parseRemoteHeads, type Row } from '../lib/board.ts';
import { opener } from '../lib/open.ts';
import { cachedApi, cachedCommand, DEFAULT_TTL_MS, type CacheOptions } from '../lib/ghcache.ts';
import { cwdFromContext, ghErrorLine } from '../lib/context.ts';
import { keyAction, moveSelection, renderBoard } from '../lib/view.ts';

type Result = { ok: true; stdout: string } | { ok: false; code: string | number | null; stdout: string; stderr: string };

function run(command: string, args: string[], cwd: string): Promise<Result> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve({ ok: true, stdout });
      const code = (error as NodeJS.ErrnoException).code ?? null;
      resolve({
        ok: false,
        code: typeof code === 'string' || typeof code === 'number' ? code : null,
        stdout: String(stdout ?? ''),
        stderr,
      });
    });
  });
}

function openUrl(url: string): Promise<boolean> {
  const open = url ? opener(process.platform, url) : null;
  if (!open) return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile(open.command, open.args, (error) => resolve(!error));
  });
}

// Cache of the state directory (HERDR_PLUGIN_STATE_DIR); `r` (refresh) within the TTL reuses it, an older entry is
// revalidated with its ETag.
const cache: CacheOptions = { dir: process.env.HERDR_PLUGIN_STATE_DIR || undefined, ttlMs: DEFAULT_TTL_MS };

// A rate limit shows a notification with the reset time instead of only failing; best effort.
function notifyRateLimit(message: string): void {
  execFile(process.env.HERDR_BIN_PATH || 'herdr', ['notification', 'show', 'deliver-board: GitHub rate limit exceeded', '--body', message], () => undefined);
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
      fetchIssuePages((page) =>
        cachedApi(run, repo, `repos/{owner}/{repo}/issues?labels=pbi&state=open&per_page=${ISSUES_PAGE_SIZE}&page=${page}`, cache),
      ),
      cachedCommand(
        run,
        'gh',
        ['pr', 'list', '--base', 'release/next', '--state', 'all', '--limit', '100', '--json', 'number,headRefName,state,url,statusCheckRollup'],
        repo,
        cache,
      ),
      run('git', ['ls-remote', '--heads', 'origin'], repo),
    ]);
    const failed = !issues.ok ? issues : !prs.ok ? prs : null;
    if (failed && !failed.ok) {
      rows = [];
      if ('rateLimit' in failed) {
        status = failed.rateLimit.message;
        notifyRateLimit(failed.rateLimit.message);
      } else {
        status = ghErrorLine(failed.failure);
      }
    } else if (issues.ok && prs.ok) {
      try {
        rows = buildRows(
          parseIssues(issues.body),
          parsePullRequests(prs.body),
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
