# deliver-starter

## Purpose

`deliver-starter` starts `/deliver` from herdr. A popup asks for the arguments and the mode, and a Ctrl+click on a GitHub issue link starts the interactive run for that issue.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/deliver-starter
```

Requirements:

- herdr 0.9.5 or newer (`min_herdr_version`: worktrees, popup panes and link handlers). Platforms: macOS and Linux.
- [GitHub CLI](https://cli.github.com) `gh`, logged in with `gh auth login`.
- The harness command (default `claude`) on `PATH`.
- `ui.mouse_capture` on in herdr's `config.toml` for the link handler.
- Unattended mode only: the `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills), installed with `npx skills add GravionLabs/skills --skill deliver`, and PowerShell 7+ (`pwsh`). The skill is looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver`, `~/.agents/skills/deliver` (`<repo>` is the git toplevel of the focused pane's cwd). Without it a notification says how to install it.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `deliver-starter.start` | Opens the `form` popup to start `/deliver`. |
| Action | `deliver-starter.start-link` | Starts the interactive run for a clicked issue link. Reached only through the `github-issue` link handler. |
| Pane | `form` | Popup (70% wide, 40% high) for the arguments and the mode. |
| Link handler | `github-issue` | Routes `https://github.com/<owner>/<repo>/issues/<nr>` links to `start-link`. |

The plugin declares no events.

`start-link` needs the clicked URL from the link handler, so do not invoke it by hand. `start` needs no input, because the popup asks for it:

```sh
herdr plugin action invoke deliver-starter.start
```

### The popup

- Type the arguments of `/deliver`: one or more issue numbers (`3 4`) or `--milestone <name>`.
- `Tab` switches between `interactive` and `unattended`. `Enter` starts. Empty input or `Esc` closes without starting.
- Every number is checked with `gh issue view`: it must exist, be open and be a PBI, Bug, Feature or Epic (title prefix or label). Otherwise the popup shows the reason and stays open.
- Typing `#` (then optionally the start of a number or title text) lists the open Epics, Features, PBIs and Bugs of the repository of the focused pane, filtered live. `Up`/`Down` move, `Enter` inserts the number, `Esc` closes the list (a second `Esc` closes the popup). `[needs-refinement]`, `[needs-decision]` and `[@assignee]` mark issues but do not hide them.
- `Ctrl+L` cycles the `#` list through all levels, Epic, Feature, PBI and Bug.
- Typing `@` lists the open milestones with their open and closed counts and due date. The current milestone (the lowest `x.y.z` milestone with open work) is marked `current` and listed first. `Enter` replaces the argument line by `--milestone <name>`, quoted when the name has spaces. `Enter` again starts the whole milestone.
- After a milestone was chosen, the `#` list shows only the open work items of that milestone. Picking one replaces `--milestone <name>` by its number. Clearing the argument line clears the milestone filter.

### What a start does

- **Interactive:** `herdr worktree create --branch deliver/<first nr> --base origin/release/next --focus` from the repository of the focused pane, then the root pane of the worktree runs `claude '/deliver <args>'`. For a milestone the branch is `deliver/milestone-<name>`.
- **Unattended:** a new tab `deliver #<nr>` at the repository root runs `pwsh <deliver-skill>/scripts/Invoke-DeliverLoop.ps1 -Target <nr…>` (or `-Milestone <name>`).

The worktree stays after the run. Remove it with `herdr worktree remove` or let `worktree-cleanup` remove the worktrees of merged PBIs. `herdr worktree remove` does not delete the branch.

### Restrictions

- Milestone names are typed into the new pane's shell inside single quotes, so `;`, `&`, `$()` and spaces stay literal. A name with `'`, `"`, `\`, a typographic single quote or a control character is refused with `Milestone name must not contain <char>`, because those can end or escape the quoting in some shells (fish, PowerShell).
- The link handler accepts only strict GitHub owner and repository names (letters, digits, `-`, `.`, `_`; not `.` or `..`). Any other clicked text is not started.

