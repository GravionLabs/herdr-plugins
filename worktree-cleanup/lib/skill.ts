// Lookup of the installed `deliver` skill (GravionLabs/skills). The same lookup lives in every plugin that calls a
// `deliver` script (deliver-starter, deliver-log); plugins install per directory, so each carries its own copy,
// pinned by the same test cases.
import { join } from 'node:path';

export const INSTALL_COMMAND = 'npx skills add GravionLabs/skills --skill deliver';

// Candidate directories in lookup order; `repo` is the git toplevel of the focused pane's cwd (null outside a repo).
export function deliverSkillCandidates(repo: string | null, home: string): string[] {
  const local = repo ? [join(repo, '.claude', 'skills', 'deliver'), join(repo, '.agents', 'skills', 'deliver')] : [];
  return [...local, join(home, '.claude', 'skills', 'deliver'), join(home, '.agents', 'skills', 'deliver')];
}

// The first candidate that exists, or null when the skill is not installed.
export function findDeliverSkill(repo: string | null, home: string, exists: (path: string) => boolean): string | null {
  return deliverSkillCandidates(repo, home).find((dir) => exists(dir)) ?? null;
}
