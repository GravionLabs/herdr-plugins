// Recently opened repositories: one history in HERDR_PLUGIN_STATE_DIR/recent.json, keyed by repository path.
// Scoring and bookkeeping are pure (same frecency as command-palette).
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Usage = { count: number; last: number };
export type RecentState = Record<string, Usage>;

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

// Frecency: count, halved for every 7 days since the last use. Unknown usage scores 0.
export function score(usage: Usage | undefined, now: number): number {
  if (!usage) return 0;
  const age = Math.max(0, now - usage.last);
  return usage.count * 0.5 ** (age / HALF_LIFE_MS);
}

export function record(state: RecentState, key: string, now: number): RecentState {
  const prev = state[key];
  return { ...state, [key]: { count: (prev?.count ?? 0) + 1, last: now } };
}

// Keeps only the keys in `keys`.
export function prune(state: RecentState, keys: Iterable<string>): RecentState {
  const keep = new Set(keys);
  return Object.fromEntries(Object.entries(state).filter(([key]) => keep.has(key)));
}

const isUsage = (v: unknown): v is Usage =>
  typeof v === 'object' &&
  v !== null &&
  Number.isFinite((v as Usage).count) &&
  (v as Usage).count > 0 &&
  Number.isFinite((v as Usage).last);

// A missing or corrupt file is an empty state; invalid single records are skipped.
export function readState(dir: string | undefined): RecentState {
  if (!dir) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, 'recent.json'), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isUsage(v)));
  } catch {
    return {};
  }
}

// Writes recent.json.tmp, then renames it, so an aborted write never truncates recent.json. False on failure.
export function writeState(dir: string | undefined, state: RecentState): boolean {
  if (!dir) return false;
  try {
    const tmp = join(dir, 'recent.json.tmp');
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, join(dir, 'recent.json'));
    return true;
  } catch {
    return false;
  }
}
