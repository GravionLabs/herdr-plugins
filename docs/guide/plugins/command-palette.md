# command-palette

## Purpose

`command-palette` is a popup to search and run plugin actions and your own commands with one key. The `open` action opens the popup with a search field and a fuzzy-filtered list of entries.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/command-palette
```

None beyond herdr 0.9.5. Platforms: macOS and Linux.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `command-palette.open` | Opens the palette popup. It passes the focused pane's id and cwd to the popup. |
| Pane | `palette` | Popup (60% wide, 50% high) with the search field and the entry list. |

The plugin declares no events and no link handlers.

Entries: every action from `herdr plugin action list`, shown as `<plugin_id> · <title>`, and your own commands from `config.json`, shown as `config · <title>`. The palette's own action `command-palette.open` and actions not for the current platform are left out. An empty, failing or unparseable list (10 s timeout) shows `No plugin actions found`.

Enter starts the runner detached, then the popup exits. The runner calls `herdr plugin action invoke <action> --plugin <plugin>` with the original pane given explicitly. A failing or timed-out (10 s) run shows the notification `command-palette: <title> failed`; nothing is shown on success.

Invoke the action without a keybinding:

```sh
herdr plugin action invoke command-palette.open
```

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `open` action in herdr's `config.toml`, for example to `prefix+a`:

```toml
[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "command-palette.open"
description = "command palette"
```

Keys in the popup:

| Key | Action |
| --- | --- |
| type, Backspace | Filter live, case-insensitive, on the title only (the `<plugin_id> ·` prefix is display-only and not searched) (prefix first, then word starts such as `tdl` for `Toggle the deliver log pane`, then scattered letters). |
| Up, Down, Ctrl+P, Ctrl+N | Move the selection. |
| Enter | Run the selected entry; the popup closes. |
| Escape, Ctrl+C | Close the popup. |

## Configuration

Own commands live in `config.json` in the plugin config dir (`herdr plugin config-dir command-palette`, also `$HERDR_PLUGIN_CONFIG_DIR`). The file is checked against `schema/config.schema.json`.

```json
{
  "commands": [
    { "title": "show agent-log", "command": ["herdr", "pane", "split", "--current"], "cwd": "/path/optional" }
  ]
}
```

- `title`: non-empty string. `command`: non-empty array of strings, run without a shell. `cwd`: optional.
- Enter runs the command in the entry `cwd`, else the cwd of the focused pane, else `$HOME`. Output is discarded.
- A missing file is fine. Not supported: shell strings, per-entry environment variables, showing output.

Recently used entries are kept in one global history (all repositories) in `$HERDR_PLUGIN_STATE_DIR/recent.json`. With an empty search, used entries come first ordered by frecency (use count, halved every 7 days since the last use); with a search, usage only breaks ties between equal match quality. A failed run is not recorded.

## Examples

- Press the palette key, type `tdl`: the entry `deliver-log · Toggle the deliver log pane` matches by word starts of its title. Only the title is searched, not the plugin id, so `dl` would not find it by the plugin name. Enter runs that plugin's action in the pane you came from.
- Add the `show agent-log` entry above to `config.json`. The palette lists `config · show agent-log`; Enter runs `herdr pane split --current` without a shell.
- Open the palette with an empty search after using it for a while: the entries you use most come first.

## Troubleshooting

- **`No matches`.** Entries exist but none matches the query; `No plugin actions found` shows only when the combined entry list is empty.
- **`No plugin actions found`.** `herdr plugin action list` returned nothing, failed, timed out after 10 s or could not be parsed. Check that herdr is running and that plugins are installed.
- **A hint line `config.json: <problem>` under the search field.** The file has invalid JSON, an invalid entry or an unknown key (`(+N more)` for further problems). Valid entries still work. Fix the named problem.
- **The notification `command-palette: <title> failed`.** The action or command exited non-zero, timed out after 10 s or could not be started.
- **The notification `Could not open the command palette` (exit code 1).** The popup could not be opened. A known cause such as a missing tool is named in the notification instead.
- **Your own command does not appear.** `config.json` is not in the directory printed by `herdr plugin config-dir command-palette`, or the entry is invalid.

## Preview

```text
[screenshot placeholder: a popup with a search field showing "tdl", below it a list of entries
such as "deliver-log · Toggle the deliver log pane" and "config · show agent-log", one highlighted]
```
