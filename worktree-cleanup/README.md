# worktree-cleanup

Removes the worktrees and local branches that merged PBIs left behind. `deliver` runs `Remove-PbiWorktrees.ps1` after each merge, but worktrees stay when a session is aborted or a PBI is merged by hand. `worktree-cleanup` runs the same script from herdr, for every merged PR at once, and deletes the branch of a worktree herdr removed.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/worktree-cleanup
```

## Keybinding

Bind the `cleanup` action in herdr's `config.toml`, for example to `prefix+shift+c`:

```toml
[[keys.command]]
key = "prefix+shift+c"
type = "plugin_action"
command = "worktree-cleanup.cleanup"
description = "clean up merged worktrees"
```

Without a keybinding: `herdr plugin action invoke worktree-cleanup.cleanup`.

## Requirements

- The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills): `npx skills add GravionLabs/skills --skill deliver`. The plugin calls its installed `scripts/Remove-PbiWorktrees.ps1`, looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver`, `~/.agents/skills/deliver` (`<repo>` is the git toplevel of the focused pane's cwd). Without it a notification says how to install it.
- PowerShell 7+ (`pwsh`), [GitHub CLI](https://cli.github.com) `gh` logged in with `gh auth login`, and `git`.

## What it does

| Trigger | What happens |
|:--|:--|
| Action `cleanup` | Lists the merged PRs into `release/next` (`gh pr list --state merged`). For each one whose head branch `<type>/<nr>-*` or `wip-<nr>` still has a local branch or worktree it runs `Remove-PbiWorktrees.ps1 -Pr <pr> -Issue <nr>` in the repository of the focused pane. |
| Event `worktree.removed` | Deletes the local branch of the removed worktree when no other worktree has it checked out and every commit of it is on a remote branch (`git branch -r --contains`), with `git branch -d` first and `-D` when `-d` refuses. `main`, `master`, `release/next` and the default branch of `origin` are never deleted. A branch with local-only commits stays. |

Worktrees with uncommitted changes and the current worktree (the one of the focused pane) are never touched; the script lists them in `left`.

The result is a herdr notification `<n> removed, <m> left` (`n` counts removed worktrees and deleted branches). Everything that was left, with the command that removes it by hand, goes to the plugin log:

```bash
herdr plugin log list --plugin worktree-cleanup
```

The event hook is silent when there is nothing to do (detached worktree, branch already gone or still checked out).

## Development

The PR selection, the parsing of `git` and script output, the summary and the orphaned-branch rule live in `lib/cleanup.ts`, the lookup of the `deliver` skill in `lib/skill.ts` (the same lookup and test cases as in `deliver-starter` and `deliver-log`), the event and context parsing in `lib/context.ts`. Entry points: `bin/cleanup.ts` (action) and `bin/removed.ts` (event hook). The tests in `test/` run against a temporary git repository (`test/fixture.ts`); the end-to-end case with the installed `Remove-PbiWorktrees.ps1` runs only when `pwsh` and the `deliver` skill are installed. Run them from the repository root with `npm test`.
