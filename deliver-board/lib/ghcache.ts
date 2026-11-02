// Fewer GitHub API calls: a short-lived cache under the plugin state directory (HERDR_PLUGIN_STATE_DIR), REST calls
// revalidated with an ETag (a 304 answer costs no rate limit), and the rate limit reset time. This file is copied into
// every plugin that needs it (plugins install separately); test/ghcache-copies.test.ts fails when the copies differ, so
// edit all copies together. Only I/O: the cache files and the injected `run`.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type RunResult =
  { ok: true; stdout: string } | { ok: false; code: string | number | null; stdout?: string; stderr: string };
export type RunFn = (command: string, args: string[], cwd: string) => Promise<RunResult>;

export type CacheOptions = { dir: string | undefined; ttlMs: number; now?: () => number };

export type Cached =
  | { ok: true; body: string }
  | { ok: false; rateLimit: { resetAt: number | null; message: string } }
  | { ok: false; failure: { code: string | number | null; stderr: string } };

export const DEFAULT_TTL_MS = 30_000;

type Entry = { etag: string | null; body: string; fetchedAt: number };

const file = (dir: string, key: string): string => join(dir, 'gh-cache', `${createHash('sha1').update(key).digest('hex')}.json`);

function readEntry(dir: string | undefined, key: string): Entry | null {
  if (!dir) return null;
  try {
    const raw = JSON.parse(readFileSync(file(dir, key), 'utf8')) as Record<string, unknown>;
    if (typeof raw.body !== 'string' || typeof raw.fetchedAt !== 'number') return null;
    return { etag: typeof raw.etag === 'string' ? raw.etag : null, body: raw.body, fetchedAt: raw.fetchedAt };
  } catch {
    return null;
  }
}

// A cache that cannot be written (no directory, read-only disk) only costs the saved call.
function writeEntry(dir: string | undefined, key: string, entry: Entry): void {
  if (!dir) return;
  try {
    mkdirSync(join(dir, 'gh-cache'), { recursive: true });
    writeFileSync(file(dir, key), JSON.stringify(entry));
  } catch {
    // ignored
  }
}

export type ApiResponse = { status: number; headers: Record<string, string>; body: string };

// Splits the output of `gh api -i` into status, lower-cased headers and body; null when it has no HTTP status line.
export function parseApiResponse(output: string): ApiResponse | null {
  const text = output.replaceAll('\r\n', '\n');
  const status = /^HTTP\/\S+ (\d{3})/.exec(text);
  if (!status) return null;
  const split = text.indexOf('\n\n');
  const head = split === -1 ? text : text.slice(0, split);
  const headers: Record<string, string> = {};
  for (const line of head.split('\n').slice(1)) {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return { status: Number(status[1]), headers, body: split === -1 ? '' : text.slice(split + 2) };
}

const two = (n: number): string => String(n).padStart(2, '0');

// Local clock time of an epoch second, `HH:MM`.
export function formatReset(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

// The message of a rate limit hit: with the reset time when it is known.
export function rateLimitMessage(resetAt: number | null): string {
  return resetAt === null
    ? 'GitHub rate limit exceeded. Wait until it resets, then try again.'
    : `GitHub rate limit exceeded, resets at ${formatReset(resetAt)}. Wait until then, then try again.`;
}

const RATE_LIMITED = /rate limit/i;

function rateLimited(response: ApiResponse | null, stderr: string): boolean {
  if (response && (response.status === 403 || response.status === 429) && response.headers['x-ratelimit-remaining'] === '0') {
    return true;
  }
  return RATE_LIMITED.test(stderr) || (response !== null && response.status >= 400 && RATE_LIMITED.test(response.body));
}

function resetOf(response: ApiResponse | null): number | null {
  const reset = Number(response?.headers['x-ratelimit-reset']);
  return Number.isInteger(reset) && reset > 0 ? reset : null;
}

// One REST GET (`gh api <endpoint>`, a path with its query). Fresh cache entries are used without a call; older ones are
// revalidated with If-None-Match, so an unchanged answer is a 304 that costs no rate limit.
export async function cachedApi(run: RunFn, cwd: string, endpoint: string, options: CacheOptions): Promise<Cached> {
  const now = (options.now ?? Date.now)();
  const key = `${cwd}\n${endpoint}`;
  const entry = readEntry(options.dir, key);
  if (entry && now - entry.fetchedAt >= 0 && now - entry.fetchedAt < options.ttlMs) return { ok: true, body: entry.body };
  const args = ['api', '-i', ...(entry?.etag ? ['-H', `If-None-Match: ${entry.etag}`] : []), endpoint];
  const result = await run('gh', args, cwd);
  const response = parseApiResponse(result.ok ? result.stdout : (result.stdout ?? ''));
  if (response?.status === 304 && entry) {
    writeEntry(options.dir, key, { ...entry, fetchedAt: now });
    return { ok: true, body: entry.body };
  }
  if (result.ok && response && response.status >= 200 && response.status < 300) {
    writeEntry(options.dir, key, { etag: response.headers.etag ?? null, body: response.body, fetchedAt: now });
    return { ok: true, body: response.body };
  }
  const stderr = result.ok ? '' : result.stderr;
  if (rateLimited(response, stderr)) {
    const resetAt = resetOf(response);
    return { ok: false, rateLimit: { resetAt, message: rateLimitMessage(resetAt) } };
  }
  if (result.ok) return { ok: false, failure: { code: null, stderr: 'unreadable gh output' } };
  return { ok: false, failure: { code: result.code, stderr } };
}

// Any command whose output is cached for `ttlMs` (no ETag; for `gh pr list` and other GraphQL calls).
export async function cachedCommand(
  run: RunFn,
  command: string,
  args: string[],
  cwd: string,
  options: CacheOptions,
): Promise<Cached> {
  const now = (options.now ?? Date.now)();
  const key = `${cwd}\n${command} ${args.join(' ')}`;
  const entry = readEntry(options.dir, key);
  if (entry && now - entry.fetchedAt >= 0 && now - entry.fetchedAt < options.ttlMs) return { ok: true, body: entry.body };
  const result = await run(command, args, cwd);
  if (result.ok) {
    writeEntry(options.dir, key, { etag: null, body: result.stdout, fetchedAt: now });
    return { ok: true, body: result.stdout };
  }
  if (RATE_LIMITED.test(result.stderr)) {
    const resetAt = await graphqlReset(run, cwd);
    return { ok: false, rateLimit: { resetAt, message: rateLimitMessage(resetAt) } };
  }
  return { ok: false, failure: { code: result.code, stderr: result.stderr } };
}

// Reset time (epoch seconds) of the GraphQL budget from `gh api rate_limit`, which does not count against any limit.
export async function graphqlReset(run: RunFn, cwd: string): Promise<number | null> {
  const result = await run('gh', ['api', 'rate_limit'], cwd);
  if (!result.ok) return null;
  try {
    const reset = (JSON.parse(result.stdout) as { resources?: { graphql?: { reset?: unknown } } }).resources?.graphql?.reset;
    return typeof reset === 'number' && reset > 0 ? reset : null;
  } catch {
    return null;
  }
}
