import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(new URL('../herdr-plugin.toml', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

// The [[...]] tables of the manifest of one kind.
const tables = (kind: string): string[] => manifest.split(/^(?=\[\[)/m).filter((t) => t.startsWith(`[[${kind}]]`));

describe('worktree-cleanup manifest', () => {
  it('declares the top-level id, name, version, min_herdr_version and platforms', () => {
    expect(manifest).toMatch(/^id = "worktree-cleanup"$/m);
    expect(manifest).toMatch(/^name = "worktree-cleanup"$/m);
    expect(manifest).toMatch(/^version = "0\.1\.0"$/m);
    expect(manifest).toMatch(/^min_herdr_version = "0\.9\.5"$/m);
    expect(manifest).toMatch(/^platforms = \["macos", "linux"\]$/m);
  });

  it('declares the action cleanup run by Node', () => {
    const action = tables('actions').find((t) => t.includes('id = "cleanup"'));
    expect(action).toMatch(/^command = \["node", "bin\/cleanup\.ts"\]$/m);
  });

  it('declares the event hook on worktree.removed run by Node', () => {
    const hook = tables('events').find((t) => t.includes('on = "worktree.removed"'));
    expect(hook).toMatch(/^command = \["node", "bin\/removed\.ts"\]$/m);
  });

  it('documents the install command, the deliver skill and a keybinding for the cleanup action in the README', () => {
    expect(readme).toContain('herdr plugin install GravionLabs/herdr-plugins/worktree-cleanup');
    expect(readme).toContain('npx skills add GravionLabs/skills --skill deliver');
    expect(readme).toContain('command = "worktree-cleanup.cleanup"');
  });
});
