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

Order and releases: [ROADMAP.md](ROADMAP.md).

## Development

- Runtime: Node 26 (`engines.node` `>=26`, see `.nvmrc`). No runtime dependencies and no build step.
- Language: TypeScript. Node 26 strips the types of `.ts` files at run time, so a plugin's `herdr-plugin.toml` runs its entry point directly, e.g. `command = ["node", "bin/open.ts"]`. Type stripping does not apply under `node_modules`, and herdr installs plugins from git, so plugin code stays out of `node_modules`.
- Erasable syntax only (`erasableSyntaxOnly`): no `enum`, no `namespace`, no parameter properties. Use plain objects, unions and classes with explicit fields.
- Imports: relative imports carry the `.ts` extension (`import { x } from '../lib/trim.ts'`); type-only imports use `import type`, which `verbatimModuleSyntax` enforces.
- Install: `npm install`
- Type check: `npm run typecheck` runs `tsc` (TypeScript 7, native compiler) with `noEmit`. It runs in CI as the lint step.
- Test: `npm test` runs Vitest from the repository root over every plugin directory (`<plugin>/**/*.test.ts`) and `test/`.

## Conventions

- Plugin authoring: [herdr plugin docs](https://herdr.dev/docs/plugins/). Commands call herdr through `HERDR_BIN_PATH`; state goes to `HERDR_PLUGIN_STATE_DIR`, user config to `HERDR_PLUGIN_CONFIG_DIR`.
- Issues: `[Epic]`, `[Feature]`, `[PBI]`, `[Task]`, `[Bug]` titles, native sub-issues.
- Branches: work branches from and into `release/next`, release PR into `main`; conventional commits.

## Releases

- Work branches merge into `release/next`; the `Release branch` workflow keeps the release PR `release/next` → `main` open and current (`github-release` skill).
- A release is made by merging that release PR into `main` with a **merge commit, never squash**. The release commit on `release/next` carries `+semver: minor`, so GitVersion (`GitVersion.yml`) computes the next minor on `main`.
- On the push to `main`, `.github/workflows/release.yml` runs the tests, determines the version, commits `CHANGELOG.md` (git-cliff, `cliff.toml`) to `main`, tags `v<version>`, creates the GitHub Release and closes the issues the release delivered. The changelog commit is pushed with the `GH_PAT` secret (a repository admin, bypass actor of the `main` ruleset).
- Tags are `v<major>.<minor>.<patch>`, as in the other GravionLabs repositories.
- `v0.1.0` and `v0.2.0` were tagged by the release workflow; the GitHub milestones carry the same names as the tags (released content: [ROADMAP.md](ROADMAP.md#releases)).
