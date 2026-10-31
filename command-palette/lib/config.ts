// Own entries from HERDR_PLUGIN_CONFIG_DIR/config.json:
// `{ "commands": [{ "title": "show agent-log", "command": ["herdr", "pane", "split", "--current"], "cwd": "optional" }] }`.
// Pure parse; every problem is a message, valid entries are kept.
import type { Entry } from './entries.ts';

export type ParsedConfig = { entries: Entry[]; problems: string[] };

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function parseConfig(json: string | null | undefined): ParsedConfig {
  const result: ParsedConfig = { entries: [], problems: [] };
  if (json === null || json === undefined) return result;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    result.problems.push('invalid JSON');
    return result;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.problems.push('expected an object');
    return result;
  }
  const commands = (data as Record<string, unknown>).commands;
  if (commands === undefined) return result;
  if (!Array.isArray(commands)) {
    result.problems.push('commands must be an array');
    return result;
  }
  commands.forEach((item, i) => {
    const at = `commands[${i}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      result.problems.push(`${at} must be an object`);
      return;
    }
    const { title, command, cwd } = item as Record<string, unknown>;
    if (!nonEmpty(title)) {
      result.problems.push(`${at}: title must be a non-empty string`);
      return;
    }
    if (!Array.isArray(command) || command.length === 0 || !command.every(nonEmpty)) {
      result.problems.push(`${at}: command must be a non-empty array of non-empty strings`);
      return;
    }
    if (cwd !== undefined && !nonEmpty(cwd)) {
      result.problems.push(`${at}: cwd must be a non-empty string`);
      return;
    }
    const run: { kind: 'command'; command: string[]; cwd?: string } = { kind: 'command', command: [...command] };
    if (cwd !== undefined) run.cwd = cwd;
    result.entries.push({ id: `config.${i}`, group: 'config', title: title.trim(), run });
  });
  return result;
}

// One hint line for all problems; null without problems.
export function configHint(problems: string[]): string | null {
  if (problems.length === 0) return null;
  const more = problems.length > 1 ? ` (+${problems.length - 1} more)` : '';
  return `config.json: ${problems[0]}${more}`;
}
