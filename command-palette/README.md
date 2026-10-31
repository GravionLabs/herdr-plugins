# command-palette

A popup to search and run plugin actions and own commands with one key. The `open` action opens the popup with a search field and a fuzzy-filtered list of entries.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/command-palette
```

## Keybinding

Bind the `open` action in herdr's `config.toml`, for example to `prefix+a` (`prefix+p` switches to the previous tab):

```toml
[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "command-palette.open"
description = "command palette"
```

Without a keybinding: `herdr plugin action invoke command-palette.open`.

## Context

The `open` action passes the focused pane's id and cwd to the popup as `PALETTE_CONTEXT` (JSON `{"paneId","cwd"}`). Without context the popup still opens. If the popup cannot be opened, the action exits with code 1 and shows the notification "Could not open the command palette".

## Entries and running

Entry sources: every action from `herdr plugin action list`, shown as `<plugin_id> · <title>`. The palette own action `command-palette.open` and actions not for the current platform are left out. An empty, failing or unparseable list (10 s timeout) shows `No plugin actions found`.

Enter starts `bin/run.ts` detached with the entry and `PALETTE_CONTEXT`, then the popup exits (if the runner cannot be started: notification and exit code 1). The runner calls `herdr plugin action invoke <action> --plugin <plugin>` with the original pane given explicitly: cwd of the pane and `HERDR_PANE_ID`. A failing or timed-out (10 s) invoke shows the notification `command-palette: <title> failed`; nothing is shown on success.

## Own commands (config.json)

Own entries come from `$HERDR_PLUGIN_CONFIG_DIR/config.json` (`herdr plugin config-dir command-palette`) and appear as `config · <title>` next to the plugin actions:

```json
{
  "commands": [
    { "title": "show agent-log", "command": ["herdr", "pane", "split", "--current"], "cwd": "/path/optional" }
  ]
}
```

- `title`: non-empty string. `command`: non-empty array of strings, run without a shell. `cwd`: optional.
- Enter runs the command via the detached runner in the entry `cwd`, else the cwd of `PALETTE_CONTEXT`, else `$HOME`. Output is discarded; a non-zero exit, timeout (10 s) or spawn error shows the notification `command-palette: <title> failed`.
- A missing file is fine. Invalid JSON or an invalid entry shows one hint line `config.json: <problem>` (`(+N more)` for further problems) under the search field; valid entries still work.
- Not supported: shell strings, per-entry environment variables, showing output.

## Recently used

One global history (all repositories) in `$HERDR_PLUGIN_STATE_DIR/recent.json`. The runner records an entry (`action:<plugin>.<action>` or `config:<title>`) after it ran successfully; a failed run is not recorded. With an empty search, used entries come first ordered by frecency (use count, halved every 7 days since the last use), unused ones follow in their normal order. With a search, usage only breaks ties between equal match quality. A missing or corrupt file counts as empty; keys of entries that no longer exist are dropped on write; the file is written via `recent.json.tmp` and a rename, and a failing write is ignored.

## Keys

| Key | Action |
|:--|:--|
| type, Backspace | filter live, case-insensitive (prefix first, then word starts such as `dl` for `deliver-log`, then scattered letters) |
| Up, Down, Ctrl+P, Ctrl+N | move the selection |
| Enter | run the selected entry, the popup closes |
| Escape, Ctrl+C | close (exit code 0, cursor and screen restored) |

## Development

`lib/context.ts` parses the context (and holds the spike note on focus after the popup closes), `lib/host.ts` calls herdr through `HERDR_BIN_PATH`. Run the tests from the repository root with `npm test`.
