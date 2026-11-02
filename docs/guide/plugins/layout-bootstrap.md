# layout-bootstrap

## Purpose

`layout-bootstrap` opens a project workspace with a fixed pane layout in one key: agent pane, test watcher and shell. The layout can be set per project. It runs when you invoke the `apply` action.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/layout-bootstrap
```

None beyond herdr 0.9.5. Platforms: macOS and Linux. Git must be available: the repository root is the git toplevel of the focused pane's cwd.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `layout-bootstrap.apply` | Applies the layout to the workspace of the focused pane. |

The plugin declares no panes, no events and no link handlers.

How `apply` works:

- The first pane of the layout is the focused pane itself. It is renamed to the pane name; a plain shell outside the repository root gets a `cd` to it. An agent pane cannot be moved, so it stays where it is.
- Every other pane is a split of an earlier pane, created with the repository root as cwd, renamed to its name, and its `command` is run.
- Panes are matched by name (herdr pane label) within the focused tab. A pane that already exists is reused, so applying twice does not duplicate the layout. Reused panes keep their cwd.
- The result is a notification `Layout applied: <n> created, <m> reused`, plus `; not in the repository root: ...` for panes that are elsewhere.

`apply` works on the focused pane, so invoke it from a focused pane:

```sh
herdr plugin action invoke layout-bootstrap.apply
```

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `apply` action in herdr's `config.toml`, for example to `prefix+shift+a`:

```toml
[[keys.command]]
key = "prefix+shift+a"
type = "plugin_action"
command = "layout-bootstrap.apply"
description = "apply the project layout"
```

## Configuration

Layout resolution, first match wins:

1. `.agents/herdr-layout.json` in the repository.
2. `layout.json` in the plugin config dir (`herdr plugin config-dir layout-bootstrap`), the default for projects without their own.
3. Built-in default: `agent` left (60 %), `tests` right top, `shell` right bottom.

An invalid layout file stops the action with a notification naming the file and the problem; it does not fall back.

`config.json` in the plugin config dir sets the command of the default `tests` pane. Without it the pane is created and left empty; the plugin does not detect the stack. The file is checked against `schema/config.schema.json`.

```json
{
  "testCommand": "npm test -- --watch"
}
```

Layout file format:

```json
{
  "panes": [
    { "name": "agent", "command": "claude" },
    { "name": "tests", "command": "npm test -- --watch", "split": { "from": "agent", "direction": "right", "ratio": 0.6 } },
    { "name": "shell", "split": { "from": "tests", "direction": "down", "ratio": 0.5 } }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `panes` | Non-empty list. The first pane is the focused pane and has no `split`. |
| `name` | Required, unique. Used as the pane label and to find existing panes. |
| `command` | Optional. Typed into the pane when it is created. |
| `split.from` | Name of an earlier pane to split. Default: the previous pane. |
| `split.direction` | `right` or `down`. |
| `split.ratio` | Between 0 and 1, default 0.5. Passed to `herdr pane split --ratio`: the share the split pane keeps. |

The commands of `.agents/herdr-layout.json` are typed into panes, so applying the layout of an untrusted repository runs that repository's commands (listed as an open item in the [security review](https://github.com/GravionLabs/herdr-plugins/blob/main/docs/security-review.md)).

## Examples

- No layout files, `{"testCommand": "npm test -- --watch"}` in `config.json`: `apply` renames the focused pane `agent`, splits `tests` to its right (running `npm test -- --watch`) and `shell` below it.
- A repository with `.agents/herdr-layout.json` as above: that layout is used instead of the default.
- Apply twice: the second run creates nothing and the notification says `Layout applied: 0 created, 3 reused`.

## Troubleshooting

- **`layout-bootstrap: no focused pane`.** The action got no focused pane. Invoke it from a focused pane.
- **`layout-bootstrap: not a git repository`.** The focused pane's cwd is not inside a git repository. Focus a pane in one.
- **A notification names a layout file and a problem, and nothing is applied.** The layout file is invalid. Fix it; there is no fallback.
- **`layout-bootstrap: invalid config`.** `config.json` has an invalid value or an unknown key. The notification names file and key; invalid keys are ignored and the layout is still applied.
- **The `tests` pane is empty.** No `testCommand` is set in `config.json`.
- **`not in the repository root: ...` in the notification.** An agent root pane or a reused pane is elsewhere; those panes are kept as they are.
- **`layout-bootstrap failed`.** An unexpected error; the notification body has the message.

## Preview

```text
[screenshot placeholder: a tab with the agent pane on the left (60 %), the tests pane top right
running the watcher and the shell pane bottom right, and the notification "Layout applied: 2 created, 1 reused"]
```
