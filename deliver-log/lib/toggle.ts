// The command of the action: Switch-LogPane.ps1 of the installed `deliver` skill. Pure.
import { join } from 'node:path';

export type Command = { command: string; args: string[] };

export function scriptPath(skillDir: string): string {
  return join(skillDir, 'scripts', 'Switch-LogPane.ps1');
}

export function toggleCommand(skillDir: string): Command {
  return { command: 'pwsh', args: ['-NoProfile', '-File', scriptPath(skillDir)] };
}
