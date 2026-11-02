# review-popup

Popup with the last `deliver` review of the PBI behind the focused pane's branch: unmet criteria, blocking findings (`file:line — title`, `why` below) and notes. The plugin only reads the file `deliver` writes after a review round; it never starts a review.

The PBI number comes from the branch name `<type>/<nr>-<slug>`. The file is `<git-common-dir>/.agents/state/review-<nr>.json` (`git rev-parse --git-common-dir` in the pane's cwd, so every worktree finds the same file). On a branch without PBI number, such as the `/deliver` pane on `release/next` or `main` (deliver implements in worktrees of its own), the popup lists every review of the repository to choose from.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/review-popup
```

## Keybinding

Bind the `open` action in herdr's `config.toml`, for example to `prefix+shift+v`:

```toml
[[keys.command]]
key = "prefix+shift+v"
type = "plugin_action"
command = "review-popup.open"
description = "show the deliver review"
```

Without a keybinding: `herdr plugin action invoke review-popup.open`.

## Popup

- Header `#<nr> round <round>`; when the review's `sha` differs from the branch's HEAD it says the review is stale.
- Up/Down (or `k`/`j`) select a blocking finding, Enter opens the file at the line in `$EDITOR` (`vi` when unset) in a new split pane. `q` or Esc closes.
- On a branch without PBI number: the list of all review files, newest first, one line each `#<nr>  round <round>  <branch>` (`STALE` when the review's `sha` differs from the head of its branch; a deleted branch is not stale, an invalid file shows its validation error). Up/Down select, Enter shows the review, `b` or Backspace goes back to the list. Findings of a review opened from the list open in the worktree of its branch when there is one.
- One line instead of the review for: no review file (no review in the repository at all on a branch without PBI number), an invalid file (with the validation error).

## Requirements

- The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills) with the review file (GravionLabs/skills#53).
- Git.

## Development

Review parsing, validation and rendering in `lib/review.ts`, file lookup in `lib/load.ts`, editor split in `lib/split.ts`, entry points `bin/open.ts` (action) and `bin/review.ts` (popup). herdr is called through `HERDR_BIN_PATH`.

`schema/` holds copies of `deliver-review.schema.json` and `review.schema.json` from GravionLabs/skills at commit `d6953b2` (see `schema/SOURCE.md`); they are not fetched at build time. The validator is written by hand against them, with no runtime dependency. Run the tests from the repository root with `npm test`.
