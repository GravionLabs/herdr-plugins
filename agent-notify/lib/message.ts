// The notification text of a pane. Pure.
import type { StatusEvent } from './event.ts';

export type PaneFacts = {
  workspace: string | null; // workspace label
  tab: string | null; // tab label
  tokens: Record<string, string>; // pane tokens
};

export type Message = { title: string; body: string };

// `12` -> `#12`; anything else unchanged.
const ref = (value: string): string => (/^\d+$/.test(value) ? `#${value}` : value);

// A pane with the token `deliver` is named by `deliver`, `deliver_step` and `deliver_pr`:
// `deliver #12 review: 1 blocking (PR #34)`; every other pane by its display agent.
export function compose(event: StatusEvent, facts: PaneFacts): Message {
  const place = [facts.workspace, facts.tab].filter((part): part is string => !!part).join(' / ');
  const deliver = facts.tokens.deliver?.trim();
  if (deliver) {
    const parts = ['deliver', ref(deliver)];
    const step = facts.tokens.deliver_step?.trim();
    if (step) parts.push(step);
    const pr = facts.tokens.deliver_pr?.trim();
    if (pr) parts.push(`(PR ${ref(pr)})`);
    return { title: parts.join(' '), body: [event.state, place].filter(Boolean).join(' · ') };
  }
  const agent = event.displayAgent ?? event.agent ?? 'agent';
  return { title: `${agent} ${event.state}`, body: place };
}
