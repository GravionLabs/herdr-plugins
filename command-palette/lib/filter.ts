// Fuzzy filter over entry titles. Tiers: 0 prefix, 1 word-start hits, 2 scattered subsequence.
import type { Entry } from './entries.ts';

type Match = { tier: number; positions: number[] };

const isWordStart = (text: string, i: number): boolean => i === 0 || !/[a-z0-9]/i.test(text[i - 1]!);

function subsequence(text: string, query: string, wordStartsOnly: boolean): number[] | null {
  const positions: number[] = [];
  let from = 0;
  for (const ch of query) {
    let at = -1;
    for (let i = from; i < text.length; i++) {
      if (text[i] === ch && (!wordStartsOnly || isWordStart(text, i))) {
        at = i;
        break;
      }
    }
    if (at < 0) return null;
    positions.push(at);
    from = at + 1;
  }
  return positions;
}

function match(title: string, query: string): Match | null {
  const text = title.toLowerCase();
  const q = query.toLowerCase();
  if (text.startsWith(q)) return { tier: 0, positions: [...q].map((_, i) => i) };
  const words = subsequence(text, q, true);
  if (words) return { tier: 1, positions: words };
  const scattered = subsequence(text, q, false);
  return scattered ? { tier: 2, positions: scattered } : null;
}

// Indexes of the title characters the query matches, or null without a match.
export function matchPositions(entry: Entry, query: string): number[] | null {
  if (!query) return [];
  return match(entry.title, query)?.positions ?? null;
}

// Matching entries, best tier first, input order kept within a tier. Empty query keeps everything.
export function filterEntries(entries: Entry[], query: string): Entry[] {
  if (!query) return entries;
  return entries
    .map((entry, order) => ({ entry, order, m: match(entry.title, query) }))
    .filter((r) => r.m !== null)
    .sort((a, b) => a.m!.tier - b.m!.tier || a.order - b.order)
    .map((r) => r.entry);
}
