// Reads values from the text of herdr's config.toml. No TOML dependency: only the shapes the doctor needs
// (`[table]` headers, `key = value` lines, dotted keys, the raw text of a table).
import { join } from 'node:path';

// The default config location per OS. Isolated on purpose: the Windows location is verified in #83 and may change here only.
export function defaultConfigPath(platform: string, env: Record<string, string | undefined>, home: string): string {
  if (env.HERDR_CONFIG_PATH) return env.HERDR_CONFIG_PATH;
  if (platform === 'win32') return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'herdr', 'config.toml');
  return join(home, '.config', 'herdr', 'config.toml');
}

function stripComment(line: string): string {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#') return line.slice(0, i);
  }
  return line;
}

// Value of a dotted key such as `ui.toast.delivery` (as a `[ui.toast]` key or a dotted key under `[ui]`), unquoted; null when absent.
export function readValue(text: string, dottedKey: string): string | null {
  let table = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw).trim();
    const header = /^\[([^\[\]]+)\]$/.exec(line);
    if (header) {
      table = header[1]!.split('.').map((p) => p.trim().replace(/^["']|["']$/g, '')).join('.');
      continue;
    }
    const kv = /^([A-Za-z0-9_.\- "']+?)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = [table, kv[1]!.split('.').map((p) => p.trim().replace(/^["']|["']$/g, '')).join('.')].filter(Boolean).join('.');
    if (key === dottedKey) return kv[2]!.trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

// The raw text of a table (header excluded) up to the next table that is not one of its sub-tables' arrays; null when absent.
// A `[ui.sidebar.agents]` body is the `rows` array, which may span several lines.
export function readTable(text: string, name: string): string | null {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inside = false;
  let found = false;
  let depth = 0;
  for (const raw of lines) {
    const line = stripComment(raw).trim();
    const header = depth === 0 ? /^\[([^\[\]]+)\]$/.exec(line) : null;
    if (header) {
      inside = header[1]!.split('.').map((p) => p.trim()).join('.') === name;
      found ||= inside;
      continue;
    }
    if (!inside) continue;
    out.push(line);
    for (const c of line) depth += c === '[' ? 1 : c === ']' ? -1 : 0;
    if (depth < 0) depth = 0;
  }
  return found ? out.join('\n') : null;
}
