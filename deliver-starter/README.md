# deliver-starter

Starts `/deliver` from herdr: a popup asks for the arguments and the mode, and a click on a GitHub issue link starts the interactive run for that issue.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-starter
```

## Keybinding

Bind the `start` action in herdr's `config.toml`, for example to `prefix+d` (`prefix+shift+d` closes the workspace):

```toml
[[keys.command]]
key = "prefix+d"
type = "plugin_action"
command = "deliver-starter.start"
description = "start /deliver"
```

Without a keybinding: `herdr plugin action invoke deliver-starter.start`.

## Use

- **Popup** (action `start`): type the arguments of `/deliver`, one or more issue numbers (`3 4`) or `--milestone <name>`; `Tab` switches between `interactive` and `unattended`; `Enter` starts; empty input or `Esc` closes without starting. Every number is checked with `gh issue view`: it must exist, be open and be a PBI, Bug, Feature or Epic (title prefix or label), the levels `/deliver` accepts. Otherwise the popup shows the reason and stays open.
- **Issue suggestions**: typing `#` (then optionally the start of a number or title text) lists the open Epics, Features, PBIs and Bugs of the repository of the focused pane, filtered live. `Up`/`Down` move, `Enter` inserts the number into the argument line (repeat for several), `Esc` closes the list (a second `Esc` closes the popup). Each row shows number, level and title; `[needs-refinement]`, `[needs-decision]` and `[@assignee]` mark issues but do not hide them. The list is loaded once per popup with one `gh issue list` call (`suggestLimit` in the config). If `gh` fails or is offline, the popup works without suggestions and shows the reason when `#` is typed.
- **Level filter**: `Ctrl+L` cycles the `#` list through all levels, Epic, Feature, PBI and Bug. The header above the list shows the active filters, e.g. `Level: PBI (Ctrl+L) · Milestone: 0.4.0`.
- **Milestone picker**: typing `@` (then optionally part of a name) lists the open milestones of the repository with their open and closed counts and due date, filtered live. The current milestone (the lowest `x.y.z` milestone with open work, as `github-milestone current`) is marked `current` and listed first; the others follow by version, names that are not a version last. `Up`/`Down` move, `Enter` replaces the argument line by `--milestone <name>` (quoted when the name has spaces), `Esc` closes the list. `Enter` again starts the whole milestone.
- **Single items of a milestone**: after a milestone was chosen, the `#` list shows only the open work items of that milestone. Picking one replaces `--milestone <name>` by its number (`/deliver` takes either numbers or a milestone), further picks add numbers; the milestone filter stays. Clearing the argument line clears the milestone filter and restores the full list.
- The milestones are loaded once per popup with one `gh api repos/{owner}/{repo}/milestones` call next to the issue list. If it fails, the popup works without them and shows the reason when `@` is typed.
- **Interactive**: `herdr worktree create --branch deliver/<first nr> --base origin/release/next --focus` from the repository of the focused pane, then the root pane of the worktree runs `claude '/deliver <args>'`. For a milestone the branch is `deliver/milestone-<name>`.
- **Unattended**: a new tab `deliver #<nr>` at the repository root runs `pwsh <deliver-skill>/scripts/Invoke-DeliverLoop.ps1 -Target <nr…>` (or `-Milestone <name>`).
- **Link handler**: `Ctrl`+click on `https://github.com/<owner>/<repo>/issues/<nr>` starts the interactive run for that issue without the popup (needs `ui.mouse_capture`). The issue is checked like in the popup; a failure shows a notification. The repository is the one of the focused pane, so click links of the repository you are in.

The worktree stays after the run. Remove it with `herdr worktree remove` or let `worktree-cleanup` remove the worktrees of merged PBIs. The branch is not deleted by `herdr worktree remove`.

## Config

`$HERDR_PLUGIN_CONFIG_DIR/config.json` (`herdr plugin config-dir deliver-starter`), all keys optional:

```json
{ "harness": "claude", "mode": "interactive", "suggestLimit": 100 }
```

| Key | Default | Meaning |
|:--|:--|:--|
| `harness` | `claude` | Command that starts the agent in the interactive worktree; may carry flags, e.g. `claude --model opus`. It receives `'/deliver <args>'` as its argument. |
| `mode` | `interactive` | Mode preselected in the popup: `interactive` or `unattended`. |
| `suggestLimit` | `100` | Maximum number of open issues loaded for the `#` suggestions (`--limit` of `gh issue list`); a positive integer. |

A missing or broken file, or a wrong value, falls back to the default of that key. The file is checked against `schema/config.schema.json`; the popup shows the first problem naming file and key (for example `config.json: mode: must be one of "interactive", "unattended"`).

## Requirements

- herdr 0.9.5 or newer (`min_herdr_version`: worktrees, popup panes and link handlers).
- [GitHub CLI](https://cli.github.com) `gh`, logged in with `gh auth login`.
- The harness command (default `claude`) on `PATH`.
- Unattended mode: the `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills), `npx skills add GravionLabs/skills --skill deliver`, and PowerShell 7+ (`pwsh`). The skill is looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver`, `~/.agents/skills/deliver` (`<repo>` is the git toplevel of the focused pane's cwd). Without it a notification says how to install it.

## Development

Argument parsing in `lib/args.ts`, link URL in `lib/link.ts`, config in `lib/config.ts`, commands in `lib/command.ts`, issue check in `lib/issue.ts`, start logic in `lib/start.ts` and `lib/link-start.ts`, popup state in `lib/form.ts`, issue suggestions in `lib/suggest.ts`, milestone picker in `lib/milestones.ts`, skill lookup in `lib/skill.ts` (same lookup and test cases as `worktree-cleanup` and `deliver-log`). Entry points in `bin/`. Run the tests from the repository root with `npm test`.
