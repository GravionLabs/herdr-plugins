// Palette entries. `run` says how an entry is started; entries without it cannot be run.
export type EntryRun =
  | { kind: 'action'; plugin: string; action: string }
  | { kind: 'command'; command: string[]; cwd?: string };
export type Entry = { id: string; group: string; title: string; run?: EntryRun };
