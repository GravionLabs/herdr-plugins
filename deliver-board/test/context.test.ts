import { describe, expect, it } from 'vitest';
import { cwdFromContext, ghErrorLine } from '../lib/context.ts';

describe('cwdFromContext', () => {
  it('takes the cwd of the focused pane', () => {
    const context = {
      workspace_cwd: '/ws',
      focused_pane_id: 'w1:p1',
      focused_pane_cwd: '/repo/sub',
    };
    expect(cwdFromContext(JSON.stringify(context))).toBe('/repo/sub');
  });

  it('falls back to the workspace cwd when the pane has none', () => {
    expect(cwdFromContext(JSON.stringify({ workspace_cwd: '/ws' }))).toBe('/ws');
  });

  it.each([undefined, '', 'not json', 'null', '[]', '{"focused_pane_cwd":""}', '{"focused_pane_cwd":3}'])(
    'returns null for %j',
    (input) => {
      expect(cwdFromContext(input)).toBeNull();
    },
  );
});

describe('ghErrorLine', () => {
  it('says gh is missing when it cannot be started', () => {
    expect(ghErrorLine({ code: 'ENOENT' })).toBe(
      'gh is not installed: install the GitHub CLI from https://cli.github.com',
    );
  });

  it('says gh is not authenticated for exit code 4 or the auth hint', () => {
    const recorded =
      'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n';
    expect(ghErrorLine({ code: 4, stderr: recorded })).toBe('gh is not authenticated: run `gh auth login`');
    expect(
      ghErrorLine({
        code: 1,
        stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)\nauthentication failed',
      }),
    ).toBe('gh is not authenticated: run `gh auth login`');
  });

  it('shows the first non-empty stderr line for other failures', () => {
    expect(
      ghErrorLine({
        code: 1,
        stderr: '\nGraphQL: Could not resolve to a Repository\nmore',
      }),
    ).toBe('gh failed: GraphQL: Could not resolve to a Repository');
  });

  it('shows the exit code when stderr is empty', () => {
    expect(ghErrorLine({ code: 2, stderr: '' })).toBe('gh failed: exit code 2');
  });
});
