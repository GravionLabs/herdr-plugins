# herdr-plugins

[herdr](https://herdr.dev) plugins for the GravionLabs agent workflow (the `deliver` skill of [apm-hub](https://github.com/GravionLabs/apm-hub)). Each plugin lives in its own directory with a `herdr-plugin.toml` and installs on its own:

```bash
herdr plugin install GravionLabs/herdr-plugins/<plugin>
```

## Plugins

| Plugin | Purpose | Status |
|:--|:--|:--|
| `link-trim` | Opens links without trailing `)`, `.`, `,` picked up by URL detection | available |
| `deliver-board` | Popup with the open PBIs, claims and PR state of `release/next` | planned |
| `worktree-cleanup` | Removes worktrees and branches of merged PBIs | planned |
| `agent-notify` | Notification when an agent pane turns done or blocked | planned |
| `layout-bootstrap` | Opens a project workspace with agent, test and log panes | planned |
| `review-popup` | Shows the `code-review` result of the current branch | planned |
| `deliver-starter` | Asks for an issue number and starts `/deliver` in a new tab | planned |

Order and releases: [ROADMAP.md](ROADMAP.md).

## Development

- Runtime: Node 24 (`engines.node` `>=24`, see `.nvmrc`).
- Install: `npm install`
- Test: `npm test` runs Vitest from the repository root over every plugin directory (`<plugin>/**/*.test.{js,mjs}`) and `test/`.

## Conventions

- Plugin authoring: [herdr plugin docs](https://herdr.dev/docs/plugins/). Commands call herdr through `HERDR_BIN_PATH`; state goes to `HERDR_PLUGIN_STATE_DIR`, user config to `HERDR_PLUGIN_CONFIG_DIR`.
- Issues: `[Epic]`, `[Feature]`, `[PBI]`, `[Task]`, `[Bug]` titles, native sub-issues.
- Branches: work branches from and into `release/next`, release PR into `main`; conventional commits.
