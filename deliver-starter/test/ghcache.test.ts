import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cachedApi, cachedCommand, formatReset, graphqlReset, parseApiResponse, rateLimitMessage, type RunFn } from '../lib/ghcache.ts';

let dir: string;
beforeEach(() => {
  process.env.TZ = 'UTC';
  dir = mkdtempSync(join(tmpdir(), 'ghcache-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ok = (stdout: string): RunFn => async () => ({ ok: true, stdout });
const response = (status: string, headers: string, body = ''): string => `HTTP/2.0 ${status}\r\n${headers ? `${headers}\r\n` : ''}\r\n${body}`;
const RESET = 'GitHub rate limit exceeded, resets at 15:05. Wait until then, then try again.';

describe('parseApiResponse', () => {
  it('splits status, headers and body', () => {
    expect(parseApiResponse(response('200 OK', 'Etag: W/"x"\r\nX-Ratelimit-Remaining: 7', '[1]'))).toEqual({
      status: 200,
      headers: { etag: 'W/"x"', 'x-ratelimit-remaining': '7' },
      body: '[1]',
    });
  });

  it('returns null without a status line', () => {
    expect(parseApiResponse('[1]')).toBeNull();
    expect(parseApiResponse('')).toBeNull();
  });
});

describe('rate limit message', () => {
  it('names the reset time, or omits it when unknown', () => {
    expect(formatReset(1793545500)).toBe('15:05');
    expect(rateLimitMessage(1793545500)).toBe(RESET);
    expect(rateLimitMessage(null)).toBe('GitHub rate limit exceeded. Wait until it resets, then try again.');
  });
});

describe('cachedApi', () => {
  const calls: string[][] = [];
  const reply = (...stdouts: string[]): RunFn => async (_c, args) => {
    calls.push(args);
    return { ok: true, stdout: stdouts.shift()! };
  };
  beforeEach(() => void (calls.length = 0));
  const options = (now: number) => ({ dir, ttlMs: 30_000, now: () => now });

  it('stores the answer and serves it without a call while fresh', async () => {
    const run = reply(response('200 OK', 'Etag: "v1"', '[1]'));
    expect(await cachedApi(run, '/r', 'repos/{owner}/{repo}/issues', options(1000))).toEqual({ ok: true, body: '[1]' });
    expect(await cachedApi(run, '/r', 'repos/{owner}/{repo}/issues', options(20_000))).toEqual({ ok: true, body: '[1]' });
    expect(calls).toEqual([['api', '-i', 'repos/{owner}/{repo}/issues']]);
  });

  it('revalidates a stale entry with its ETag and keeps the body on 304', async () => {
    const run = reply(response('200 OK', 'Etag: "v1"', '[1]'), response('304 Not Modified', 'Etag: "v1"'));
    await cachedApi(run, '/r', 'e', options(0));
    expect(await cachedApi(run, '/r', 'e', options(60_000))).toEqual({ ok: true, body: '[1]' });
    expect(calls[1]).toEqual(['api', '-i', '-H', 'If-None-Match: "v1"', 'e']);
    // the 304 renewed the entry: fresh again, no third call
    await cachedApi(run, '/r', 'e', options(70_000));
    expect(calls.length).toBe(2);
  });

  it('takes a changed answer after the TTL', async () => {
    const run = reply(response('200 OK', 'Etag: "v1"', '[1]'), response('200 OK', 'Etag: "v2"', '[1,2]'));
    await cachedApi(run, '/r', 'e', options(0));
    expect(await cachedApi(run, '/r', 'e', options(60_000))).toEqual({ ok: true, body: '[1,2]' });
  });

  it('keeps entries per repository and endpoint in the state directory', async () => {
    const run = reply(response('200 OK', '', 'a'), response('200 OK', '', 'b'));
    await cachedApi(run, '/r1', 'e', options(0));
    await cachedApi(run, '/r2', 'e', options(1));
    expect(readdirSync(join(dir, 'gh-cache')).length).toBe(2);
  });

  it('works without a state directory', async () => {
    const run = reply(response('200 OK', '', 'a'), response('200 OK', '', 'b'));
    const none = { dir: undefined, ttlMs: 30_000, now: () => 0 };
    await cachedApi(run, '/r', 'e', none);
    expect(await cachedApi(run, '/r', 'e', none)).toEqual({ ok: true, body: 'b' });
  });

  it('ignores a corrupt cache file', async () => {
    const run = reply(response('200 OK', '', 'a'), response('200 OK', '', 'b'));
    await cachedApi(run, '/r', 'e', options(0));
    writeFileSync(join(dir, 'gh-cache', readdirSync(join(dir, 'gh-cache'))[0]!), '{broken');
    expect(await cachedApi(run, '/r', 'e', options(1))).toEqual({ ok: true, body: 'b' });
  });

  it('turns a 403 with an exhausted budget into a rate limit with the reset time', async () => {
    const run: RunFn = async () => ({
      ok: false,
      code: 1,
      stdout: response('403 Forbidden', 'X-Ratelimit-Remaining: 0\r\nX-Ratelimit-Reset: 1793545500', '{"message":"nope"}'),
      stderr: 'gh: HTTP 403',
    });
    expect(await cachedApi(run, '/r', 'e', options(0))).toEqual({
      ok: false,
      rateLimit: { resetAt: 1793545500, message: RESET },
    });
  });

  it('recognises a rate limit by text and leaves the reset open without headers', async () => {
    const run: RunFn = async () => ({ ok: false, code: 1, stderr: 'API rate limit exceeded for user' });
    expect(await cachedApi(run, '/r', 'e', options(0))).toEqual({
      ok: false,
      rateLimit: { resetAt: null, message: 'GitHub rate limit exceeded. Wait until it resets, then try again.' },
    });
  });

  it('passes other failures through', async () => {
    const run: RunFn = async () => ({ ok: false, code: 1, stdout: response('404 Not Found', '', '{}'), stderr: 'HTTP 404' });
    expect(await cachedApi(run, '/r', 'e', options(0))).toEqual({ ok: false, failure: { code: 1, stderr: 'HTTP 404' } });
    expect(await cachedApi(ok('garbage'), '/r', 'e2', options(0))).toEqual({
      ok: false,
      failure: { code: null, stderr: 'unreadable gh output' },
    });
  });
});

describe('cachedCommand', () => {
  it('caches the output for the TTL', async () => {
    let n = 0;
    const run: RunFn = async () => ({ ok: true, stdout: `out${++n}` });
    const at = (now: number) => ({ dir, ttlMs: 30_000, now: () => now });
    expect(await cachedCommand(run, 'gh', ['pr', 'list'], '/r', at(0))).toEqual({ ok: true, body: 'out1' });
    expect(await cachedCommand(run, 'gh', ['pr', 'list'], '/r', at(10_000))).toEqual({ ok: true, body: 'out1' });
    expect(await cachedCommand(run, 'gh', ['pr', 'list'], '/r', at(40_000))).toEqual({ ok: true, body: 'out2' });
  });

  it('asks the free rate_limit endpoint for the reset time of a rate limit', async () => {
    const run: RunFn = async (_c, args) =>
      args[0] === 'api'
        ? { ok: true, stdout: '{"resources":{"graphql":{"reset":1793545500}}}' }
        : { ok: false, code: 1, stderr: 'GraphQL: API rate limit exceeded' };
    expect(await cachedCommand(run, 'gh', ['pr', 'list'], '/r', { dir, ttlMs: 1 })).toEqual({
      ok: false,
      rateLimit: { resetAt: 1793545500, message: RESET },
    });
  });

  it('passes other failures through, and graphqlReset is null when unreadable', async () => {
    const run: RunFn = async () => ({ ok: false, code: 4, stderr: '' });
    expect(await cachedCommand(run, 'gh', ['x'], '/r', { dir, ttlMs: 1 })).toEqual({ ok: false, failure: { code: 4, stderr: '' } });
    expect(await graphqlReset(ok('nope'), '/r')).toBeNull();
    expect(await graphqlReset(run, '/r')).toBeNull();
  });
});
