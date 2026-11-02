# Contributing

How to build a plugin in this repository: the runtime, the conventions, the tests and the release flow. The plugin list and the install command are on the [home page](../index.md) and in the [README](https://github.com/GravionLabs/herdr-plugins#readme).

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
- Work PRs into `release/**` are **squash** merged; their PR title must be a Conventional Commit (`pr-checks` title job) and becomes the one commit of the change.
- A release is made by merging that release PR into `main` with a **merge commit, never squash** (the `main` ruleset allows only merge commits), so GitVersion sees every commit. A hotfix PR into `main` is merged the same way, and every commit of it must be a Conventional Commit.
- The version comes from Conventional Commits (`versioning/determine-version` of GravionLabs/ci, `GitVersion.yml`): `fix:`/`perf:`/`revert:` → patch, `feat:` → minor, `type!:` or `BREAKING CHANGE:` → major. A release with only fixes is a patch, one with a `feat:` a minor.
- While the version is 0.x, use **no** `!` and no `BREAKING CHANGE:` until 1.0 is intended: either one jumps the version to 1.0.0.
- On the push to `main`, `.github/workflows/release.yml` runs the tests, determines the version, commits `CHANGELOG.md` (git-cliff, `cliff.toml`) to `main`, tags `v<version>`, creates the GitHub Release and closes the issues the release delivered. The changelog commit is pushed with the `GH_PAT` secret (a repository admin, bypass actor of the `main` ruleset).
- Tags are `v<major>.<minor>.<patch>`, as in the other GravionLabs repositories.
- `v0.1.0` and `v0.2.0` were tagged by the release workflow; the GitHub milestones carry the same names as the tags (released content: [ROADMAP.md](https://github.com/GravionLabs/herdr-plugins/blob/main/ROADMAP.md#releases)).
