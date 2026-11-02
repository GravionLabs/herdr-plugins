# deliver-view

A herdr agent view "deliver" for parallel `/deliver` sessions. The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills) reports the pane tokens `deliver`, `deliver_step` and `deliver_pr` (source `deliver`). With several sessions running, the Agents list mixes them with other panes; this view puts the `deliver` sessions first.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-view
```

## What it does

The plugin sets the view with `agent.view.set` (source `plugin:deliver-view`, label `deliver`). All agents stay listed; the sort is:

1. `attention` descending: blocked agents on top.
2. Token `deliver` ascending: agents that carry the token come before the others (herdr sorts a missing value last).
3. `state_change_seq` descending: the most recent state change first.

herdr sorts are stable and compared one after the other, so the `deliver` token (a value like `#12`) orders the sessions among themselves and decides before step 3. A blocked agent without the token therefore also sits above the `deliver` sessions: that is the point of "blocked on top".

herdr keeps a view only until the server exits. The plugin saves it as `view.json` in `HERDR_PLUGIN_STATE_DIR` and a `[[startup]]` hook reapplies it (the default view when nothing was saved). The hook runs once after herdr restores the session.

## Actions

| Action | Effect |
|:--|:--|
| `apply` | Sets the view by hand and saves it for the startup hook |

```bash
herdr plugin action invoke deliver-view.apply
```

Edit `view.json` in the plugin state directory to change the sort; the startup hook applies it as stored. `apply` writes the default view again.

## Sidebar layout

The view orders the agents; the sidebar shows a token only where a row names it as `$<name>`. This layout from the `deliver` skill (`references/herdr.md`, "Sidebar layout") names the space (one per repository, as `repo-open` creates it) and its state first, then the agent and its terminal title, and puts the tokens in their own row. The plugin never writes your config; copy it into `config.toml` if you want it:

```toml
[ui.sidebar.agents]
rows = [
  ["state_icon", { token = "workspace", bold = true }, { token = "state_text", rules = [{ equals = "done", fg = "#5f5" }, { equals = "blocked", fg = "#f55" }] }],
  [{ token = "agent", dim = true }, "terminal_title_stripped"],
  [{ token = "$deliver", bold = true }, { token = "$deliver_step", rules = [{ contains = "blocked", fg = "#f55" }, { contains = "merged", fg = "#5f5" }] }, "$deliver_pr"],
]
```

## Requirements

- herdr 0.9.5 or later (`agent.view.set`), macOS or Linux.
- Node 26.

## Development

herdr 0.9.5 has no CLI command for `agent.view.set`, so `lib/view.ts` sends the request over the API socket in `HERDR_SOCKET_PATH`. `HERDR_BIN_PATH` is used to show a notification when applying fails. The entry points are `bin/apply.ts` and `bin/startup.ts`. Run the tests from the repository root with `npm test`; they use a fake socket server and a mock `HERDR_BIN_PATH`.
