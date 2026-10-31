import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

describe('deliver-log manifest', () => {
  it('declares id, name, version, min_herdr_version and platforms', () => {
    expect(manifest).toMatch(/^id = "deliver-log"$/m);
    expect(manifest).toMatch(/^name = "deliver-log"$/m);
    expect(manifest).toMatch(/^version = "0\.1\.0"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^platforms = \["macos", "linux"\]$/m);
  });

  it('declares the action toggle-log run by Node', () => {
    expect(manifest).toMatch(/^id = "toggle-log"$/m);
    expect(manifest).toMatch(/^command = \["node", "bin\/toggle-log\.ts"\]$/m);
  });

  it('documents install, deliver skill and a plugin_action keybinding in the README', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/deliver-log');
    expect(readme).toContain('npx skills add GravionLabs/skills --skill deliver');
    expect(readme).toContain('type = "plugin_action"');
    expect(readme).toContain('command = "deliver-log.toggle-log"');
  });
});
