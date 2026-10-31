# deliver-log

Shows or hides the log pane of `Invoke-DeliverLoop.ps1`. herdr has no hide for a pane, so the `deliver` skill's `Switch-LogPane.ps1` closes and reopens it with the same content; this plugin binds that script to an action.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-log
```

## Keybinding

Bind the `toggle-log` action in herdr's `config.toml`, for example to `prefix+shift+l`:

```toml
[[keys.command]]
key = "prefix+shift+l"
type = "plugin_action"
command = "deliver-log.toggle-log"
description = "toggle the deliver log pane"
```

Without a keybinding: `herdr plugin action invoke deliver-log.toggle-log`.

## Requirements

- The `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills): `npx skills add GravionLabs/skills --skill deliver`. The plugin runs `pwsh -NoProfile -File <deliver-skill>/scripts/Switch-LogPane.ps1` from the installed skill, looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver`, `~/.agents/skills/deliver` (`<repo>` is the git toplevel of the focused pane's cwd). Without it a notification says how to install it. The plugin holds no copy of the script.
- PowerShell 7+ (`pwsh`).

## Development

Command in `lib/toggle.ts`, skill lookup in `lib/skill.ts` (same lookup and test cases as `worktree-cleanup` and `deliver-starter`), action logic in `lib/action.ts`, entry point `bin/toggle-log.ts`. Run the tests from the repository root with `npm test`.
