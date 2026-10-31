# layout-bootstrap

Opens a project workspace with a fixed pane layout in one key: agent pane, test watcher and shell. The layout can be set per project.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/layout-bootstrap
```

## Keybinding

Bind the `apply` action in herdr's `config.toml`, for example to `prefix+shift+a`:

```toml
[[keys.command]]
key = "prefix+shift+a"
type = "plugin_action"
command = "layout-bootstrap.apply"
description = "apply the project layout"
```

Without a keybinding: `herdr plugin action invoke layout-bootstrap.apply`.

## What it does

Action `apply` works on the workspace of the focused pane. The repository root is the git toplevel of the focused pane's cwd; every pane it creates starts there.

- The first pane of the layout is the focused pane itself. It is renamed to the pane name; a plain shell outside the repository root gets a `cd` to it. An agent pane cannot be moved (herdr has no way to change a running pane's cwd), so it stays where it is.
- Every other pane is a split of an earlier pane, created with the repository root as cwd, renamed to its name, and its `command` is run.
- Panes are matched by name (herdr pane label). A pane that already exists is reused: nothing is split, renamed or run again, so applying twice does not duplicate the layout. Only panes of the focused tab count; the same name in another tab is ignored. Reused panes keep their cwd.
- Not every pane is guaranteed to be in the repository root: an agent root pane and reused panes that are elsewhere are kept as they are, and the notification lists them ("not in the repository root: ...").

## Layout resolution

1. `.agents/herdr-layout.json` in the repository.
2. `layout.json` in the plugin config dir (`HERDR_PLUGIN_CONFIG_DIR`), the default for projects without their own.
3. Built-in default: `agent` left (60 %), `tests` right top, `shell` right bottom.

An invalid layout file stops the action with a notification naming the file and the problem; it does not fall back.

The `command` of the default `tests` pane is the `testCommand` string of `config.json` in the plugin config dir (for example `{"testCommand": "npm test -- --watch"}`). Without it the pane is created and left empty. The plugin does not detect the stack itself.

## Layout schema

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
|:--|:--|
| `panes` | Non-empty list. The first pane is the focused pane and has no `split`. |
| `name` | Required, unique. Used as the pane label and to find existing panes. |
| `command` | Optional. Typed into the pane when it is created. |
| `split.from` | Name of an earlier pane to split. Default: the previous pane. |
| `split.direction` | `right` or `down`. |
| `split.ratio` | Between 0 and 1, default 0.5. Passed to `herdr pane split --ratio`: the share the split pane keeps. |

## Development

Layout parsing and resolution are in `lib/layout.ts`, the herdr calls in `lib/apply.ts`, the entry point is `bin/apply.ts`. The tests in `test/` use a fake herdr runner that records the calls. Run them from the repository root with `npm test`.
