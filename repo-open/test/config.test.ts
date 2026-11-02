import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configHint, DEFAULT_TABS, expandPath, focusTab, parseConfig } from '../lib/config.ts';

const home = join('/', 'home', 'me');
const parse = (value: unknown): ReturnType<typeof parseConfig> => parseConfig(JSON.stringify(value), home);

describe('expandPath', () => {
  it('expands ~ and ~/ relative to home and keeps absolute paths', () => {
    expect(expandPath('~', home)).toBe(home);
    expect(expandPath('~/Source', home)).toBe(join(home, 'Source'));
    expect(expandPath(join('/', 'srv', 'repos'), home)).toBe(join('/', 'srv', 'repos'));
  });

  it('rejects a relative path', () => {
    expect(expandPath('Source', home)).toBeNull();
  });
});

describe('parseConfig', () => {
  it('uses the defaults without a file', () => {
    expect(parseConfig(null, home)).toEqual({
      config: { roots: [join(home, 'Source')], depth: 3, tabs: DEFAULT_TABS },
      problems: [],
    });
  });

  it('defaults to a terminal tab and an agent tab running claude that gets the focus', () => {
    const { tabs } = parseConfig(null, home).config;
    expect(tabs.map((t) => t.label)).toEqual(['terminal', 'agent']);
    expect(focusTab(tabs)).toEqual({ label: 'agent', command: 'claude', focus: true });
  });

  it('reads roots, depth and tabs', () => {
    const parsed = parse({
      roots: ['~/Source', '~/Source', '~/work'],
      depth: 2,
      tabs: [{ label: ' shell ' }, { label: 'ai', command: ' codex ', focus: true }],
    });
    expect(parsed.problems).toEqual([]);
    expect(parsed.config).toEqual({
      roots: [join(home, 'Source'), join(home, 'work')],
      depth: 2,
      tabs: [
        { label: 'shell', command: null, focus: false },
        { label: 'ai', command: 'codex', focus: true },
      ],
    });
  });

  it('falls back per field and keeps the valid fields', () => {
    const parsed = parse({ roots: ['relative'], depth: 2, tabs: [] });
    expect(parsed.config.roots).toEqual([join(home, 'Source')]);
    expect(parsed.config.depth).toBe(2);
    expect(parsed.config.tabs).toEqual(DEFAULT_TABS);
    expect(parsed.problems).toEqual(['roots: "relative" must be absolute or start with ~/', 'tabs must be a non-empty array']);
  });

  it.each([
    [{ roots: [] }, 'roots must be a non-empty array of paths'],
    [{ roots: [''] }, 'roots must be a non-empty array of paths'],
    [{ depth: 0 }, 'depth must be an integer from 1 to 10'],
    [{ depth: 1.5 }, 'depth must be an integer from 1 to 10'],
    [{ depth: 11 }, 'depth must be an integer from 1 to 10'],
    [{ tabs: 'agent' }, 'tabs must be a non-empty array'],
    [{ tabs: ['agent'] }, 'tabs[0] must be an object'],
    [{ tabs: [{ command: 'claude' }] }, 'tabs[0]: label must be a non-empty string'],
    [{ tabs: [{ label: 'a' }, { label: 'a' }] }, 'tabs[1]: duplicate label "a"'],
    [{ tabs: [{ label: 'a', command: ['claude'] }] }, 'tabs[0]: command must be a string'],
    [{ tabs: [{ label: 'a', focus: 'yes' }] }, 'tabs[0]: focus must be true or false'],
  ])('reports %j', (value, problem) => {
    expect(parse(value).problems).toEqual([problem]);
  });

  it('reports invalid JSON and a non-object', () => {
    expect(parseConfig('{', home).problems).toEqual(['invalid JSON']);
    expect(parse([]).problems).toEqual(['expected an object']);
  });
});

describe('focusTab', () => {
  it('takes the first tab marked focus, else the first tab', () => {
    const a = { label: 'a', command: null, focus: false };
    const b = { label: 'b', command: null, focus: true };
    const c = { label: 'c', command: null, focus: true };
    expect(focusTab([a, b, c])).toBe(b);
    expect(focusTab([a])).toBe(a);
  });
});

describe('configHint', () => {
  it('shows the first problem and counts the rest', () => {
    expect(configHint([])).toBeNull();
    expect(configHint(['a'])).toBe('config.json: a');
    expect(configHint(['a', 'b', 'c'])).toBe('config.json: a (+2 more)');
  });
});
