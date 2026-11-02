# Keybindings

One `config.toml` snippet with the recommended keybinding of every plugin that has a keyboard-friendly action. Paste it into the herdr `config.toml` and adjust the keys. Every key uses the herdr `prefix`, and none of them collides with a default herdr keybinding of herdr 0.9.5 (checked by `test/keybindings.test.ts`).

```toml
[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "command-palette.open"
description = "command palette"

[[keys.command]]
key = "prefix+d"
type = "plugin_action"
command = "deliver-starter.start"
description = "start /deliver"

[[keys.command]]
key = "prefix+shift+b"
type = "plugin_action"
command = "deliver-board.open"
description = "deliver board"

[[keys.command]]
key = "prefix+shift+o"
type = "plugin_action"
command = "deliver-log.toggle"
description = "toggle the deliver log pane"

[[keys.command]]
key = "prefix+shift+v"
type = "plugin_action"
command = "review-popup.open"
description = "show the deliver review"

[[keys.command]]
key = "prefix+shift+f"
type = "plugin_action"
command = "repo-open.open"
description = "open a repository"

[[keys.command]]
key = "prefix+shift+a"
type = "plugin_action"
command = "layout-bootstrap.apply"
description = "apply the project layout"

[[keys.command]]
key = "prefix+shift+c"
type = "plugin_action"
command = "worktree-cleanup.cleanup"
description = "clean up merged worktrees"
```

## Keys

| Key | Action | Plugin |
| --- | --- | --- |
| `prefix+a` | `command-palette.open` | [command-palette](plugins/command-palette.md) |
| `prefix+d` | `deliver-starter.start` | [deliver-starter](plugins/deliver-starter.md) |
| `prefix+shift+b` | `deliver-board.open` | [deliver-board](plugins/deliver-board.md) |
| `prefix+shift+o` | `deliver-log.toggle` | [deliver-log](plugins/deliver-log.md) |
| `prefix+shift+v` | `review-popup.open` | [review-popup](plugins/review-popup.md) |
| `prefix+shift+f` | `repo-open.open` | repo-open |
| `prefix+shift+a` | `layout-bootstrap.apply` | [layout-bootstrap](plugins/layout-bootstrap.md) |
| `prefix+shift+c` | `worktree-cleanup.cleanup` | [worktree-cleanup](plugins/worktree-cleanup.md) |

## Without a keybinding

- `link-trim` is a link handler (`trailing-punct`) that herdr calls when you open a link, so it needs no key. Its `open` action can be run with `herdr plugin action invoke link-trim.open`.
- `deliver-view` has no recommended key: run `herdr plugin action invoke deliver-view apply`.
- `deliver-starter.start-link` is the target of the `github-issue` link handler, not a keybinding.
- `agent-notify` reacts to events and has no action.

Any action can also be started from the `command-palette` or with `herdr plugin action invoke <plugin>.<action>`.

## Changed names

`deliver-log.toggle-log` is the deprecated alias of `deliver-log.toggle`. Use `toggle` ([public names](../naming.md)).

## Per-OS notes

- The snippet is the same text on macOS, Linux and Windows; no plugin README documents a per-OS key difference.
- Whether a terminal or OS shortcut (for example the macOS Option key, or a Windows terminal) swallows `prefix+shift+<letter>` was not verified. If a key does not reach herdr, pick another one and run `herdr config check`.
- Windows is not a declared plugin platform yet ([compatibility](../compatibility.md)).

## Check the file

```sh
herdr config check
```
