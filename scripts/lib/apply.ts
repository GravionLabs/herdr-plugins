// The `apply` command of scripts/herdr-setup.ts: adds the config.toml blocks the plugins rely on.
// No TOML library: tables and keys are detected from the text, new tables are appended at the end, and a key
// or section the user already set is never changed (a different value becomes a hint). The one exception is
// `ui.toast.delivery = "off"`, which is the setting the plugins cannot work with.
import { stripComment } from './config.ts';
import type { Deps } from './doctor.ts';

export interface ApplyPlan {
  changes: string[];
  hints: string[];
  before: string;
  after: string;
}

// Default keybindings of herdr 0.9.5 (checked by test/keybindings.test.ts): never suggested.
export const HERDR_DEFAULT_KEYS = [
  'prefix+?', 'prefix+[', 'prefix+b', 'prefix+c', 'prefix+e', 'prefix+g', 'prefix+h', 'prefix+j', 'prefix+k', 'prefix+l', 'prefix+minus',
  'prefix+n', 'prefix+o', 'prefix+p', 'prefix+q', 'prefix+r', 'prefix+s', 'prefix+tab', 'prefix+v', 'prefix+w', 'prefix+x', 'prefix+z',
  'prefix+shift+d', 'prefix+shift+g', 'prefix+shift+h', 'prefix+shift+j', 'prefix+shift+k', 'prefix+shift+l', 'prefix+shift+n',
  'prefix+shift+p', 'prefix+shift+r', 'prefix+shift+t', 'prefix+shift+tab', 'prefix+shift+w', 'prefix+shift+x',
];

interface KeySuggestion {
  action: string;
  aliases: string[];
  description: string;
  candidates: string[];
}

export const KEY_SUGGESTIONS: KeySuggestion[] = [
  { action: 'deliver-starter.start', aliases: [], description: 'start /deliver', candidates: ['prefix+d', 'prefix+shift+s', 'prefix+i'] },
  { action: 'deliver-log.toggle', aliases: ['deliver-log.toggle-log'], description: 'toggle the deliver log pane', candidates: ['prefix+shift+o', 'prefix+shift+u', 'prefix+u'] },
  { action: 'command-palette.open', aliases: [], description: 'command palette', candidates: ['prefix+a', 'prefix+shift+m', 'prefix+m'] },
];

const SIDEBAR_ROWS = [
  '[ui.sidebar.agents]',
  'rows = [',
  '  ["state_icon", { token = "tab", bold = true }, { token = "state_text", rules = [{ equals = "done", fg = "#5f5" }, { equals = "blocked", fg = "#f55" }] }],',
  '  ["agent", "workspace"],',
  '  [{ token = "$deliver", bold = true }, { token = "$deliver_step", rules = [{ contains = "blocked", fg = "#f55" }, { contains = "merged", fg = "#5f5" }] }, "$deliver_pr"],',
  ']',
];

interface Header {
  name: string;
  array: boolean;
  line: number;
}
interface Entry {
  table: string;
  key: string;
  full: string;
  value: string;
  line: number;
}

const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, '');
const dotted = (s: string): string => s.split('.').map(unquote).join('.');

function bracketDelta(code: string): number {
  let quote = '';
  let d = 0;
  for (const c of code) {
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') d++;
    else if (c === ']' || c === '}') d--;
  }
  return d;
}

