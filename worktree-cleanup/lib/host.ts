// herdr side of the commands: repository of a cwd, notification and plugin log output.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logLines, summaryBody, summaryTitle, type CleanupResult, type Failure } from './cleanup.ts';
import { run } from './run.ts';
import { findDeliverSkill } from './skill.ts';

export const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

export async function notify(title: string, body?: string): Promise<void> {
  const args = ['notification', 'show', title];
  if (body) args.push('--body', body);
  await run(herdrBin(), args, process.cwd());
}

// The git toplevel of `cwd`, or null outside a repository.
export async function gitToplevel(cwd: string): Promise<string | null> {
  const top = await run('git', ['rev-parse', '--show-toplevel'], cwd);
  return top.ok ? top.stdout.trim() : null;
}

// Path of the installed Remove-PbiWorktrees.ps1, or null when the deliver skill (or the script in it) is missing.
export function removeScript(repo: string | null): string | null {
  const skill = findDeliverSkill(repo, homedir(), existsSync);
  const script = skill ? join(skill, 'scripts', 'Remove-PbiWorktrees.ps1') : null;
  return script && existsSync(script) ? script : null;
}

// stdout ends up in herdr's plugin command log (`herdr plugin log list --plugin worktree-cleanup`).
export async function report(result: CleanupResult, failed: Failure[] = []): Promise<void> {
  for (const line of logLines(result, failed)) process.stdout.write(`${line}\n`);
  await notify(summaryTitle(result, failed), summaryBody(result, failed));
}
