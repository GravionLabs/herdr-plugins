# repo-open

A popup to search a repository on disk and open it as its own workspace with one key. A new workspace is labelled with the repository name and gets the configured tabs, by default `terminal` (a shell) and `agent` (running `claude`), both in the repository root.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/repo-open
```

## Keybinding

Bind the `open` action in herdr's `config.toml`, for example to `prefix+shift+f`:

```toml
[[keys.command]]
key = "prefix+shift+f"
type = "plugin_action"
command = "repo-open.open"
description = "open a repository"
```

Without a keybinding: `herdr plugin action invoke repo-open.open`, or the entry `repo-open · Open a repository` in `command-palette`.

## Repositories

Every directory below a root that contains `.git` (a directory, or a file for a worktree or submodule) is a repository, up to `depth` levels below the root. A repository is not searched for nested repositories; hidden directories, `node_modules` and symlinks are skipped, unreadable directories are ignored. A root that is itself a repository is listed too. Each repository shows its name and its path relative to the root.

## Configuration (config.json)

`$HERDR_PLUGIN_CONFIG_DIR/config.json` (`herdr plugin config-dir repo-open`), all keys optional:

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

| Key | Type | Default |
|:--|:--|:--|
| `roots` | non-empty array of paths, absolute or starting with `~/` | `["~/Source"]` |
| `depth` | integer from 1 to 10 | `3` |
| `tabs` | non-empty array of `{ "label", "command"?, "focus"? }`, labels unique | `terminal`, then `agent` with `claude` and `focus` |

`command` is typed into the tab's shell when the tab is created. The first tab marked `focus` is focused after opening, else the first tab. A missing file uses the defaults. Invalid JSON or an invalid value shows one hint line `config.json: <problem>` (`(+N more)` for further problems) in the popup; that key falls back to its default, the other keys still apply.

## Development

Config parsing is in `lib/config.ts`, the discovery in `lib/discover.ts`. Run the tests from the repository root with `npm test`.