function scan(lines: string[]): { headers: Header[]; entries: Entry[] } {
  const headers: Header[] = [];
  const entries: Entry[] = [];
  let table = '';
  let depth = 0;
  lines.forEach((raw, line) => {
    const code = stripComment(raw).trim();
    if (depth > 0) {
      depth = Math.max(0, depth + bracketDelta(code));
      return;
    }
    const arr = /^\[\[([^\[\]]+)\]\]$/.exec(code);
    const tab = arr ? null : /^\[([^\[\]]+)\]$/.exec(code);
    if (arr || tab) {
      table = dotted((arr ?? tab)![1]!);
      headers.push({ name: table, array: !!arr, line });
      return;
    }
    const kv = /^([A-Za-z0-9_.\- "']+?)\s*=\s*(.*)$/.exec(code);
    if (!kv) return;
    const key = dotted(kv[1]!);
    entries.push({ table, key, full: [table, key].filter(Boolean).join('.'), value: unquote(kv[2]!), line });
    depth = Math.max(0, bracketDelta(kv[2]!));
  });
  return { headers, entries };
}

interface Edit {
  line: number;
  remove: number;
  insert: string[];
}

export function planApply(text: string): ApplyPlan {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
  const { headers, entries } = scan(lines);
  const changes: string[] = [];
  const hints: string[] = [];
  const edits: Edit[] = [];
  const appended: string[][] = [];

  // [ui.toast] delivery
  const delivery = entries.find((e) => e.full === 'ui.toast.delivery');
  const toastHeader = headers.find((h) => h.name === 'ui.toast' && !h.array);
  if (delivery) {
    if (delivery.value === 'off') {
      const raw = lines[delivery.line]!;
      const code = stripComment(raw);
      const comment = raw.slice(code.length);
      const eq = code.indexOf('=') + 1;
      edits.push({ line: delivery.line, remove: 1, insert: [`${code.slice(0, eq)} "herdr"${comment ? ` ${comment}` : ''}`] });
      changes.push('set ui.toast.delivery to "herdr" (was "off")');
    }
  } else if (toastHeader) {
    edits.push({ line: toastHeader.line + 1, remove: 0, insert: ['delivery = "herdr"'] });
    changes.push('add delivery = "herdr" to [ui.toast]');
  } else if (entries.some((e) => e.full.startsWith('ui.toast'))) {
    hints.push('ui.toast is defined in a form this script does not edit: set ui.toast.delivery to "herdr" by hand');
  } else {
    appended.push(['[ui.toast]', 'delivery = "herdr"']);
    changes.push('add [ui.toast] delivery = "herdr"');
  }

  // [ui.sidebar.agents] rows
  const rows = entries.find((e) => e.full === 'ui.sidebar.agents.rows');
  const sidebarHeader = headers.find((h) => h.name === 'ui.sidebar.agents' && !h.array);
  if (rows) {
    const next = Math.min(entries.find((e) => e.line > rows.line)?.line ?? lines.length, headers.find((h) => h.line > rows.line)?.line ?? lines.length);
    if (!/\$deliver/.test(lines.slice(rows.line, next).join('\n')))
      hints.push('ui.sidebar.agents rows are already set and name no $deliver token: not changed, see the "repo first" layout in the README');
  } else if (sidebarHeader) {
    edits.push({ line: sidebarHeader.line + 1, remove: 0, insert: SIDEBAR_ROWS.slice(1) });
    changes.push('add the "repo first" rows to [ui.sidebar.agents]');
  } else if (entries.some((e) => e.full.startsWith('ui.sidebar.agents'))) {
    hints.push('ui.sidebar.agents is defined in a form this script does not edit: add the "repo first" rows by hand');
  } else {
    appended.push(SIDEBAR_ROWS);
    changes.push('add [ui.sidebar.agents] with the "repo first" rows');
  }

  // [[keys.command]] entries
  const bound = new Set<string>();
  const used = new Set(HERDR_DEFAULT_KEYS);
  for (const e of entries) {
    if (e.table === 'keys.command' && e.key === 'command') bound.add(e.value);
    if ((e.table === 'keys.command' && e.key === 'key') || e.table === 'keys') used.add(e.value.toLowerCase());
  }
  for (const s of KEY_SUGGESTIONS) {
    if ([s.action, ...s.aliases].some((a) => bound.has(a))) continue;
    const key = s.candidates.find((c) => !used.has(c));
    if (!key) {
      hints.push(`no free key for ${s.action} (tried ${s.candidates.join(', ')}): bind it by hand`);
      continue;
    }
    used.add(key);
    appended.push(['[[keys.command]]', `key = "${key}"`, 'type = "plugin_action"', `command = "${s.action}"`, `description = "${s.description}"`]);
    changes.push(`bind ${key} to ${s.action}`);
  }

  if (changes.length === 0) return { changes, hints, before: text, after: text };
  for (const e of [...edits].sort((a, b) => b.line - a.line)) lines.splice(e.line, e.remove, ...e.insert);
  for (const block of appended) {
    if (lines.length > 0) lines.push('');
    lines.push(...block);
  }
  return { changes, hints, before: text, after: lines.join(eol) + eol };
}

// A line diff with 2 lines of context. Common head and tail are trimmed first, so the table stays small.
export function unifiedDiff(before: string, after: string, label: string): string {
  const split = (s: string): string[] => {
    const l = s === '' ? [] : s.split(/\r?\n/);
    if (l[l.length - 1] === '') l.pop();
    return l;
  };
  const a = split(before);
  const b = split(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const ma = a.slice(head, a.length - tail);
  const mb = b.slice(head, b.length - tail);
  const lcs: number[][] = Array.from({ length: ma.length + 1 }, () => new Array<number>(mb.length + 1).fill(0));
  for (let i = ma.length - 1; i >= 0; i--)
    for (let j = mb.length - 1; j >= 0; j--) lcs[i]![j] = ma[i] === mb[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const ops: { t: ' ' | '-' | '+'; s: string }[] = a.slice(0, head).map((s) => ({ t: ' ' as const, s }));
  let i = 0;
  let j = 0;
  while (i < ma.length || j < mb.length) {
    if (i < ma.length && j < mb.length && ma[i] === mb[j]) {
      ops.push({ t: ' ', s: ma[i]! });
      i++;
      j++;
    } else if (j < mb.length && (i === ma.length || lcs[i]![j + 1]! > lcs[i + 1]![j]!)) ops.push({ t: '+', s: mb[j++]! });
    else ops.push({ t: '-', s: ma[i++]! });
  }
  ops.push(...a.slice(a.length - tail).map((s) => ({ t: ' ' as const, s })));

  const keep = new Set<number>();
  ops.forEach((o, k) => {
    if (o.t !== ' ') for (let c = Math.max(0, k - 2); c <= Math.min(ops.length - 1, k + 2); c++) keep.add(c);
  });
  const out = [`--- ${label}`, `+++ ${label} (after apply)`];
  let k = 0;
  while (k < ops.length) {
    if (!keep.has(k)) {
      k++;
      continue;
    }
    const start = k;
    while (k < ops.length && keep.has(k)) k++;
    const hunk = ops.slice(start, k);
    const oldStart = ops.slice(0, start).filter((o) => o.t !== '+').length + 1;
    const newStart = ops.slice(0, start).filter((o) => o.t !== '-').length + 1;
    out.push(`@@ -${oldStart},${hunk.filter((o) => o.t !== '+').length} +${newStart},${hunk.filter((o) => o.t !== '-').length} @@`);
    out.push(...hunk.map((o) => o.t + o.s));
  }
  return out.join('\n');
}

const pad = (n: number): string => String(n).padStart(2, '0');
// The timestamp has no colon, so the name is valid on Windows.
export function backupName(path: string, now: Date): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${path}.bak-${stamp}`;
}

export interface ApplyIo {
  writeFile: (path: string, content: string) => void;
  confirm: (question: string) => boolean;
  now: () => Date;
}

export interface ApplyOptions {
  yes: boolean;
  dryRun: boolean;
}

// Returns the exit code; 1 when the write or the reload failed.
export function runApply(deps: Deps & ApplyIo, configPath: string, opts: ApplyOptions, out: (text: string) => void): number {
  const existing = deps.readFile(configPath);
  const plan = planApply(existing ?? '');
  const hints = plan.hints.map((h) => `hint: ${h}`);
  if (plan.changes.length === 0) {
    out([`nothing to do: ${configPath} already has what the plugins rely on`, ...hints].join('\n'));
    return 0;
  }
  out([`${opts.dryRun ? 'would change' : 'changes'} in ${configPath}:`, ...plan.changes.map((c) => `  - ${c}`), ...hints, '', unifiedDiff(plan.before, plan.after, configPath)].join('\n'));
  if (opts.dryRun) return 0;
  if (!opts.yes && !deps.confirm('Write these changes? [y/N] ')) {
    out('aborted: nothing written');
    return 0;
  }
  try {
    if (existing !== null) {
      const backup = backupName(configPath, deps.now());
      deps.writeFile(backup, existing);
      out(`backup: ${backup}`);
    }
    deps.writeFile(configPath, plan.after);
    out(`written: ${configPath}`);
  } catch (e) {
    out(`failed to write: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  const reload = deps.run('herdr', ['server', 'reload-config']);
  const diag = reload.stdout.trim();
  out(reload.ok ? `herdr server reload-config: ok${diag ? `\n${diag}` : ''}` : `herdr server reload-config failed${diag ? `:\n${diag}` : ''}\nhint: start herdr, then run \`herdr server reload-config\``);
  return reload.ok ? 0 : 1;
}
