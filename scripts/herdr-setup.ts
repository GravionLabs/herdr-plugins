// Usage: node scripts/herdr-setup.ts <command> [--json] [--yes] [--dry-run] [--help]
// Commands: doctor (reports whether herdr and the machine are ready for the plugins; changes nothing),
//           apply (adds the config.toml blocks the plugins rely on, after a diff and a backup).
// Exit code 0 when every check passes (doctor) or the apply went through, 1 otherwise.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runApply, type ApplyIo } from './lib/apply.ts';
import { defaultConfigPath } from './lib/config.ts';
import { runDoctor, type Check, type Deps } from './lib/doctor.ts';

export const HELP = `herdr-setup <command> [--json]

Commands:
  doctor    check that herdr and this machine are ready for the plugins (changes nothing)
  apply     add the config.toml blocks the plugins rely on: shows a diff, writes a backup
            (config.toml.bak-<timestamp>), asks, writes, then runs \`herdr server reload-config\`.
            Never changes a key or section you already set (a different value is a hint).

Options:
  --json     print the doctor checks as JSON
  --yes      apply: do not ask for confirmation
  --dry-run  apply: only show the diff
  --help    show this help

Exit code: 0 when all checks pass, 1 otherwise.
Config: $HERDR_CONFIG_PATH, else the default location of the OS.`;

function askLine(question: string): boolean {
  process.stdout.write(question);
  const buf = Buffer.alloc(64);
  try {
    const n = readSync(0, buf, 0, buf.length, null);
    return /^\s*y(es)?\s*$/i.test(buf.toString('utf8', 0, n));
  } catch {
    return false;
  }
}

export function realDeps(): Deps & ApplyIo {
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
    writeFile: (path, content) => {
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.tmp-${process.pid}`;
      try {
        writeFileSync(tmp, content);
        renameSync(tmp, path);
      } catch (e) {
        rmSync(tmp, { force: true });
        throw e;
      }
    },
    confirm: askLine,
    now: () => new Date(),
  };
}

export function format(checks: Check[]): string {
  return checks
    .map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}${c.hint ? `\n       hint: ${c.hint}` : ''}`)
    .join('\n');
}

export function main(argv: string[], deps: Deps & ApplyIo, out: (text: string) => void): number {
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    out(HELP);
    return argv.length === 0 ? 1 : 0;
  }
  const command = argv.find((a) => !a.startsWith('--'));
  if (command === 'apply') {
    return runApply(deps, defaultConfigPath(deps.platform, deps.env, deps.home), { yes: argv.includes('--yes'), dryRun: argv.includes('--dry-run') }, out);
  }
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
