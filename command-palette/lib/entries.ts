// Palette entries. Fixed examples until the real sources land (#42, #43).
export type Entry = { id: string; group: string; title: string };

export const exampleEntries: Entry[] = [
  { id: 'deliver-starter.start', group: 'deliver-starter', title: 'start-deliver' },
  { id: 'deliver-log.open', group: 'deliver-log', title: 'deliver-log' },
  { id: 'deliver-board.open', group: 'deliver-board', title: 'deliver-board' },
  { id: 'deliver-view.open', group: 'deliver-view', title: 'deliver-view' },
  { id: 'agent-notify.test', group: 'agent-notify', title: 'send-test-notification' },
  { id: 'worktree-cleanup.run', group: 'worktree-cleanup', title: 'cleanup-worktrees' },
  { id: 'link-trim.run', group: 'link-trim', title: 'trim-links' },
];