## Keybinding

The manifest ships no default keybinding. The README suggests binding the `start` action in herdr's `config.toml`, for example to `prefix+d` (`prefix+shift+d` closes the workspace):

```toml
[[keys.command]]
key = "prefix+d"
type = "plugin_action"
command = "deliver-starter.start"
description = "start /deliver"
```

The link handler is triggered by Ctrl+click on an issue link and needs no keybinding.

## Configuration

`$HERDR_PLUGIN_CONFIG_DIR/config.json` (`herdr plugin config-dir deliver-starter`). All keys are optional. The schema is `schema/config.schema.json` in the plugin directory.

```json
{ "harness": "claude", "mode": "interactive", "suggestLimit": 100 }
```

| Key | Default | Meaning |
| --- | --- | --- |
| `harness` | `claude` | Command that starts the agent in the interactive worktree. It may carry flags, e.g. `claude --model opus`, and receives `'/deliver <args>'` as its argument. |
| `mode` | `interactive` | Mode preselected in the popup: `interactive` or `unattended`. |
| `suggestLimit` | `100` | Maximum number of open issues loaded for the `#` suggestions; a positive integer. |

A missing or broken file, or a wrong value, falls back to the default of that key. The popup shows the first problem naming file and key, for example `config.json: mode: must be one of "interactive", "unattended"`.

## Examples

Start two issues interactively: invoke `deliver-starter.start`, type `3 4`, press `Enter`. A worktree on branch `deliver/3` is created from `origin/release/next` and its root pane runs `claude '/deliver 3 4'`.

Start a whole milestone: type `@`, pick `0.4.0` with `Enter`, press `Enter` again. The argument line is `--milestone 0.4.0` and the branch is `deliver/milestone-0.4.0`.

Start one issue from a link: Ctrl+click `https://github.com/GravionLabs/herdr-plugins/issues/99` in a pane of that repository. The issue is checked like in the popup and the interactive run starts without the popup. A failure shows a notification.

Use another harness: set `{ "harness": "claude --model opus" }` in `config.json`.

API load: the issue list and the milestone list are loaded once per popup through the REST API (`gh api repos/{owner}/{repo}/issues` and `.../milestones`), not GraphQL. Answers are cached for 30 seconds under `HERDR_PLUGIN_STATE_DIR/gh-cache` and then revalidated with an ETag, so an unchanged list costs no rate limit.

## Troubleshooting

- **The popup shows a reason and stays open.** The issue does not exist, is closed, or is not a PBI, Bug, Feature or Epic. Fix the number.
- **No suggestions after typing `#` or `@`.** `gh` failed or is offline. The popup works without suggestions and shows the reason when you type `#` or `@`.
- **`GitHub rate limit exceeded, resets at HH:MM`.** The GitHub rate limit is exhausted (local time). A herdr notification is shown too. Wait for the reset.
- **`Milestone name must not contain <char>`.** The name has a quote, backslash, typographic single quote or control character. Rename the milestone or start by issue numbers.
- **Ctrl+click on an issue link does nothing.** `ui.mouse_capture` is off, or the link is not a `https://github.com/<owner>/<repo>/issues/<nr>` link with a valid owner and repository. The repository used is the one of the focused pane, so click links of the repository you are in.
- **A notification says how to install the `deliver` skill.** Unattended mode needs the skill and `pwsh`. Run `npx skills add GravionLabs/skills --skill deliver`.
- **`config.json: ...` in the popup.** A config value is wrong. Fix the named key; until then its default is used.
- **The harness does not start.** The harness command is not on `PATH`.

## Preview

```text
[screenshot placeholder: a popup titled "Start /deliver" with an argument line "3 4",
the mode "interactive" (Tab switches), and below the line a "#" suggestion list
with rows showing number, level and title]
```
