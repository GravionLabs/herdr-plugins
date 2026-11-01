// herdr side: binary path, notification.
import { run } from './run.ts';

export const herdrBin = (): string => process.env.HERDR_BIN_PATH || 'herdr';

export async function notify(title: string, body?: string): Promise<void> {
  const args = ['notification', 'show', title];
  if (body) args.push('--body', body);
  await run(herdrBin(), args, process.cwd());
}
