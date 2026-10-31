import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

describe('layout-bootstrap manifest', () => {
  it('declares the plugin and the action apply run by Node', () => {
    expect(manifest).toMatch(/^id = "layout-bootstrap"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^id = "apply"$/m);
    expect(manifest).toMatch(/^command = \["node", "bin\/apply\.ts"\]$/m);
  });

  it('documents the install command, the layout file and a keybinding in the README', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/layout-bootstrap');
    expect(readme).toContain('.agents/herdr-layout.json');
    expect(readme).toContain('command = "layout-bootstrap.apply"');
  });
});
