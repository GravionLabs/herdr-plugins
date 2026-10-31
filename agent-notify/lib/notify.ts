// Orchestration: filter, de-duplicate, look up the pane and show the notification. Dependencies are injected.
import type { Config } from './config.ts';
import { check, type Seen } from './dedupe.ts';
import { statusEvent, type NotifyState } from './event.ts';
import { compose, type Message, type PaneFacts } from './message.ts';

export type Deps = {
  now: () => number;
  loadSeen: () => Promise<Seen>;
  saveSeen: (seen: Seen) => Promise<void>;
  lookup: (paneId: string, workspaceId: string) => Promise<PaneFacts>;
  show: (message: Message, state: NotifyState, config: Config) => Promise<void>;
};

// True when a notification was shown.
export async function handle(deps: Deps, config: Config, eventJson: string | undefined): Promise<boolean> {
  const event = statusEvent(eventJson);
  if (!event) return false;
  const verdict = check(await deps.loadSeen(), event.paneId, event.state, deps.now());
  await deps.saveSeen(verdict.seen);
  if (!verdict.notify) return false;
  const facts = await deps.lookup(event.paneId, event.workspaceId);
  await deps.show(compose(event, facts), event.state, config);
  return true;
}
