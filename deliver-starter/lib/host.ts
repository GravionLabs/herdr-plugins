// herdr side: repository of a cwd, notification.
import { run } from './run.ts';

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
