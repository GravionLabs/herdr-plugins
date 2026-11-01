import { invokeAction } from '../lib/host.ts';
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

describe('invokeAction errors', () => {
  const node = (script: string) => invokeAction({ command: process.execPath, args: ['-e', script], env: {} });

  it('reports a missing tool', async () => {
    const outcome = await invokeAction({ command: 'herdr-no-such-tool', args: [], env: {} });
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.message).toBe('herdr-no-such-tool is not installed');
  });

  it('reports not logged in, no repository and rate limit from stderr', async () => {
    const stderr = (text: string) => node(`console.error(${JSON.stringify(text)}); process.exit(1)`);
    expect((await stderr('gh auth login')).error?.kind).toBe('not-logged-in');
    expect((await stderr('fatal: not a git repository')).error?.kind).toBe('no-repository');
    expect((await stderr('API rate limit exceeded')).error?.kind).toBe('rate-limit');
  });

  it('has no error class for an ordinary failure and none on success', async () => {
    expect(await node('process.exit(3)')).toEqual({ ok: false, error: null });
    expect(await node('')).toEqual({ ok: true, error: null });
  });
});
