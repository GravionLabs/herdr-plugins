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

describe('README keybinding targets', () => {
  const declaredActions = (plugin: string): string[] =>
    [...readFileSync(new URL(`${plugin}/herdr-plugin.toml`, root), 'utf8').matchAll(/^\[\[actions\]\]\nid = "([^"]+)"$/gm)].map(
      (m) => m[1],
    );
  const targets = (path: string): string[] =>
    [...readFileSync(new URL(path, root), 'utf8').matchAll(/^command = "([a-z-]+)\.([a-z-]+)"$/gm)].map((m) => `${m[1]}.${m[2]}`);

  it.each(pluginReadmes())('%s binds only actions its manifest declares', (path) => {
    const missing = targets(path).filter((target) => {
      const [plugin, action] = target.split('.');
      return !declaredActions(plugin).includes(action);
    });
    expect(missing).toEqual([]);
  });

  it('uses the renamed deliver-log action, not its deprecated alias', () => {
    expect(targets('deliver-log/README.md')).toEqual(['deliver-log.toggle']);
  });
});

describe('invocation syntax', () => {
  const docFiles = (): string[] => [
    ...pluginReadmes(),
    ...(readdirSync(new URL('docs/', root), { recursive: true }) as string[])
      .filter((name) => name.endsWith('.md'))
      .map((name) => `docs/${name}`),
  ];

  it('invokes an action as <plugin>.<action>, never with two positionals', () => {
    const bad = docFiles().flatMap((path) =>
      [...readFileSync(new URL(path, root), 'utf8').matchAll(/plugin action invoke ([^\s`]+) ([^\s`]+)/g)]
        .filter((m) => !m[2].startsWith('-'))
        .map((m) => `${path}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });
});

describe('keybindings page snippet', () => {
  const page = readFileSync(new URL('docs/guide/keybindings.md', root), 'utf8');
  const snippet = [...page.matchAll(/^```toml\n([\s\S]*?)^```$/gm)].map((m) => m[1]);
  const blocks = [...snippet.join('\n').matchAll(/\[\[keys\.command\]\]\n((?:(?!\[\[)[^\n]*\n?)*)/g)].map((m) => m[1]);
  const field = (block: string, name: string): string | undefined => block.match(new RegExp(`^${name} = "([^"]+)"$`, 'm'))?.[1];
  const declared = (plugin: string): string[] =>
    [...readFileSync(new URL(`${plugin}/herdr-plugin.toml`, root), 'utf8').matchAll(/^\[\[actions\]\]\nid = "([^"]+)"$/gm)].map(
      (m) => m[1],
    );

  it('has exactly one toml block with a binding for every plugin that has an action recommended in a README', () => {
    expect(snippet).toHaveLength(1);
    const readmeTargets = pluginReadmes().flatMap((path) =>
      [...readFileSync(new URL(path, root), 'utf8').matchAll(/^command = "([a-z-]+\.[a-z-]+)"$/gm)].map((m) => m[1]),
    );
    const pageTargets = blocks.map((b) => field(b, 'command'));
    expect(pageTargets.sort()).toEqual([...readmeTargets].sort());
  });

  it('binds only actions the plugin manifest declares', () => {
    const missing = blocks
      .map((b) => field(b, 'command') ?? '')
      .filter((target) => {
        const [plugin, action] = target.split('.');
        return !declared(plugin).includes(action);
      });
    expect(missing).toEqual([]);
  });

  it('binds no key twice and no herdr default key', () => {
    const keys = blocks.map((b) => field(b, 'key') ?? '');
    expect(keys.every((k) => k.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k in HERDR_DEFAULT_KEYS)).toEqual([]);
  });

  it('uses the plugin_action type in every binding', () => {
    expect(blocks.map((b) => field(b, 'type'))).toEqual(blocks.map(() => 'plugin_action'));
  });
});
