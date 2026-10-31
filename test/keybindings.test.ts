import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

// Default keybindings of herdr 0.9.5 (docs/next/website/src/data/config-reference.json, keys.*).
// A plugin README must not recommend one of them: the built-in action shadows the plugin action.
const HERDR_DEFAULT_KEYS: Record<string, string> = {
  'prefix+?': 'help',
  'prefix+[': 'copy_mode',
  'prefix+b': 'toggle_sidebar',
  'prefix+c': 'new_tab',
  'prefix+e': 'edit_scrollback',
  'prefix+g': 'goto',
  'prefix+h': 'focus_pane_left',
  'prefix+j': 'focus_pane_down',
  'prefix+k': 'focus_pane_up',
  'prefix+l': 'focus_pane_right',
  'prefix+minus': 'split_horizontal',
  'prefix+n': 'next_tab',
  'prefix+o': 'open_notification_target',
  'prefix+p': 'previous_tab',
  'prefix+q': 'detach',
  'prefix+r': 'resize_mode',
  'prefix+s': 'settings',
  'prefix+tab': 'cycle_pane_next',
  'prefix+v': 'split_vertical',
  'prefix+w': 'workspace_picker',
  'prefix+x': 'close_pane',
  'prefix+z': 'zoom',
  'prefix+shift+d': 'close_workspace',
  'prefix+shift+g': 'new_worktree',
  'prefix+shift+h': 'swap_pane_left',
  'prefix+shift+j': 'swap_pane_down',
  'prefix+shift+k': 'swap_pane_up',
  'prefix+shift+l': 'swap_pane_right',
  'prefix+shift+n': 'new_workspace',
  'prefix+shift+p': 'rename_pane',
  'prefix+shift+r': 'reload_config',
  'prefix+shift+t': 'rename_tab',
  'prefix+shift+tab': 'cycle_pane_previous',
  'prefix+shift+w': 'rename_workspace',
  'prefix+shift+x': 'close_tab',
};

const pluginReadmes = (): string[] =>
  readdirSync(root)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .filter((name) => statSync(new URL(name, root)).isDirectory())
    .map((name) => `${name}/README.md`)
    .filter((path) => {
      try {
        return statSync(new URL(path, root)).isFile();
      } catch {
        return false;
      }
    });

const recommendedKeys = (path: string): string[] =>
  [...readFileSync(new URL(path, root), 'utf8').matchAll(/^key = "([^"]+)"$/gm)].map((m) => m[1]);

describe('README keybindings', () => {
  it('finds the plugin READMEs with a keybinding', () => {
    expect(pluginReadmes().filter((p) => recommendedKeys(p).length > 0).length).toBeGreaterThan(3);
  });

  it.each(pluginReadmes())('%s recommends no key herdr binds by default', (path) => {
    const collisions = recommendedKeys(path)
      .filter((key) => key in HERDR_DEFAULT_KEYS)
      .map((key) => `${key} → ${HERDR_DEFAULT_KEYS[key]}`);
    expect(collisions).toEqual([]);
  });

  it('recommends a different key in every README', () => {
    const keys = pluginReadmes().flatMap(recommendedKeys);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
