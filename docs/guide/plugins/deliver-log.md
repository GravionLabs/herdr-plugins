# deliver-log

## Purpose

`deliver-log` shows or hides the log pane of `Invoke-DeliverLoop.ps1`. herdr has no hide for a pane, so the `deliver` skill's `Switch-LogPane.ps1` closes and reopens it with the same content; the plugin binds that script to an action. It runs when you invoke the `toggle` action.

Only `Invoke-DeliverLoop.ps1` writes the log (`.agents/deliver-loop.ansi.log`, else `.agents/deliver-loop.log`, under the repository of the focused pane). `/deliver` started in a chat session writes none; its progress is in that session's pane. Without a log the action opens no pane and shows a notification with the reason.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-log
```

Requirements:

- The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills): `npx skills add GravionLabs/skills --skill deliver`. The plugin runs `pwsh -NoProfile -File <deliver-skill>/scripts/Switch-LogPane.ps1` from the installed skill, looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver`, `~/.agents/skills/deliver` (`<repo>` is the git toplevel of the focused pane's cwd). The plugin holds no copy of the script.
- PowerShell 7+ (`pwsh`).
- Platforms: macOS and Linux. Minimum herdr version: 0.9.5.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `deliver-log.toggle` | Shows or hides the log pane of `Invoke-DeliverLoop.ps1`. |
| Action | `deliver-log.toggle-log` | Deprecated alias of `toggle` on the same command. Removed in the next major version. |

The plugin declares no panes, no events and no link handlers.

`toggle` needs no input:

```sh
herdr plugin action invoke deliver-log.toggle
```

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `toggle` action in herdr's `config.toml`, for example to `prefix+shift+o` (`prefix+shift+l` swaps panes):

```toml
[[keys.command]]
key = "prefix+shift+o"
type = "plugin_action"
command = "deliver-log.toggle"
description = "toggle the deliver log pane"
```

If your keybinding still uses `deliver-log.toggle-log`, change it to `deliver-log.toggle`. The old name keeps working until the next major version.

## Configuration

None. The plugin reads no config file.

## Examples

An unattended run is going (`Invoke-DeliverLoop.ps1`, for example started by `deliver-starter` in unattended mode). Invoke `deliver-log.toggle`: the log pane is closed. Invoke it again: the pane opens with the same content.

In a repository where no loop wrote `.agents/deliver-loop.ansi.log` or `.agents/deliver-loop.log`, `toggle` opens no pane and shows a notification with the reason.

## Troubleshooting

- **A notification says how to install the `deliver` skill.** The skill was not found in any of the four lookup locations. Run `npx skills add GravionLabs/skills --skill deliver`.
- **No pane opens and a notification gives a reason.** No log exists. Only `Invoke-DeliverLoop.ps1` writes it; a `/deliver` run in a chat session does not.
- **A notification says `deliver-log: pwsh is not installed`.** `pwsh` (PowerShell 7+) is missing or not on `PATH`. Install PowerShell 7+ and make sure `pwsh` is on your `PATH`.
- **The keybinding stopped working after an upgrade.** It uses the deprecated `deliver-log.toggle-log`. Change it to `deliver-log.toggle`.
- **The wrong repository's log is used.** The repository is the one of the focused pane. Focus a pane in the repository you mean.

## Preview

```text
[screenshot placeholder: a herdr tab with the agent pane and, beside it, the log pane
showing the output of Invoke-DeliverLoop.ps1; after the toggle action the log pane is
closed, after a second toggle it is back with the same content]
```
