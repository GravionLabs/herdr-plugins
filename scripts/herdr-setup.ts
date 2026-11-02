// Usage: node scripts/herdr-setup.ts <command> [--json] [--help]
// Commands: doctor (reports whether herdr and the machine are ready for the plugins; changes nothing).
// Exit code 0 when every check passes, 1 otherwise.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runDoctor, type Check, type Deps } from './lib/doctor.ts';

export const HELP = `herdr-setup <command> [--json]

Commands:
  doctor    check that herdr and this machine are ready for the plugins (changes nothing)

Options:
  --json    print the checks as JSON
  --help    show this help

Exit code: 0 when all checks pass, 1 otherwise.
Config: $HERDR_CONFIG_PATH, else the default location of the OS.`;

export function realDeps(): Deps {
  return {
    run: (command, args) => {
      const r = spawnSync(command, args, { encoding: 'utf8', timeout: 15000 });
      return { ok: r.status === 0 && !r.error, stdout: r.stdout ?? '' };
    },
    exists: (path) => existsSync(path),
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return null;
      }
    },
    env: process.env,
    platform: process.platform,
    home: homedir(),
    nodeVersion: process.version,
    cwd: process.cwd(),
  };
}

export function format(checks: Check[]): string {
  return checks
    .map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}${c.hint ? `\n       hint: ${c.hint}` : ''}`)
    .join('\n');
}

export function main(argv: string[], deps: Deps, out: (text: string) => void): number {
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    out(HELP);
    return argv.length === 0 ? 1 : 0;
  }
  const command = argv.find((a) => !a.startsWith('--'));
  if (command !== 'doctor') {
    out(`unknown command '${command ?? ''}'\n\n${HELP}`);
    return 1;
  }
  const checks = runDoctor(deps);
  out(argv.includes('--json') ? JSON.stringify({ ok: checks.every((c) => c.ok), checks }, null, 2) : format(checks));
  return checks.every((c) => c.ok) ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), realDeps(), (t) => console.log(t)));
}
