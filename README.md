# herdr-plugins

[![CI](https://github.com/GravionLabs/herdr-plugins/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/GravionLabs/herdr-plugins/actions/workflows/release.yml)
[![Release](https://img.shields.io/github/v/release/GravionLabs/herdr-plugins)](https://github.com/GravionLabs/herdr-plugins/releases/latest)
[![License: MIT](https://img.shields.io/github/license/GravionLabs/herdr-plugins)](LICENSE)

Documentation: <https://gravionlabs.github.io/herdr-plugins/>

[herdr](https://herdr.dev) plugins for the GravionLabs agent workflow (the `deliver` skill of [GravionLabs/skills](https://github.com/GravionLabs/skills), successor of the archived apm-hub). Each plugin lives in its own directory with a `herdr-plugin.toml` and installs on its own:

```bash
herdr plugin install GravionLabs/herdr-plugins/<plugin>
```

## Plugins

| Plugin | Purpose | Status |
|:--|:--|:--|
| `link-trim` | Opens links without trailing `)`, `.`, `,` picked up by URL detection | available |
| `deliver-board` | Popup with the open PBIs, claims and PR state of `release/next` | available |
| `worktree-cleanup` | Removes worktrees and branches of merged PBIs | available |
| `agent-notify` | Notification when an agent pane turns done or blocked | available |
| `layout-bootstrap` | Opens a project workspace with agent, test and log panes | available |
| `review-popup` | Shows the last `deliver` review of the current branch | available |
| `deliver-starter` | Starts `/deliver` from a popup or an issue link, in a herdr worktree or through the loop | available |
| `deliver-view` | Agent view with the `deliver` sessions first, blocked ones on top | available |
| `deliver-log` | Shows or hides the log pane of `Invoke-DeliverLoop.ps1` | available |
| `command-palette` | Popup to search and run plugin actions and own commands with one key | available |
| `repo-open` | Popup to search a repository and open it as a workspace with its tabs | available |

Order and releases: [ROADMAP.md](ROADMAP.md).

## Setup script

`scripts/herdr-setup.ts` (Node 26) checks the machine and sets herdr up for the plugins. Run it from a clone of this repository:

| Command | What it changes |
|:--|:--|
| `node scripts/herdr-setup.ts doctor` | Nothing. Checks herdr, Node, `gh`, `pwsh`, the `deliver` skill, the settings below and the installed plugins. `--json` prints JSON. |
| `node scripts/herdr-setup.ts apply` | Adds the missing `config.toml` blocks after a diff and a backup, then runs `herdr server reload-config`. Never overwrites a key you set. `--dry-run` only shows the diff, `--yes` skips the question. |
| `node scripts/herdr-setup.ts install` | Runs `herdr plugin install -y --ref <tag>` per plugin at the latest release tag. `--ref <tag>` picks another tag, `--dry-run` only shows the plan. |

Example of `doctor`:

```text
$ node scripts/herdr-setup.ts doctor
ok   herdr: 0.9.5
ok   node: v26.13.0
ok   gh login: logged in
ok   ui.toast.delivery: herdr
ok   config: ~/.config/herdr/config.toml
...
```

More output examples: [Getting started](https://gravionlabs.github.io/herdr-plugins/guide/getting-started).

## herdr settings the plugins rely on

Some plugin features look broken when a herdr setting is off, and the cause is the setting, not the plugin. These settings live in herdr's `config.toml`; the plugins never write it. After a change, run `herdr server reload-config`.

To add the missing blocks (toast delivery, the "space first" sidebar rows, and keys for `deliver-starter.start`, `deliver-log.toggle` and `command-palette.open`), run `node scripts/herdr-setup.ts apply`. It shows a diff, writes a `config.toml.bak-<timestamp>` backup, asks, writes, and runs `herdr server reload-config`. It never changes a key you already set, except `ui.toast.delivery = "off"`. Use `--dry-run` to only see the diff and `--yes` to skip the question.

To install the plugins at the latest release tag (not the default branch), run `node scripts/herdr-setup.ts install [<plugin>…] [--ref <tag>] [--dry-run]`.

| Setting | Why it matters | Needed by |
|:--|:--|:--|
| `ui.toast.delivery` must not be `off` | Notifications. With `off`, `herdr notification show` still answers `shown`, but no notification appears. | agent-notify, command-palette, deliver-log, deliver-starter, layout-bootstrap, link-trim, repo-open, review-popup, worktree-cleanup |
| `ui.mouse_capture` on | Link handlers. A Ctrl+click reaches a plugin only with mouse capture on. | link-trim (Ctrl+click), deliver-starter (Ctrl+click on an issue link) |
| `[ui.sidebar.agents]` row with `$deliver`, `$deliver_step`, `$deliver_pr` | The `deliver` tokens show in the Agents sidebar only where a row names them. | deliver-view, and the `deliver` skill, which reports the tokens |

Snippets for `config.toml`:

```toml
[ui.toast]
delivery = "herdr"
```

```toml
[ui]
mouse_capture = true
```

The `[ui.sidebar.agents]` layout is in the next section.

### Agents sidebar layout ("space first")

The recommended layout puts the space first (with `repo-open` every repository is its own space): line 1 is the space (workspace) and the state, line 2 the agent and its terminal title, line 3 the `deliver` tokens. It is the layout of the [deliver-view README](deliver-view/README.md#recommended-layout-space-first).

```toml
[ui.sidebar.agents]
rows = [
  ["state_icon", { token = "workspace", bold = true }, { token = "state_text", rules = [{ equals = "done", fg = "#5f5" }, { equals = "blocked", fg = "#f55" }] }],
  [{ token = "agent", dim = true }, "terminal_title_stripped"],
  [{ token = "$deliver", bold = true }, { token = "$deliver_step", rules = [{ contains = "blocked", fg = "#f55" }, { contains = "merged", fg = "#5f5" }] }, "$deliver_pr"],
]
```

It looks like this for one `/deliver` session:

```
● herdr-plugins · idle
  claude · <terminal title>
  #121 · merged · #139
```

Alternatives:

- Compact two-line layout: keep the space and state row and the `deliver` tokens row, and drop the agent row.
- `deliver` line first: move the `$deliver` row above the space row.
- Spacing: add `row_gap = 1` under `[ui.sidebar.agents]` for a blank line between the rows.

## Contributing

How to build a plugin, the conventions, the tests and the release flow are in the [contributor guide](https://gravionlabs.github.io/herdr-plugins/guide/contributing) (also readable on GitHub: [docs/guide/contributing.md](docs/guide/contributing.md)).
