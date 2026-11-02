# worktree-cleanup

## Purpose

`worktree-cleanup` removes the worktrees and local branches that merged PBIs left behind. `deliver` runs `Remove-PbiWorktrees.ps1` after each merge, but worktrees stay when a session is aborted or a PBI is merged by hand. The plugin runs the same script from herdr for every merged PR at once (action `cleanup`), and it deletes the branch of a worktree herdr removed (event `worktree.removed`).

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/worktree-cleanup
```

Requirements:

- The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills): `npx skills add GravionLabs/skills --skill deliver`. The plugin calls its installed `scripts/Remove-PbiWorktrees.ps1`, looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver`, `~/.agents/skills/deliver` (`<repo>` is the git toplevel of the focused pane's cwd).
- PowerShell 7+ (`pwsh`), [GitHub CLI](https://cli.github.com) `gh` logged in with `gh auth login`, and `git`.
- Platforms: macOS and Linux. Minimum herdr version: 0.9.5.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `worktree-cleanup.cleanup` | Lists the merged PRs into `release/next` (`gh pr list --state merged`). For each one whose head branch `<type>/<nr>-*` or `wip-<nr>` still has a local branch or worktree it runs `Remove-PbiWorktrees.ps1 -Pr <pr> -Issue <nr>` in the repository of the focused pane. |
| Event | `worktree.removed` | Deletes the local branch of the removed worktree when no other worktree has it checked out and every commit of it is on a remote branch. |

The plugin declares no panes and no link handlers.

The event runs on its own. `cleanup` needs no input:

```sh
herdr plugin action invoke worktree-cleanup.cleanup
```

Rules:

- Worktrees with uncommitted changes and the current worktree (the one of the focused pane) are never touched; the script lists them in `left`.
- The event hook uses `git branch -d -- <branch>` first and `-D` when `-d` refuses, but only when every commit of the branch is on a remote branch (`git branch -r --contains`). `main`, `master`, `release/next` and the default branch of `origin` are never deleted. A branch with local-only commits stays.
- Branch names go to git with `--` before the name and without a shell. The `git branch -D` command the hook logs for a branch it leaves is shell-quoted when the name holds characters such as `;`, `&`, `$` or quotes, so it is safe to copy.

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `cleanup` action in herdr's `config.toml`, for example to `prefix+shift+c`:

```toml
[[keys.command]]
key = "prefix+shift+c"
type = "plugin_action"
command = "worktree-cleanup.cleanup"
description = "clean up merged worktrees"
```

## Configuration

None. The plugin reads no config file.

## Examples

- Two PBIs were merged by hand, and their worktrees and branches `feat/12-login` and `fix/15-typo` are still around. Invoke `worktree-cleanup.cleanup`: the script removes both and a notification says `<n> removed, <m> left` (`n` counts removed worktrees and deleted branches).
- One of those worktrees has uncommitted changes. It is not touched; the notification counts it under `left` and the plugin log has the command that removes it by hand:

  ```bash
  herdr plugin log list --plugin worktree-cleanup
  ```

- You remove a worktree in herdr. The `worktree.removed` hook deletes its local branch when all its commits are on a remote branch. It is silent when there is nothing to do (detached worktree, branch already gone or still checked out).

## Troubleshooting

- **A notification says `worktree-cleanup: deliver skill not installed`.** The skill was not found in any of the four lookup locations. Run `npx skills add GravionLabs/skills --skill deliver`.
- **A notification says `worktree-cleanup: not a git repository`.** The focused pane is not inside a git repository. Focus a pane in one.
- **A notification names a missing tool (`<tool> is not installed`) or `gh is not logged in`.** Install `pwsh`, `gh` or `git` and make sure it is on your `PATH`, and run `gh auth login`.
- **The notification title ends with `, <k> failed`.** A per-PR script run failed. The plugin log lists each as `failed PR #<n>: ...`.
- **Something stays after the run.** It is counted under `left`: a worktree with uncommitted changes, the current worktree, or a branch with local-only commits. The plugin log lists each with the command to remove it by hand.
- **A branch was not deleted by the event hook.** It is still checked out in another worktree, has commits on no remote branch, or is `main`, `master`, `release/next` or the default branch of `origin`.

## Preview

```text
[screenshot placeholder: a herdr notification "<n> removed, <m> left" after the cleanup action,
and the plugin log listing a left worktree with the command that removes it]
```
