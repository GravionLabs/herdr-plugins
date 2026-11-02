# deliver-board

## Purpose

`deliver-board` opens a popup with the delivery state of the current repository: the open PBIs, who claimed them, their branch and their pull request into `release/next` with the check status. It runs when you invoke its `open` action. It only reads from GitHub and git, it never writes.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-board
```

Requirements:

- [GitHub CLI](https://cli.github.com) `gh`, logged in with `gh auth login`. Without `gh` or without a login the board shows one error line.
- `git`. The repository is the one of the focused pane's cwd. Outside a git repository the popup says so and closes on any key.
- Platforms: macOS and Linux. Minimum herdr version: 0.9.5.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `deliver-board.open` | Opens the `board` pane as a popup and passes the focused pane's cwd on. |
| Pane | `board` | Popup (90% wide, 70% high) with one row per open issue labelled `pbi`, ordered by number. |

The plugin declares no events and no link handlers.

The board columns:

| Column | Source |
| --- | --- |
| PBI, Title | REST issues API filtered by label `pbi` (cached, ETag) |
| Assignee | the claim: the issue's assignees |
| Labels | `needs-decision`, `in-progress` and `merged`; other labels are left out |
| Branch | the pushed `<type>/<nr>-*` branch (`git ls-remote --heads origin`), or the PR's head branch |
| PR | the PR into `release/next` from a `<type>/<nr>-*` branch; an open PR wins over a merged or closed one, whose state is shown next to the number |
| Checks | the PR's checks in the buckets of `gh pr checks`: failed, pending, passed, skipped |

Keys in the popup:

| Key | Action |
| --- | --- |
| `j` / `k`, arrow keys | move the selection |
| Enter | open the PR of the row in the browser, or the issue when there is no PR |
| `r` | refresh |
| `q`, Escape | close |

The action needs no input, so you can invoke it without a keybinding:

```sh
herdr plugin action invoke deliver-board.open
```

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `open` action in herdr's `config.toml`, for example to `prefix+shift+b` (`prefix+b` toggles the sidebar):

```toml
[[keys.command]]
key = "prefix+shift+b"
type = "plugin_action"
command = "deliver-board.open"
description = "deliver board"
```

## Configuration

None. The plugin reads no config file.

## Examples

Open the board in a repository with PBIs labelled `pbi`: each open PBI is one row. A claimed PBI shows its assignee, a PBI with a pushed `<type>/<nr>-*` branch shows that branch, and a PBI with a PR into `release/next` shows the PR number and the check buckets.

Press Enter on a row with a PR to open that PR in the browser. On a row without a PR, Enter opens the issue. Only http and https URLs are opened.

Press `r` to refresh. Within 30 seconds of the last load `r` makes no GitHub call, because the answers are cached.

API load: the open PBIs come from the REST issues API (`gh api repos/{owner}/{repo}/issues?labels=pbi`), revalidated with an ETag. The PR list (`gh pr list`, GraphQL) is cached. Both are cached for 30 seconds under `HERDR_PLUGIN_STATE_DIR/gh-cache`.

## Troubleshooting

- **The board shows one error line.** `gh` is missing or not logged in. Install `gh` and run `gh auth login`.
- **The popup says it is not in a git repository and closes on any key.** The focused pane's cwd is outside a git repository. Focus a pane inside the repository and open the board again.
- **`GitHub rate limit exceeded, resets at HH:MM`.** The GitHub rate limit is exhausted. The time is local time and a herdr notification is shown too. Wait until the reset time. Unchanged lists are revalidated with an ETag and cost no rate limit.
- **A new PBI or PR does not show after `r`.** The data is cached for 30 seconds. Press `r` again after that.
- **A PBI is missing.** Only open issues labelled `pbi` are listed.

## Preview

```text
[screenshot placeholder: a popup titled "Deliver board" with one row per open PBI.
Columns PBI, Title, Assignee, Labels, Branch, PR and Checks; one row selected;
a row with a PR into release/next shows its number and the check status]
```
