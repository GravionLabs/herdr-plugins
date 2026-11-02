# herdr-plugins

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

## Contributing

How to build a plugin, the conventions, the tests and the release flow are in the [contributor guide](https://gravionlabs.github.io/herdr-plugins/guide/contributing).
