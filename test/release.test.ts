import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, root), 'utf8');

describe('release workflow', () => {
  const workflow = read('.github/workflows/release.yml');

  it('runs on push to main and as a manual backfill with version and ref', () => {
    expect(workflow).toMatch(/push:\n\s+branches: \[main\]/);
    expect(workflow).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+version:[\s\S]*?\n\s+ref:/);
  });

  it('releases only after the tests are green', () => {
    expect(workflow).toMatch(/release:\n\s+name: Release\n\s+needs: test\n/);
    expect(workflow).toContain('uses: GravionLabs/ci/node/ci@main');
  });

  it('determines the version with GitVersion.yml on the full history', () => {
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toMatch(
      /uses: GravionLabs\/ci\/versioning\/determine-version@main\n\s+with:\n\s+gitversion-config-file: GitVersion.yml/,
    );
  });

  it('creates the release with changelog and issue closing, pushing with GH_PAT', () => {
    const step = workflow.slice(workflow.indexOf('uses: GravionLabs/ci/versioning/gh-release@main'));
    expect(step).toContain('version: ${{ steps.version.outputs.semver }}');
    expect(step).toContain('changelog-file: CHANGELOG.md');
    expect(step).toContain('cliff-config: cliff.toml');
    expect(step).toContain("update-changelog: 'true'");
    expect(step).toContain("close-issues: 'true'");
    expect(step).toContain('token: ${{ secrets.GH_PAT }}');
  });

  it('grants the permissions gh-release and close-release-issues need', () => {
    const job = workflow.slice(workflow.indexOf('  release:\n'), workflow.indexOf('  backfill:\n'));
    expect(job).toMatch(/contents: write/);
    expect(job).toMatch(/issues: write/);
    expect(job).toMatch(/pull-requests: read/);
  });

  it('leaves pushes to main and tags to the release workflow in CI', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/push:\n\s+branches-ignore: \[main\]/);
  });
});

describe('cliff.toml', () => {
  it('matches v-prefixed stable tags like the other GravionLabs repositories', () => {
    const cliff = read('cliff.toml');
    expect(cliff).toContain('tag_pattern = "v[0-9]+\\\\.[0-9]+\\\\.[0-9]+$"');
    expect(cliff).toContain('All notable changes to herdr-plugins');
    expect(cliff).not.toContain('<project>');
  });
});

// GitVersion fixture: runs only where gitversion is installed (not on the CI runner, where determine-version installs it).
const gitversion = ['dotnet-gitversion', 'gitversion'].find((bin) => {
  try {
    execFileSync(bin, ['/version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});

describe.skipIf(!gitversion)('GitVersion.yml', () => {
  let dir = '';
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(GITHUB_|TF_BUILD|GITLAB_CI|TEAMCITY|JENKINS|APPVEYOR|CI$)/.test(key),
    ),
  );
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env });
  // The Conventional Commit bump rules that versioning/determine-version of GravionLabs/ci passes as override config.
  const bumpRules = [
    'major-version-bump-message=\\+semver:\\s?(breaking|major)|^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\\([^)\\n]+\\))?(!:|:.*\\n\\n((.+\\n)+\\n)?BREAKING[ -]CHANGE:\\s.+)',
    'minor-version-bump-message=\\+semver:\\s?(feature|minor)|^(feat)(\\([^)\\n]+\\))?:',
    'patch-version-bump-message=\\+semver:\\s?(fix|patch)|^(fix|perf|revert)(\\([^)\\n]+\\))?:',
  ].flatMap((rule) => ['/overrideconfig', rule]);
  const version = (): string =>
    execFileSync(gitversion as string, ['.', '/output', 'json', '/showvariable', 'SemVer', ...bumpRules], {
      cwd: dir,
      encoding: 'utf8',
      env,
    })
      .trim()
      .split('\n')
      .at(-1) as string;
  const releaseMerge = (pr: number, ...messages: string[]): void => {
    git('checkout', '-q', 'release/next');
    git('merge', '-q', '--ff-only', 'main');
    for (const message of messages) git('commit', '-q', '--allow-empty', '-m', message);
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', 'release/next', '-m', `Merge pull request #${pr} from GravionLabs/release/next`);
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gitversion-'));
    git('init', '-q', '-b', 'main', '.');
    git('config', 'user.name', 'test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'commit.gpgsign', 'false');
    copyFileSync(new URL('GitVersion.yml', root), join(dir, 'GitVersion.yml'));
    git('add', 'GitVersion.yml');
    git('commit', '-q', '-m', 'chore: init');
    git('branch', 'release/next');
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('starts main at 0.1.0 without tags', () => {
    expect(version()).toBe('0.1.0');
  });

  it('makes release/next a minor pre-release after a feat commit', () => {
    git('tag', 'v0.1.0');
    git('checkout', '-q', 'release/next');
    git('merge', '-q', '--ff-only', 'main');
    git('commit', '-q', '--allow-empty', '-m', 'feat: next thing');
    expect(version()).toMatch(/^0\.2\.0-/);
    git('checkout', '-q', 'main');
  });

  it('gives main the next minor after merging a release with a feat commit', () => {
    releaseMerge(1, 'feat(plugin): new thing (#2)');
    expect(version()).toBe('0.2.0');
  });

  it('gives main the next patch after merging a fix-only release', () => {
    git('tag', 'v0.2.0');
    releaseMerge(3, 'fix(plugin): repair a thing (#4)', 'ci: tidy up (#5)');
    expect(version()).toBe('0.2.1');
  });

  it('keeps a hotfix on main a patch', () => {
    git('tag', 'v0.2.1');
    git('commit', '-q', '--allow-empty', '-m', 'fix: hotfix');
    expect(version()).toBe('0.2.2');
  });
});
