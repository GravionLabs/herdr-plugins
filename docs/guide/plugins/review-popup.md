# review-popup

## Purpose

`review-popup` shows the last `deliver` review of the PBI behind the focused pane's branch in a popup: unmet criteria, blocking findings and notes. It runs when you invoke the `open` action. It only reads the review file that `deliver` writes after a review round; it never starts a review.

The PBI number comes from the branch name `<type>/<nr>-<slug>`. The file is `<git-common-dir>/.agents/state/review-<nr>.json` (`git rev-parse --git-common-dir` in the pane's cwd), so every worktree of a repository finds the same file.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/review-popup
```

Requirements:

- The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills), which writes the review file (GravionLabs/skills#53). No skills version is pinned; the popup reads review schema version 1 (a file without `schemaVersion` counts as version 1). The schemas are copies from GravionLabs/skills commit `d6953b2` (see [Compatibility](../../compatibility.md)).
- Git.
- Platforms: macOS and Linux. Minimum herdr version: 0.9.5.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `review-popup.open` | Opens the `review` popup for the branch of the focused pane. |
| Pane | `review` | Popup (90% wide, 70% high) that shows the review. |

The plugin declares no events and no link handlers.

Invoke the action without a keybinding:

```sh
herdr plugin action invoke review-popup.open
```

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `open` action in herdr's `config.toml`, for example to `prefix+shift+v`:

```toml
[[keys.command]]
key = "prefix+shift+v"
type = "plugin_action"
command = "review-popup.open"
description = "show the deliver review"
```

Keys inside the popup:

| Key | Effect |
| --- | --- |
| Up/Down or `k`/`j` | Select a blocking finding (or an entry of the list). |
| Enter | Open the selected finding's file at its line in `$EDITOR` (`vi` when unset) in a new split pane; in the list, show the review. |
| `b` or Backspace | In a review opened from the list, go back to the list. |
| `q` or Esc | Close the popup. |

## Configuration

None. The plugin reads no config file. It validates review files against copies of `deliver-review.schema.json` and `review.schema.json` in the plugin's `schema/` folder.

## Examples

- On branch `feat/42-add-login`, the popup reads `review-42.json` and shows the header `#42 round 2`, the unmet criteria, each blocking finding as `file:line — title` with its `why` below, and the notes. Select a finding and press Enter to open the file at that line in a split pane.
- When the review's `sha` differs from the branch's HEAD, the header adds a `STALE: reviewed <sha>, branch has moved on` note, because commits were added after the review.
- On a branch without PBI number (for example the `/deliver` pane on `release/next` or `main`), the popup lists all review files of the repository, newest first, one line each: `#<nr>  round <round>  <branch>`, marked `STALE` where the review's `sha` differs from the head of its branch. Enter shows a review; its findings open in the worktree of its branch when there is one.

## Troubleshooting

- **`No review file for #<nr>: <path>`.** `deliver` has not written a review for this PBI yet. It writes the file after a review round.
- **The list is empty on a branch without PBI number.** There is no review in the repository at all.
- **One line with a validation error instead of the review.** The review file is invalid; the line names the problem.
- **`Unsupported review schema version ...`.** The file has a `schemaVersion` other than 1. Use the `deliver` skill version the message names or a compatible one.
- **`Not opened: ...` after Enter.** The finding's file lies outside the worktree (`../`) or its name contains `'`, `\`, a typographic single quote or a control character. This is intentional; open the file by hand.
- **Odd `?` characters in a title.** Control characters of the review text are shown as `?` so no escape sequence from a review reaches the terminal.
- **A notification such as `review-popup: <tool> is not installed` or `review-popup: not a git repository`.** The action could not open the popup. Install the missing tool and make sure it is on your `PATH`, or focus a pane inside a git repository.

## Preview

```text
[screenshot placeholder: a popup titled "#42 round 2" listing unmet criteria, blocking
findings as "file:line - title" with the reason below, one finding highlighted, and notes]
```
