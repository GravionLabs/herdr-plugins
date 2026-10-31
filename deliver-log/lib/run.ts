// Runs a command without a shell and returns its output; never throws, so callers decide what a failure means.
import { execFile } from 'node:child_process';

export type Result =
  { ok: true; stdout: string; stderr: string } | { ok: false; code: string | number | null; stdout: string; stderr: string };

export type Run = (command: string, args: string[], cwd: string) => Promise<Result>;

export const run: Run = (command, args, cwd) =>
  new Promise((resolve) => {
    execFile(command, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve({ ok: true, stdout, stderr: String(stderr ?? '') });
      const code = (error as NodeJS.ErrnoException).code ?? null;
      resolve({
        ok: false,
        code: typeof code === 'string' || typeof code === 'number' ? code : null,
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
      });
    });
  });

// The first non-empty line of stderr, or '' when there is none.
export function firstStderrLine(result: Result): string {
  return result.stderr.split('\n').find((line) => line.trim() !== '')?.trim() ?? '';
}

// The first non-empty line of a failed command's stderr, or its exit code.
export function failureLine(result: Result): string {
  if (result.ok) return '';
  return firstStderrLine(result) || `exit code ${result.code ?? 'unknown'}`;
}
