// Fuzzy filter over repositories, same tiers as command-palette: 0 prefix, 1 word-start hits, 2 scattered
// subsequence. A repository matches on its name or its relative path, whichever is better (the name on a tie).
import type { Repo } from './discover.ts';
import { score, type RecentState } from './recent.ts';

export type Field = 'name' | 'rel';
export type Match = { tier: number; field: Field; positions: number[] };

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

function matchText(value: string, query: string): { tier: number; positions: number[] } | null {
  const text = value.toLowerCase();
  const q = query.toLowerCase();
  if (text.startsWith(q)) return { tier: 0, positions: [...q].map((_, i) => i) };
  const words = subsequence(text, q, true);
  if (words) return { tier: 1, positions: words };
  const scattered = subsequence(text, q, false);
  return scattered ? { tier: 2, positions: scattered } : null;
}

// The better of the name and the relative path match; null without a match. Empty query: tier 0, no positions.
export function matchRepo(repo: Repo, query: string): Match | null {
  if (!query) return { tier: 0, field: 'name', positions: [] };
  const name = matchText(repo.name, query);
  const rel = matchText(repo.rel, query);
  if (name && (!rel || name.tier <= rel.tier)) return { field: 'name', ...name };
  return rel ? { field: 'rel', ...rel } : null;
}

// Matching repositories, best tier first. Within a tier the more used one (frecency) comes first, then input order.
// Empty query: used repositories by frecency, unused ones after in input order.
export function filterRepos(repos: Repo[], query: string, recent: RecentState = {}, now: number = 0): Repo[] {
  return repos
    .map((repo, order) => ({ repo, order, m: matchRepo(repo, query), used: score(recent[repo.path], now) }))
    .filter((r) => r.m !== null)
    .sort((a, b) => a.m!.tier - b.m!.tier || b.used - a.used || a.order - b.order)
    .map((r) => r.repo);
}
