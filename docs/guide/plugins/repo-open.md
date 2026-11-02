# repo-open

## Purpose

`repo-open` opens a repository as its own workspace with one key. The action `open` shows a popup with a search field over the repositories on disk; Enter opens the selected one. A repository that already has a workspace is focused. Otherwise a new workspace is created, labelled with the repository name, with the configured tabs (by default `terminal` and `agent`, which runs `claude`), all in the repository root.

## Install

```bash
herdr plugin install -y --ref <tag> GravionLabs/herdr-plugins/repo-open
```

`<tag>` is a release tag, for example `v0.5.0`; see [Install](../install.md). repo-open needs release `v0.5.0` or newer; earlier releases do not contain it.

Requirements:

- Node.js 26, which runs the plugin's scripts ([Prerequisites](../prerequisites.md)).
- herdr's `ui.toast.delivery` must not be `off`, or the notifications of the plugin are not shown. Set it in herdr's `config.toml` and run `herdr server reload-config`:

  ```toml
  [ui.toast]
  delivery = "herdr"
  ```

- Platforms: macOS and Linux. Windows is not a declared platform. Minimum herdr version: 0.9.5.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `repo-open.open` | Opens the popup `picker`. If the popup cannot be opened, the action exits with code 1 and shows the notification "Could not open the repository picker". |
| Pane | `picker` | Popup (60% by 50%) with the search field and the list of repositories. Enter closes it and starts a detached runner that focuses or creates the workspace. |

The plugin declares no events and no link handlers.

Invoke the action without a keybinding:

```sh
herdr plugin action invoke repo-open.open
```

Keys in the popup:

| Key | Action |
|:--|:--|
| type, Backspace | filter live, case-insensitive, on the name or the relative path (prefix first, then word starts such as `hp` for `herdr-plugins`, then scattered letters) |
| Up, Down, Ctrl+P, Ctrl+N | move the selection |
| Enter | open the selected repository, the popup closes |
| Escape, Ctrl+C | close without opening |

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `open` action in herdr's `config.toml`, for example to `prefix+shift+f` (see [Keybindings](../keybindings.md)):

```toml
[[keys.command]]
key = "prefix+shift+f"
type = "plugin_action"
command = "repo-open.open"
description = "open a repository"
```

The entry `repo-open · Open a repository` in `command-palette` works too.

## Configuration

`$HERDR_PLUGIN_CONFIG_DIR/config.json`, found with `herdr plugin config-dir repo-open`. All keys are optional; a missing file uses the defaults. The schema is `repo-open/schema/config.schema.json`.

| Key | Type | Default |
|:--|:--|:--|
| `roots` | non-empty array of paths, absolute or starting with `~/` | `["~/Source"]` |
| `depth` | integer from 1 to 10 | `3` |
| `tabs` | non-empty array of `{ "label", "command"?, "focus"? }`, labels unique | `terminal`, then `agent` with `claude` and `focus` |

```json
{
  "roots": ["~/Source"],
  "depth": 3,
  "tabs": [
    { "label": "terminal" },
    { "label": "agent", "command": "claude", "focus": true }
  ]
}
```

`command` is typed into the tab's shell when the tab is created. The first tab marked `focus` is focused after opening, else the first tab. Invalid JSON or an invalid value shows one hint line `config.json: <problem>` in the popup; that key falls back to its default and the other keys still apply.

## Examples

- You press the key and type `hp`. `herdr-plugins` matches by word starts. Enter opens it: a workspace labelled `herdr-plugins` is created with the tabs `terminal` and `agent`, and the `agent` tab is focused.
- You open `herdr-plugins` again. Its workspace already exists, so it is focused and nothing is created or changed.
- Two repositories have the same name. The second workspace is labelled with the relative path instead of the name.

## Troubleshooting

- **The list says `No repositories below <roots>`.** No directory with `.git` was found within `depth` levels below the roots. Set `roots` and `depth` in `config.json`. Hidden directories, `node_modules` and symlinks are skipped.
- **The popup shows `config.json: <problem>`.** The file has invalid JSON or an invalid value. Fix the named key; until then it uses its default.
- **A notification says `repo-open: <name> failed`.** A herdr call of the runner failed; the body has the reason. `herdr plugin log list --plugin repo-open` shows the plugin log.
- **A notification says "Could not open the repository picker".** The popup could not be opened.
- **No notification appears.** Check that `ui.toast.delivery` is not `off` (see Install).

## Preview

```text
[screenshot placeholder: the repo-open popup with the search field "hp" and the repository herdr-plugins selected]
```
