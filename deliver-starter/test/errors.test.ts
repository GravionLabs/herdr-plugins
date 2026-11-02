import type { Config } from '../lib/config.ts';
import { viewFailure } from '../lib/issue.ts';
import type { IssueLink } from '../lib/link.ts';
import { startFromLink } from '../lib/link-start.ts';
import type { Run } from '../lib/run.ts';
import { loadIssues } from '../lib/suggest.ts';
import { run } from '../lib/run.ts';
import { describe, expect, it } from 'vitest';
import { classifyFailure, classifyText, describe as describeError, noRepository, notice, noticeFor } from '../lib/errors.ts';

const HINT = {
  tool: 'Install it and make sure it is on your PATH.',
  login: 'Run `gh auth login`.',
  repo: 'Open the pane inside a git repository.',
  rate: 'Wait until the GitHub rate limit resets, then try again.',
};

describe('missing tool', () => {
  it.each(['gh', 'git', 'pwsh'])('names %s when the spawn fails with ENOENT', (tool) => {
    expect(classifyFailure(tool, 'ENOENT', '')).toEqual({ kind: 'missing-tool', message: `${tool} is not installed`, hint: HINT.tool });
  });

  it('names the tool of a full path without extension', () => {
    expect(classifyFailure(String.raw`C:\Program Files\PowerShell\7\pwsh.exe`, 'ENOENT', '')?.message).toBe('pwsh is not installed');
  });

  it('reads the tool from a thrown spawn error and from shell messages', () => {
    expect(classifyText('spawn gh ENOENT')?.message).toBe('gh is not installed');
    expect(classifyText('bash: gh: command not found')?.message).toBe('gh is not installed');
    expect(classifyText("'pwsh' is not recognized as an internal or external command")?.message).toBe('pwsh is not installed');
  });
});

describe('gh not logged in', () => {
  it.each(['To get started with GitHub CLI, please run:  gh auth login', 'You are not logged into any GitHub hosts', 'authentication required'])(
    'recognises %s',
    (stderr) => {
      expect(classifyFailure('gh', 1, stderr)).toEqual({ kind: 'not-logged-in', message: 'gh is not logged in', hint: HINT.login });
    },
  );

  it('treats gh exit code 4 as not logged in', () => {
    expect(classifyFailure('gh', 4, '')?.kind).toBe('not-logged-in');
    expect(classifyFailure('git', 4, '')).toBeNull();
  });
});

describe('no git repository', () => {
  it('recognises the git message', () => {
    expect(classifyFailure('git', 128, 'fatal: not a git repository (or any of the parent directories): .git')).toEqual({
      kind: 'no-repository',
      message: 'not a git repository',
      hint: HINT.repo,
    });
  });
});

describe('GitHub rate limit', () => {
  it('recognises the primary and the secondary limit', () => {
    const expected = { kind: 'rate-limit', message: 'GitHub rate limit exceeded', hint: HINT.rate };
    expect(classifyFailure('gh', 1, 'gh: API rate limit exceeded for user ID 1. (HTTP 403)')).toEqual(expected);
    expect(classifyText('You have exceeded a secondary rate limit')).toEqual(expected);
  });

  it('wins over the login hint of the same message', () => {
    expect(classifyText('API rate limit exceeded. Authenticated requests get a higher rate limit. gh auth login')?.kind).toBe('rate-limit');
  });
});

describe('notifications', () => {
  it('formats title as "<plugin>: <message>" and body as the hint', () => {
    expect(notice('deliver-log', noRepository())).toEqual({ title: 'deliver-log: not a git repository', body: HINT.repo });
    expect(noticeFor('review-popup', 'gh is not logged in', 'x failed')).toEqual({ title: 'review-popup: gh is not logged in', body: HINT.login });
  });

  it('keeps the fallback title and the text for an unknown failure', () => {
    expect(noticeFor('p', 'boom', 'p failed')).toEqual({ title: 'p failed', body: 'boom' });
    expect(classifyFailure('gh', 1, 'boom')).toBeNull();
  });

  it('joins message and hint for inline reasons', () => {
    expect(describeError(noRepository())).toBe(`not a git repository. ${HINT.repo}`);
  });
});
describe('run()', () => {
  it('reports a missing tool with the shared message', async () => {
    const result = await run('herdr-no-such-tool', [], process.cwd());
    expect(result).toMatchObject({ ok: false, code: 'ENOENT', stderr: 'herdr-no-such-tool is not installed' });
  });

  it('reports a missing git repository with the shared message', async () => {
    const result = await run(process.execPath, ['-e', "console.error('fatal: not a git repository'); process.exit(128)"], process.cwd());
    expect(result).toMatchObject({ ok: false, stderr: 'not a git repository' });
  });

  it('reports not logged in and rate limit with the shared messages', async () => {
    const fake = (text: string) => run(process.execPath, ['-e', `console.error(${JSON.stringify(text)}); process.exit(1)`], process.cwd());
    expect(await fake('To authenticate, run: gh auth login')).toMatchObject({ stderr: 'gh is not logged in' });
    expect(await fake('API rate limit exceeded (HTTP 403)')).toMatchObject({ stderr: 'GitHub rate limit exceeded' });
  });
});


describe('deliver-starter errors', () => {
  const failing = (code: string | number, stderr: string): Run => async () => ({ ok: false, code, stdout: '', stderr });
  const hint = 'Install it and make sure it is on your PATH.';

  it('loadIssues gives the shared reason for gh', async () => {
    expect(await loadIssues(failing('ENOENT', ''), '/r', 5)).toEqual({ ok: false, reason: `gh is not installed. ${hint}` });
    expect(await loadIssues(failing(4, ''), '/r', 5)).toEqual({ ok: false, reason: 'gh is not logged in. Run `gh auth login`.' });
    expect(await loadIssues(failing(1, 'API rate limit exceeded'), '/r', 5)).toEqual({
      ok: false,
      reason: 'GitHub rate limit exceeded. Wait until it resets, then try again.',
      rateLimited: true,
    });
  });

  it('viewFailure gives the same reasons for gh issue view', () => {
    expect(viewFailure(7, 'ENOENT', '')).toBe(`gh is not installed. ${hint}`);
    expect(viewFailure(7, 1, 'gh auth login')).toBe('gh is not logged in. Run `gh auth login`.');
    expect(viewFailure(7, 1, 'API rate limit exceeded')).toContain('GitHub rate limit exceeded.');
  });

  it('a link outside a repository gives the shared reason', async () => {
    const deps = { run: failing(1, ''), herdr: 'herdr', exists: () => false, home: '/h' };
    const outcome = await startFromLink(deps, null, { mode: 'interactive' } as Config, { repo: 'o/r', number: 7 } as IssueLink);
    expect(outcome).toEqual({ ok: false, reason: 'not a git repository. Open the pane inside a git repository.' });
  });
});
