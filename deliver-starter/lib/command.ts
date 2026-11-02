// Commands typed into the new panes, and branch and tab names. Pure.
import { join } from 'node:path';
import { deliverArgs, type Target } from './args.ts';

export const quote = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

export function loopScript(skillDir: string): string {
  return join(skillDir, 'scripts', 'Invoke-DeliverLoop.ps1');
}

// `claude '/deliver 3 4'`; `harness` is the configured command and may carry flags.
export function interactiveCommand(harness: string, target: Target): string {
  return `${harness} ${quote(`/deliver ${deliverArgs(target)}`)}`;
}

// `pwsh '<skill>/scripts/Invoke-DeliverLoop.ps1' -Target 3 4` or `-Milestone '<name>'`.
export function unattendedCommand(skillDir: string, target: Target): string {
  const base = `pwsh ${quote(loopScript(skillDir))}`;
  if (target.milestone !== null) return `${base} -Milestone ${quote(target.milestone)}`;
  return `${base} -Target ${target.numbers.join(' ')}`;
}

export function branchName(target: Target): string {
  if (target.milestone === null) return `deliver/${target.numbers[0]}`;
  const slug = target.milestone
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    // git refuses `..` and a component ending in `.`: `../x` must not become `deliver/milestone-..-x`
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '');
  return `deliver/milestone-${slug || 'run'}`;
}

export function tabLabel(target: Target): string {
  return target.milestone === null ? `deliver #${target.numbers[0]}` : `deliver ${target.milestone}`;
}
