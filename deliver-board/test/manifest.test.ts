import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

// The [[...]] table of the manifest that contains `id = "<id>"`.
function table(kind: string, id: string): string {
  const found = manifest.split(/^(?=\[\[)/m).find((t) => t.startsWith(`[[${kind}]]`) && t.includes(`id = "${id}"`));
  if (!found) throw new Error(`[[${kind}]] ${id} not found`);
  return found;
}

describe('deliver-board manifest', () => {
  it('declares the top-level id, name, version, min_herdr_version and platforms', () => {
    expect(manifest).toMatch(/^id = "deliver-board"$/m);
    expect(manifest).toMatch(/^name = "deliver-board"$/m);
    expect(manifest).toMatch(/^version = "\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?"$/m); // the release writes it (scripts/set-version.ts)
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^platforms = \["macos", "linux"\]$/m);
  });

  it('declares the pane board as a popup run by Node', () => {
    const pane = table('panes', 'board');
    expect(pane).toMatch(/^placement = "popup"$/m);
    expect(pane).toMatch(/^command = \["node", "bin\/board\.ts"\]$/m);
  });

  it('declares the action open run by Node', () => {
    expect(table('actions', 'open')).toMatch(/^command = \["node", "bin\/open\.ts"\]$/m);
  });

  it('documents the install command and a keybinding for the open action in the README', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/deliver-board');
    expect(readme).toContain('command = "deliver-board.open"');
    expect(readme).toContain('type = "plugin_action"');
  });
});
