import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const rootReadme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

function table(kind: string, id: string): string {
  const found = manifest.split(/^(?=\[\[)/m).find((t) => t.startsWith(`[[${kind}]]`) && t.includes(`id = "${id}"`));
  if (!found) throw new Error(`[[${kind}]] ${id} not found`);
  return found;
}

describe('command-palette manifest', () => {
  it('declares the top-level id, min_herdr_version and platforms', () => {
    expect(manifest).toMatch(/^id = "command-palette"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^platforms = \["macos", "linux"\]$/m);
  });

  it('declares the pane palette as a 60% x 50% popup run by Node', () => {
    const pane = table('panes', 'palette');
    expect(pane).toMatch(/^placement = "popup"$/m);
    expect(pane).toMatch(/^width = "60%"$/m);
    expect(pane).toMatch(/^height = "50%"$/m);
    expect(pane).toMatch(/^command = \["node", "bin\/palette\.ts"\]$/m);
  });

  it('declares the action open run by Node', () => {
    expect(table('actions', 'open')).toMatch(/^command = \["node", "bin\/open\.ts"\]$/m);
  });

  it('documents install command and keybinding in the README', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/command-palette');
    expect(readme).toContain('type = "plugin_action"');
    expect(readme).toContain('command = "command-palette.open"');
    expect(readme).toContain('key = "prefix+p"');
  });

  it('is listed in the repository README', () => {
    expect(rootReadme).toMatch(/^\| `command-palette` \|/m);
  });
});
