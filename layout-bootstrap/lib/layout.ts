// Layout model and resolution. Pure: the caller reads the files and passes their text.

export type Direction = 'right' | 'down';

export type PaneSpec = {
  name: string;
  command: string | null;
  // The first pane has no split: it is the focused pane. Every other pane splits an earlier pane.
  split: { from: string; direction: Direction; ratio: number } | null;
};

export type Layout = { panes: PaneSpec[] };

export type Source = 'repository' | 'config' | 'default';

export const REPO_LAYOUT_FILE = '.agents/herdr-layout.json';
export const CONFIG_LAYOUT_FILE = 'layout.json';
export const CONFIG_FILE = 'config.json';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The built-in layout: agent left (60 %), test watcher right top, shell right bottom.
// `ratio` is the share the split pane keeps; the new pane gets the rest.
export function defaultLayout(testCommand: string | null): Layout {
  return {
    panes: [
      { name: 'agent', command: null, split: null },
      { name: 'tests', command: testCommand, split: { from: 'agent', direction: 'right', ratio: 0.6 } },
      { name: 'shell', command: null, split: { from: 'tests', direction: 'down', ratio: 0.5 } },
    ],
  };
}

// `testCommand` of config.json in the plugin config dir; null when absent or invalid.
export function testCommandFromConfig(configJson: string | null): string | null {
  if (configJson === null) return null;
  try {
    const config: unknown = JSON.parse(configJson);
    const value = isObject(config) ? config.testCommand : null;
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  } catch {
    return null;
  }
}

// Validates a layout file; throws an Error naming the problem.
export function parseLayout(json: string): Layout {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('invalid JSON');
  }
  if (!isObject(data) || !Array.isArray(data.panes) || data.panes.length === 0) {
    throw new Error('"panes" must be a non-empty list');
  }
  const panes: PaneSpec[] = [];
  const names = new Set<string>();
  data.panes.forEach((raw: unknown, index: number) => {
    if (!isObject(raw)) throw new Error(`pane ${index + 1}: expected an object`);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (name === '') throw new Error(`pane ${index + 1}: "name" is required`);
    if (names.has(name)) throw new Error(`pane "${name}": duplicate name`);
    if (raw.command !== undefined && raw.command !== null && typeof raw.command !== 'string') {
      throw new Error(`pane "${name}": "command" must be a string`);
    }
    const command = typeof raw.command === 'string' && raw.command.trim() !== '' ? raw.command.trim() : null;
    let split: PaneSpec['split'] = null;
    if (index > 0) {
      const s = isObject(raw.split) ? raw.split : null;
      if (!s) throw new Error(`pane "${name}": "split" is required`);
      const from = typeof s.from === 'string' ? s.from : panes[index - 1]!.name;
      if (!names.has(from)) throw new Error(`pane "${name}": split.from "${from}" is not an earlier pane`);
      if (s.direction !== 'right' && s.direction !== 'down') {
        throw new Error(`pane "${name}": split.direction must be "right" or "down"`);
      }
      const ratio = s.ratio === undefined ? 0.5 : s.ratio;
      if (typeof ratio !== 'number' || !(ratio > 0 && ratio < 1)) {
        throw new Error(`pane "${name}": split.ratio must be between 0 and 1`);
      }
      split = { from, direction: s.direction, ratio };
    } else if (raw.split !== undefined && raw.split !== null) {
      throw new Error(`pane "${name}": the first pane must not have "split"`);
    }
    names.add(name);
    panes.push({ name, command, split });
  });
  return { panes };
}

export type Inputs = {
  repoLayout: string | null; // text of <repo>/.agents/herdr-layout.json
  configLayout: string | null; // text of <config dir>/layout.json
  config: string | null; // text of <config dir>/config.json
};

// Repository layout, else config-dir layout, else the default. An invalid file is an error, not a fallback.
export function resolveLayout(inputs: Inputs): { layout: Layout; source: Source } {
  const candidates: [Source, string | null, string][] = [
    ['repository', inputs.repoLayout, REPO_LAYOUT_FILE],
    ['config', inputs.configLayout, CONFIG_LAYOUT_FILE],
  ];
  for (const [source, text, file] of candidates) {
    if (text === null) continue;
    try {
      return { layout: parseLayout(text), source };
    } catch (error) {
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { layout: defaultLayout(testCommandFromConfig(inputs.config)), source: 'default' };
}
