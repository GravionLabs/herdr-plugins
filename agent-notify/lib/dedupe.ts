// No second notification for the same pane and state within the window. Pure; the caller persists `seen`.
export const WINDOW_MS = 30_000;

export type Seen = Record<string, number>; // `<pane>|<state>` -> epoch ms of the last notification

// `notify` tells whether to notify; `seen` is the next state (expired entries dropped).
export function check(seen: Seen, paneId: string, state: string, now: number): { notify: boolean; seen: Seen } {
  const next: Seen = {};
  for (const [k, at] of Object.entries(seen)) if (now >= at && now - at < WINDOW_MS) next[k] = at;
  const k = `${paneId}|${state}`;
  if (k in next) return { notify: false, seen: next };
  next[k] = now;
  return { notify: true, seen: next };
}
