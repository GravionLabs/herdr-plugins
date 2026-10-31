// Arguments of `/deliver` as typed into the popup: one or more issue numbers, or `--milestone <name>`. Pure.

export type Target = { numbers: number[]; milestone: null } | { numbers: []; milestone: string };
export type Parsed = { ok: true; target: Target } | { ok: false; reason: string };

// Accepts `3`, `3 4 5`, `#3`, `--milestone 0.3.0`, `--milestone "my release"`. Empty input has the reason `empty`.
export function parseArgs(input: string): Parsed {
  const tokens = tokenize(input.trim());
  if (tokens === null) return { ok: false, reason: 'Unbalanced quote' };
  if (tokens.length === 0) return { ok: false, reason: 'empty' };
  if (tokens[0] === '--milestone') {
    const name = tokens.slice(1);
    if (name.length === 0) return { ok: false, reason: '--milestone needs a name' };
    return { ok: true, target: { numbers: [], milestone: name.join(' ') } };
  }
  const numbers: number[] = [];
  for (const token of tokens) {
    const match = /^#?(\d+)$/.exec(token);
    if (!match || Number(match[1]) < 1) return { ok: false, reason: `Not an issue number: ${token}` };
    const nr = Number(match[1]);
    if (!numbers.includes(nr)) numbers.push(nr);
  }
  return { ok: true, target: { numbers, milestone: null } };
}

function tokenize(text: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;
  let started = false;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current !== '') tokens.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (quote) return null;
  if (started || current !== '') tokens.push(current);
  return tokens;
}

// The `/deliver` argument text: `3 4` or `--milestone "name"`.
export function deliverArgs(target: Target): string {
  if (target.milestone !== null) return `--milestone ${JSON.stringify(target.milestone)}`;
  return target.numbers.join(' ');
}
