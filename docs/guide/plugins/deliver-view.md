# deliver-view

## Purpose

`deliver-view` sets a herdr agent view named `deliver` for parallel `/deliver` sessions. The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills) reports the pane tokens `deliver`, `deliver_step` and `deliver_pr`. With several sessions running, the Agents list mixes them with other panes; the view puts the `deliver` sessions first. It runs at herdr startup and when you invoke the `apply` action.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-view
```

Requirements:

- herdr 0.9.5 or later (`agent.view.set`). Platforms: macOS and Linux. Node 26.
- The `deliver` skill of GravionLabs/skills, which reports the pane tokens: `npx skills add GravionLabs/skills --skill deliver`.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `deliver-view.apply` | Sets the view by hand and saves it for the startup hook. |
| Startup hook | `startup` | Reapplies the saved view once after herdr restores the session (the default view when nothing was saved). |

The plugin declares no panes, no events and no link handlers.

The view is set with `agent.view.set` (source `plugin:deliver-view`, label `deliver`). All agents stay listed. The sort is:

1. `attention` descending: blocked agents on top.
2. Token `deliver` ascending: agents that carry the token come before the others (herdr sorts a missing value last).
3. `state_change_seq` descending: the most recent state change first.

herdr keeps a view only until the server exits, so the plugin saves it as `view.json` in `HERDR_PLUGIN_STATE_DIR`. A blocked agent without the token also sits above the `deliver` sessions.

`apply` needs no input:

```sh
herdr plugin action invoke deliver-view.apply
```

## Keybinding

The manifest ships no default keybinding and the README documents none. The view is applied at startup; use the command above for a manual apply.

## Configuration

None. The plugin reads no config file. To change the sort, edit `view.json` in the plugin state directory; the startup hook applies it as stored. `apply` writes the default view again.

The sidebar shows a token only where a row names it as `$<name>`. This layout from the `deliver` skill (`references/herdr.md`, "Sidebar layout") puts the tokens in their own row. The plugin never writes your config; copy it into herdr's `config.toml` if you want it:

```toml
[ui.sidebar.agents]
rows = [["state_icon", "agent", "state_text"], [{ token = "$deliver", bold = true }, { token = "$deliver_step", rules = [{ contains = "blocked", fg = "#f55" }, { contains = "merged", fg = "#5f5" }] }, "$deliver_pr"], ["workspace", "tab"]]
```

## Examples

Three agents are listed: two `/deliver` sessions that carry the `deliver` token and a plain shell pane without it. The `deliver` sessions come first, ordered among themselves by their token value, then the other agents by most recent state change.

One session becomes blocked: it moves to the top, because `attention` is compared first. A blocked agent without the token also sits above the `deliver` sessions.

After a herdr restart, the startup hook reapplies the saved view, so the order is back without a manual step.

## Troubleshooting

- **The view is gone after restarting herdr.** The startup hook runs once after herdr restores the session. Run `herdr plugin action invoke deliver-view.apply` to set it by hand.
- **The sessions are not ordered by `deliver`.** The `deliver` skill is not installed or does not report the `deliver` token. Install it with `npx skills add GravionLabs/skills --skill deliver`.
- **The sidebar does not show the tokens.** The view only orders agents. Add the `[ui.sidebar.agents]` layout from Configuration to `config.toml`.
- **A notification says applying the view failed.** herdr 0.9.5 has no CLI command for `agent.view.set`, so the plugin talks to the API socket in `HERDR_SOCKET_PATH`. Check that herdr is 0.9.5 or later and running.
- **My edit of `view.json` was overwritten.** `apply` writes the default view again.

## Preview

```text
[screenshot placeholder: the herdr Agents list with the "deliver" view active:
a blocked agent on top, then the deliver sessions with their step and PR tokens,
then the other agents]
```
