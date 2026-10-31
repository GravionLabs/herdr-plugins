import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../lib/config.ts';
import { check, WINDOW_MS, type Seen } from '../lib/dedupe.ts';
import { statusEvent } from '../lib/event.ts';
import { quote } from '../lib/host.ts';
import { compose } from '../lib/message.ts';
import { handle, type Deps } from '../lib/notify.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const off = { systemNotification: false, sound: false };

describe('statusEvent', () => {
  it('accepts done in the socket envelope', () => {
    expect(statusEvent(fixture('done.json'))).toEqual({
      paneId: 'w1:p2', workspaceId: 'w1', state: 'done', agent: 'claude', displayAgent: 'Claude',
    });
  });
  it('accepts blocked in the bare payload', () => {
    expect(statusEvent(fixture('blocked.json'))?.state).toBe('blocked');
  });
  it('ignores working', () => {
    expect(statusEvent(fixture('working.json'))).toBeNull();
  });
  it.each([undefined, '', 'nope', '[]', '{}', '{"agent_status":"done"}'])('ignores malformed input %j', (input) => {
    expect(statusEvent(input)).toBeNull();
  });
});

describe('compose', () => {
  const done = statusEvent(fixture('done.json'))!;
  it('names a deliver pane by its tokens and the PR', () => {
    const facts = {
      workspace: 'Gravion', tab: 'deliver',
      tokens: { deliver: '12', deliver_step: 'review: 1 blocking', deliver_pr: '34' },
    };
    expect(compose(done, facts)).toEqual({
      title: 'deliver #12 review: 1 blocking (PR #34)', body: 'done · Gravion / deliver',
    });
  });
  it('omits the PR when it is not set', () => {
    const facts = { workspace: 'W', tab: 'T', tokens: { deliver: '#12', deliver_step: 'review: 1 blocking' } };
    expect(compose(done, facts).title).toBe('deliver #12 review: 1 blocking');
  });
  it('names other panes by the display agent, falling back to agent', () => {
    const facts = { workspace: 'Gravion', tab: 'planing', tokens: {} };
    expect(compose(done, facts)).toEqual({ title: 'Claude done', body: 'Gravion / planing' });
    expect(compose(statusEvent(fixture('blocked.json'))!, facts).title).toBe('codex blocked');
  });
});

describe('check', () => {
  it('suppresses the same pane and state within 30 s only', () => {
    const first = check({}, 'p', 'done', 1000);
    expect(first.notify).toBe(true);
    expect(check(first.seen, 'p', 'done', 1000 + WINDOW_MS - 1).notify).toBe(false);
    expect(check(first.seen, 'p', 'done', 1000 + WINDOW_MS).notify).toBe(true);
  });
  it('treats another pane or state as new', () => {
    const first = check({}, 'p', 'done', 1000);
    expect(check(first.seen, 'q', 'done', 1001).notify).toBe(true);
    expect(check(first.seen, 'p', 'blocked', 1001).notify).toBe(true);
  });
});

describe('handle', () => {
  function setup() {
    let seen: Seen = {};
    const shown: string[] = [];
    let time = 5000;
    const deps: Deps = {
      now: () => time,
      loadSeen: async () => seen,
      saveSeen: async (s) => { seen = s; },
      lookup: async () => ({ workspace: 'W', tab: 'T', tokens: {} }),
      show: async (m) => { shown.push(m.title); },
    };
    return { deps, shown, advance: (ms: number) => { time += ms; } };
  }
  it('notifies once for a repeated recorded event, again after 30 s', async () => {
    const { deps, shown, advance } = setup();
    expect(await handle(deps, off, fixture('done.json'))).toBe(true);
    expect(await handle(deps, off, fixture('done.json'))).toBe(false);
    advance(WINDOW_MS);
    expect(await handle(deps, off, fixture('done.json'))).toBe(true);
    expect(shown).toEqual(['Claude done', 'Claude done']);
  });
  it('does not notify for working', async () => {
    const { deps, shown } = setup();
    expect(await handle(deps, off, fixture('working.json'))).toBe(false);
    expect(shown).toEqual([]);
  });
});

describe('parseConfig', () => {
  it('is off by default and for broken files', () => {
    expect(parseConfig(undefined)).toEqual(off);
    expect(parseConfig('{bad')).toEqual(off);
    expect(parseConfig('{"sound":"yes"}')).toEqual(off);
  });
  it('switches both on', () => {
    expect(parseConfig('{"system_notification":true,"sound":true}')).toEqual({ systemNotification: true, sound: true });
  });
});

describe('quote', () => {
  it('escapes quotes and backslashes for AppleScript', () => {
    expect(quote('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe('agent-notify manifest', () => {
  const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  it('declares the event hook run by Node', () => {
    expect(manifest).toMatch(/^id = "agent-notify"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^on = "pane\.agent_status_changed"$/m);
    expect(manifest).toMatch(/^command = \["node", "bin\/changed\.ts"\]$/m);
  });
  it('documents install and config', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/agent-notify');
    expect(readme).toContain('system_notification');
    expect(readme).toContain('"sound"');
  });
});
