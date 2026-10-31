import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deliverView } from '../lib/view.ts';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const binDir = new URL('../bin/', import.meta.url).pathname;

type Request = { id: string; method: string; params: Record<string, unknown> };

let dir: string;
let server: Server;
let requests: Request[];
let reply: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dv-'));
  requests = [];
  reply = '{"id":"deliver-view","result":{"type":"agent_view","active":true}}';
  server = createServer((socket) => {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      requests.push(JSON.parse(chunk.trim()) as Request);
      socket.write(`${reply}\n`);
    });
  });
  await new Promise<void>((resolve) => server.listen(join(dir, 's.sock'), resolve));
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

// Mock HERDR_BIN_PATH: appends its arguments to calls.log.
function mockHerdr(): string {
  const path = join(dir, 'herdr');
  writeFileSync(path, `#!/bin/sh\necho "$@" >> "${join(dir, 'calls.log')}"\n`);
  chmodSync(path, 0o755);
  return path;
}

function run(script: 'apply' | 'startup', env: Record<string, string> = {}): Promise<{ code: number }> {
  const full = {
    PATH: process.env.PATH ?? '',
    HERDR_SOCKET_PATH: join(dir, 's.sock'),
    HERDR_PLUGIN_STATE_DIR: join(dir, 'state'),
    HERDR_PLUGIN_ID: 'deliver-view',
    HERDR_BIN_PATH: mockHerdr(),
    ...env,
  };
  return new Promise((resolve) => {
    execFile('node', [`${binDir}${script}.ts`], { env: full }, (error) => {
      resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0 });
    });
  });
}

async function notified(): Promise<string> {
  // The failure notification runs detached; give the mock a moment to write.
  for (let i = 0; i < 50; i++) {
    if (existsSync(join(dir, 'calls.log'))) return readFileSync(join(dir, 'calls.log'), 'utf8');
    await new Promise((r) => setTimeout(r, 20));
  }
  return '';
}

describe('deliverView', () => {
  it('names the view "deliver" owned by the plugin and lists all agents', () => {
    const view = deliverView('deliver-view');
    expect(view.source).toBe('plugin:deliver-view');
    expect(view.label).toBe('deliver');
    expect(view.filter).toBeNull();
  });

  it('puts blocked first, then agents with the deliver token, then the newest state change', () => {
    expect(deliverView('deliver-view').sort).toEqual([
      { field: 'attention', order: 'desc' },
      { field: { token: 'deliver' }, order: 'asc' },
      { field: 'state_change_seq', order: 'desc' },
    ]);
  });
});

describe('action apply', () => {
  it('sets the view over agent.view.set and saves it in the state dir', async () => {
    const { code } = await run('apply');
    expect(code).toBe(0);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('agent.view.set');
    expect(requests[0]?.params).toEqual(deliverView('deliver-view'));
    expect(JSON.parse(readFileSync(join(dir, 'state', 'view.json'), 'utf8'))).toEqual(deliverView('deliver-view'));
  });

  it('fails and notifies through HERDR_BIN_PATH when herdr rejects the view', async () => {
    reply = '{"id":"deliver-view","error":{"code":"invalid_params","message":"bad view"}}';
    const { code } = await run('apply');
    expect(code).toBe(1);
    expect(await notified()).toBe('notification show deliver-view failed --body bad view\n');
  });

  it('fails and notifies when the socket is not set', async () => {
    const { code } = await run('apply', { HERDR_SOCKET_PATH: '' });
    expect(code).toBe(1);
    expect(requests).toHaveLength(0);
    expect(await notified()).toContain('HERDR_SOCKET_PATH is not set');
  });
});

describe('startup hook', () => {
  it('reapplies the view saved in the state dir', async () => {
    await run('apply');
    requests.length = 0;
    const { code } = await run('startup');
    expect(code).toBe(0);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('agent.view.set');
    expect(requests[0]?.params).toEqual(deliverView('deliver-view'));
  });

  it('reapplies an edited saved view as stored', async () => {
    await run('apply');
    const saved = { ...deliverView('deliver-view'), label: 'mine', sort: [{ field: 'status', order: 'asc' }] };
    writeFileSync(join(dir, 'state', 'view.json'), JSON.stringify(saved));
    requests.length = 0;
    await run('startup');
    expect(requests[0]?.params).toEqual(saved);
  });

  it('falls back to the default view when nothing was saved', async () => {
    const { code } = await run('startup');
    expect(code).toBe(0);
    expect(requests[0]?.params).toEqual(deliverView('deliver-view'));
  });

  it('falls back to the default view when the saved file is not a view', async () => {
    await run('apply');
    writeFileSync(join(dir, 'state', 'view.json'), '{ not json');
    requests.length = 0;
    await run('startup');
    expect(requests[0]?.params).toEqual(deliverView('deliver-view'));
  });

  it('does not write the state dir', async () => {
    await run('startup');
    expect(existsSync(join(dir, 'state', 'view.json'))).toBe(false);
  });
});

describe('manifest', () => {
  it('declares the plugin and its minimum herdr version', () => {
    expect(manifest).toMatch(/^id = "deliver-view"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
  });

  it('declares a startup hook and the apply action as Node entry points', () => {
    expect(manifest).toMatch(/\[\[startup\]\]\ncommand = \["node", "bin\/startup\.ts"\]/);
    expect(manifest).toMatch(/id = "apply"\ntitle = "[^"]+"\ncommand = \["node", "bin\/apply\.ts"\]/);
  });
});
