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

- Runtime: Node 24 (`engines.node` `>=24`, see `.nvmrc`). No runtime dependencies and no build step.
- Language: TypeScript. Node 24 strips the types of `.ts` files at run time, so a plugin's `herdr-plugin.toml` runs its entry point directly, e.g. `command = ["node", "bin/open.ts"]`. Type stripping does not apply under `node_modules`, and herdr installs plugins from git, so plugin code stays out of `node_modules`.
- Erasable syntax only (`erasableSyntaxOnly`): no `enum`, no `namespace`, no parameter properties. Use plain objects, unions and classes with explicit fields.
- Imports: relative imports carry the `.ts` extension (`import { x } from '../lib/trim.ts'`); type-only imports use `import type`, which `verbatimModuleSyntax` enforces.
- Install: `npm install`
- Type check: `npm run typecheck` runs `tsc` (TypeScript 7, native compiler) with `noEmit`. It runs in CI as the lint step.
- Test: `npm test` runs Vitest from the repository root over every plugin directory (`<plugin>/**/*.test.ts`) and `test/`.

## Conventions

- Plugin authoring: [herdr plugin docs](https://herdr.dev/docs/plugins/). Commands call herdr through `HERDR_BIN_PATH`; state goes to `HERDR_PLUGIN_STATE_DIR`, user config to `HERDR_PLUGIN_CONFIG_DIR`.
- Issues: `[Epic]`, `[Feature]`, `[PBI]`, `[Task]`, `[Bug]` titles, native sub-issues.
- Branches: work branches from and into `release/next`, release PR into `main`; conventional commits.
