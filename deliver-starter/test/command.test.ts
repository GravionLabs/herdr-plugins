import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Target } from '../lib/args.ts';
import { branchName, interactiveCommand, quote, tabLabel, unattendedCommand } from '../lib/command.ts';

const numbers: Target = { numbers: [3, 4], milestone: null };
const milestone: Target = { numbers: [], milestone: "my 'rel'" };

const loop = join('/s/deliver', 'scripts', 'Invoke-DeliverLoop.ps1');

describe('command building per mode', () => {
  it('interactive: the harness with the quoted /deliver prompt', () => {
    expect(interactiveCommand('claude', numbers)).toBe("claude '/deliver 3 4'");
    expect(interactiveCommand('claude --model opus', { numbers: [3], milestone: null })).toBe(
      "claude --model opus '/deliver 3'",
    );
  });

  it('interactive: a milestone becomes --milestone with the name', () => {
    expect(interactiveCommand('claude', { numbers: [], milestone: 'v1' })).toBe("claude '/deliver --milestone \"v1\"'");
  });

  it('unattended: the loop script with -Target numbers', () => {
    expect(unattendedCommand('/s/deliver', numbers)).toBe(`pwsh '${loop}' -Target 3 4`);
  });

  it('unattended: -Milestone with the quoted name', () => {
    expect(unattendedCommand('/s/deliver', milestone)).toBe(
      `pwsh '${loop}' -Milestone 'my '\\''rel'\\'''`,
    );
  });

  it('quotes single quotes for the shell', () => {
    expect(quote("a'b")).toBe("'a'\\''b'");
  });

  it('names branch and tab after the first number or the milestone', () => {
    expect(branchName(numbers)).toBe('deliver/3');
    expect(tabLabel(numbers)).toBe('deliver #3');
    expect(branchName({ numbers: [], milestone: '0.3.0' })).toBe('deliver/milestone-0.3.0');
    expect(tabLabel({ numbers: [], milestone: '0.3.0' })).toBe('deliver 0.3.0');
    expect(branchName({ numbers: [], milestone: '!!' })).toBe('deliver/milestone-run');
  });

  it('keeps .. and shell characters of a milestone out of the branch name', () => {
    expect(branchName({ numbers: [], milestone: '../../x' })).toBe('deliver/milestone-x');
    expect(branchName({ numbers: [], milestone: '1..2.' })).toBe('deliver/milestone-1.2');
    expect(branchName({ numbers: [], milestone: '..' })).toBe('deliver/milestone-run');
    expect(branchName({ numbers: [], milestone: 'a;rm -rf ~&$(id)`x`' })).toBe('deliver/milestone-a-rm-rf-id-x');
  });

  it('keeps ; & $() of a milestone inside the single-quoted shell argument', () => {
    const target: Target = { numbers: [], milestone: 'v1; rm -rf ~ & $(id) `x` |y' };
    expect(unattendedCommand('/s/deliver', target)).toBe(`pwsh '${loop}' -Milestone 'v1; rm -rf ~ & $(id) \`x\` |y'`);
    expect(interactiveCommand('claude', target)).toBe(`claude '/deliver --milestone "v1; rm -rf ~ & $(id) \`x\` |y"'`);
  });
});
