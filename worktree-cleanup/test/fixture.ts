// Temporary git repository fixture: a bare `origin` and a clone with `main` and `release/next` pushed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Fixture = {
  root: string;
  repo: string;
  git: (...args: string[]) => string;
  commit: (file: string, cwd?: string) => void;
  dispose: () => void;
};

export function createFixture(): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'worktree-cleanup-')));
  const origin = join(root, 'origin.git');
  const repo = join(root, 'repo');
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const exec = (cwd: string, args: string[]): string =>
    execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  exec(root, ['init', '--quiet', '--bare', '--initial-branch=main', origin]);
  exec(root, ['clone', '--quiet', origin, repo]);
  // the fixture's commits must not depend on the user's git config (signing, hooks)
  exec(repo, ['config', 'commit.gpgsign', 'false']);
  exec(repo, ['config', 'core.hooksPath', '/dev/null']);
  const commit = (file: string, cwd = repo): void => {
    writeFileSync(join(cwd, file), `${file}\n`);
    exec(cwd, ['add', file]);
    exec(cwd, ['commit', '--quiet', '-m', file]);
  };
  exec(repo, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  commit('README.md');
  exec(repo, ['push', '--quiet', '-u', 'origin', 'main']);
  exec(repo, ['push', '--quiet', 'origin', 'main:release/next']);
  exec(repo, ['remote', 'set-head', 'origin', 'main']);
  return {
    root,
    repo,
    git: (...args) => exec(repo, args),
    commit,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}
