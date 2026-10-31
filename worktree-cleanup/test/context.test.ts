import { describe, expect, it } from 'vitest';
import { cwdFromContext, removedWorktreeFromEvent } from '../lib/context.ts';

describe('cwdFromContext', () => {
  it('takes the cwd of the focused pane, else the workspace cwd', () => {
    expect(cwdFromContext(JSON.stringify({ workspace_cwd: '/ws', focused_pane_cwd: '/repo/sub' }))).toBe('/repo/sub');
    expect(cwdFromContext(JSON.stringify({ workspace_cwd: '/ws' }))).toBe('/ws');
  });

  it.each([undefined, '', 'not json', 'null', '[]', '{"focused_pane_cwd":""}', '{"focused_pane_cwd":3}'])(
    'returns null for %j',
    (input) => {
      expect(cwdFromContext(input)).toBeNull();
    },
  );
});

describe('removedWorktreeFromEvent', () => {
  // shape of `worktree_removed` in `herdr api schema --json` (herdr 0.9.5)
  const data = {
    type: 'worktree_removed',
    workspace_id: 'w3',
    forced: false,
    workspace: {
      workspace_id: 'w3',
      worktree: {
        repo_key: 'k',
        repo_name: 'herdr-plugins',
        repo_root: '/src/herdr-plugins',
        checkout_path: '/src/herdr-plugins-wt-7',
        is_linked_worktree: true,
      },
    },
    worktree: {
      path: '/src/herdr-plugins-wt-7',
      branch: 'feat/7-worktree-cleanup',
      is_bare: false,
      is_detached: false,
      is_prunable: false,
      is_linked_worktree: true,
      label: 'feat/7-worktree-cleanup',
    },
  };
  const expected = {
    path: '/src/herdr-plugins-wt-7',
    branch: 'feat/7-worktree-cleanup',
    repoRoot: '/src/herdr-plugins',
  };

  it('reads path, branch and repository root of the bare event data', () => {
    expect(removedWorktreeFromEvent(JSON.stringify(data))).toEqual(expected);
  });

  it('reads the event wrapped in the socket envelope', () => {
    expect(removedWorktreeFromEvent(JSON.stringify({ event: 'worktree_removed', data }))).toEqual(expected);
  });

  it('strips refs/heads/ and allows a missing workspace', () => {
    const event = { workspace_id: 'w3', workspace: null, worktree: { path: '/wt', branch: 'refs/heads/wip-7' } };
    expect(removedWorktreeFromEvent(JSON.stringify(event))).toEqual({ path: '/wt', branch: 'wip-7', repoRoot: null });
  });

  it('has no branch for a detached worktree', () => {
    const event = { worktree: { path: '/wt', branch: null, is_detached: true } };
    expect(removedWorktreeFromEvent(JSON.stringify(event))).toEqual({ path: '/wt', branch: null, repoRoot: null });
  });

  it.each([undefined, '', 'not json', '[]', '{}', '{"worktree":{}}'])('returns null for %j', (input) => {
    expect(removedWorktreeFromEvent(input)).toBeNull();
  });
});
