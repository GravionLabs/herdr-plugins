# command-palette

A popup to search and run plugin actions and own commands with one key. The `open` action opens the popup with a search field and a fuzzy-filtered list of example entries (real entries and running come in later releases).

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/command-palette
```

## Keybinding

Bind the `open` action in herdr's `config.toml`, for example to `prefix+p`:

```toml
[[keys.command]]
key = "prefix+p"
type = "plugin_action"
command = "command-palette.open"
description = "command palette"
```

Without a keybinding: `herdr plugin action invoke command-palette.open`.

## Context

The `open` action passes the focused pane's id and cwd to the popup as `PALETTE_CONTEXT` (JSON `{"paneId","cwd"}`). Without context the popup still opens. If the popup cannot be opened, the action exits with code 1 and shows the notification "Could not open the command palette".

## Keys

| Key | Action |
|:--|:--|
| type, Backspace | filter live, case-insensitive (prefix first, then word starts such as `dl` for `deliver-log`, then scattered letters) |
| Up, Down, Ctrl+P, Ctrl+N | move the selection |
| Enter | pick the selected entry (running it comes later) |
| Escape, Ctrl+C | close (exit code 0, cursor and screen restored) |

## Development

`lib/context.ts` parses the context (and holds the spike note on focus after the popup closes), `lib/host.ts` calls herdr through `HERDR_BIN_PATH`. Run the tests from the repository root with `npm test`.
