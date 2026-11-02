// HERDR_PLUGIN_CONFIG_DIR/config.json: `{ "roots": ["~/Source"], "depth": 3, "tabs": [{ "label", "command"?, "focus"? }] }`.
// Pure parse; an invalid field is a problem and falls back to its default, valid fields are kept.
import { isAbsolute, join } from 'node:path';
import configSchema from '../schema/config.schema.json' with { type: 'json' };
import { configProblems, type Schema } from './schema.ts';

// Schema violations of config.json (`schema/config.schema.json`) as messages naming file and key; none for a missing file.
export function configIssues(json: string | null | undefined): string[] {
  return configProblems(json, configSchema as unknown as Schema);
}

export type Tab = { label: string; command: string | null; focus: boolean };
export type Config = { roots: string[]; depth: number; tabs: Tab[] };
export type ParsedConfig = { config: Config; problems: string[] };

export const DEFAULT_ROOTS = ['~/Source'];
export const DEFAULT_DEPTH = 3;
export const MAX_DEPTH = 10;
export const DEFAULT_TABS: Tab[] = [
  { label: 'terminal', command: null, focus: false },
  { label: 'agent', command: 'claude', focus: true },
];

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

// `~` and `~/x` relative to `home`; other paths unchanged. Null for a relative path.
export function expandPath(path: string, home: string): string | null {
  const p = path.trim();
  if (p === '~') return home;
  if (p.startsWith('~/')) return join(home, p.slice(2));
  return isAbsolute(p) ? p : null;
}

function parseRoots(value: unknown, home: string, problems: string[]): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(nonEmpty)) {
    problems.push('roots must be a non-empty array of paths');
    return null;
  }
  const roots: string[] = [];
  for (const raw of value) {
    const root = expandPath(raw, home);
    if (root === null) {
      problems.push(`roots: "${raw}" must be absolute or start with ~/`);
      return null;
    }
    if (!roots.includes(root)) roots.push(root);
  }
  return roots;
}

function parseDepth(value: unknown, problems: string[]): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_DEPTH) return value;
  problems.push(`depth must be an integer from 1 to ${MAX_DEPTH}`);
  return null;
}

function parseTabs(value: unknown, problems: string[]): Tab[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push('tabs must be a non-empty array');
    return null;
  }
  const tabs: Tab[] = [];
  for (const [i, item] of value.entries()) {
    const at = `tabs[${i}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      problems.push(`${at} must be an object`);
      return null;
    }
    const { label, command, focus } = item as Record<string, unknown>;
    if (!nonEmpty(label)) {
      problems.push(`${at}: label must be a non-empty string`);
      return null;
    }
    if (tabs.some((tab) => tab.label === label.trim())) {
      problems.push(`${at}: duplicate label "${label.trim()}"`);
      return null;
    }
    if (command !== undefined && command !== null && typeof command !== 'string') {
      problems.push(`${at}: command must be a string`);
      return null;
    }
    if (focus !== undefined && typeof focus !== 'boolean') {
      problems.push(`${at}: focus must be true or false`);
      return null;
    }
    tabs.push({ label: label.trim(), command: nonEmpty(command) ? command.trim() : null, focus: focus === true });
  }
  return tabs;
}

export function parseConfig(json: string | null | undefined, home: string): ParsedConfig {
  const config: Config = { roots: DEFAULT_ROOTS.map((r) => expandPath(r, home)!), depth: DEFAULT_DEPTH, tabs: DEFAULT_TABS };
  const problems: string[] = [];
  if (json === null || json === undefined) return { config, problems };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { config, problems: ['invalid JSON'] };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { config, problems: ['expected an object'] };
  const record = data as Record<string, unknown>;
  if (record.roots !== undefined) config.roots = parseRoots(record.roots, home, problems) ?? config.roots;
  if (record.depth !== undefined) config.depth = parseDepth(record.depth, problems) ?? config.depth;
  if (record.tabs !== undefined) config.tabs = parseTabs(record.tabs, problems) ?? config.tabs;
  // The schema also catches what the field parsers ignore, such as an unknown key.
  if (problems.length === 0) problems.push(...configIssues(json).map((p) => p.replace(/^config\.json: /, '')));
  return { config, problems };
}

// The tab to focus after opening: the first one marked `focus`, else the first tab.
export const focusTab = (tabs: Tab[]): Tab => tabs.find((tab) => tab.focus) ?? tabs[0]!;

// One hint line for all problems; null without problems.
export function configHint(problems: string[]): string | null {
  if (problems.length === 0) return null;
  const more = problems.length > 1 ? ` (+${problems.length - 1} more)` : '';
  return `config.json: ${problems[0]}${more}`;
}
