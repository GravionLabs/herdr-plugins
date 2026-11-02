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

## Popup

Action `open` opens the popup `picker` with a search field over the discovered repositories. If the popup cannot be opened, the action exits with code 1 and shows the notification "Could not open the repository picker". Enter closes the popup and opens the selected repository.

| Key | Action |
|:--|:--|
| type, Backspace | filter live, case-insensitive, on the name or the relative path (prefix first, then word starts such as `hp` for `herdr-plugins`, then scattered letters) |
| Up, Down, Ctrl+P, Ctrl+N | move the selection |
| Enter | open the selected repository, the popup closes |
| Escape, Ctrl+C | close (exit code 0, cursor and screen restored) |

Without any repository the list shows `No repositories below <roots>`.

## Opening

Enter closes the popup and starts a detached runner (`bin/run.ts`) for the repository:

- **Existing workspace:** a workspace with a pane inside the repository, else one labelled with the repository name whose panes are not elsewhere, is focused. Nothing is created or changed.
- **New workspace:** `workspace create --cwd <repo> --label <name>`; when another workspace already has that label (two repositories with the same name), the label is the relative path. The root tab is renamed to the first tab label; every further tab is created with the repository root as cwd. A tab with a `command` gets it typed into its shell. Then the `focus` tab (default `agent`) and the workspace are focused.
- The repository is recorded in `recent.json` only after it opened.
- A failing herdr call shows the notification `repo-open: <name> failed` with the reason as body.

## Recently opened

`$HERDR_PLUGIN_STATE_DIR/recent.json` holds `{ "<repository path>": { "count", "last" } }`. With an empty search, opened repositories come first by frecency (count, halved every 7 days since the last open), the others follow by name. With a search, usage only breaks ties between equal match quality. A missing or corrupt file counts as empty.

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

Config parsing is in `lib/config.ts`, the discovery in `lib/discover.ts`, filter, keys, view and history of the popup in `lib/filter.ts`, `lib/keys.ts`, `lib/view.ts` and `lib/recent.ts`; `bin/picker.ts` is the popup loop. The open step is in `lib/open.ts` (tests with a fake herdr runner that records the calls), `bin/run.ts` is the detached runner. Run the tests from the repository root with `npm test`.
