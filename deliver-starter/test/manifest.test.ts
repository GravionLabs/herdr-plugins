import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIssueUrl } from '../lib/link.ts';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

describe('deliver-starter manifest', () => {
  it('declares id, name, version, min_herdr_version and platforms', () => {
    expect(manifest).toMatch(/^id = "deliver-starter"$/m);
    expect(manifest).toMatch(/^name = "deliver-starter"$/m);
    expect(manifest).toMatch(/^version = "0\.1\.0"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^platforms = \["macos", "linux"\]$/m);
  });

  it('declares the actions, the popup pane and the link handler', () => {
    expect(manifest).toMatch(/^id = "start"$/m);
    expect(manifest).toMatch(/^command = \["node", "bin\/start\.ts"\]$/m);
    expect(manifest).toMatch(/^id = "start-link"$/m);
    expect(manifest).toMatch(/^command = \["node", "bin\/start-link\.ts"\]$/m);
    expect(manifest).toMatch(/^placement = "popup"$/m);
    expect(manifest).toMatch(/^action = "start-link"$/m);
  });

  it('link handler pattern matches issue URLs only', () => {
    const toml = /^pattern = "(.*)"$/m.exec(manifest)?.[1] ?? '';
    const pattern = new RegExp(JSON.parse(`"${toml}"`));
    const url = 'https://github.com/GravionLabs/herdr-plugins/issues/3';
    expect(pattern.test(url)).toBe(true);
    expect(parseIssueUrl(url)).not.toBeNull();
    expect(pattern.test('https://github.com/a/b/pull/3')).toBe(false);
    expect(pattern.test(`${url}/`)).toBe(false);
  });

  it('documents install, config keys, keybinding and the worktree in the README', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/deliver-starter');
    expect(readme).toContain('npx skills add GravionLabs/skills --skill deliver');
    expect(readme).toContain('type = "plugin_action"');
    expect(readme).toContain('command = "deliver-starter.start"');
    expect(readme).toContain('"harness"');
    expect(readme).toContain('"mode"');
    expect(readme).toContain('herdr worktree remove');
    expect(readme).toContain('worktree-cleanup');
  });
});
