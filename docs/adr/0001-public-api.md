# 0001: The public API covered by SemVer

Status: Accepted

## Context

This repository versions with SemVer (Conventional Commits drive the version, see `GitVersion.yml`). Version 1.0.0 promises that users can upgrade within 1.x without touching their herdr setup. That needs a written list of what users and herdr depend on. The surface below is read from every `*/herdr-plugin.toml` and every `lib/config.ts` as of 0.3.0.

## Decision

The repository is versioned as one unit. The following is the public API; changing it follows the mapping in "Versioning rules".

### Plugin, action, pane, event and link IDs

The IDs are what users bind to keys and what herdr stores. The plugin ID is also the directory name.

| Plugin | Actions | Panes | Events | Link handlers | Startup |
| --- | --- | --- | --- | --- | --- |
| `agent-notify` | - | - | `pane.agent_status_changed` | - | - |
| `command-palette` | `open` | `palette` | - | - | - |
| `deliver-board` | `open` | `board` | - | - | - |
| `deliver-log` | `toggle-log` | - | - | - | - |
| `deliver-starter` | `start`, `start-link` | `form` | - | `github-issue` | - |
| `deliver-view` | `apply` | - | - | - | one `[[startup]]` hook |
| `layout-bootstrap` | `apply` | - | - | - | - |
| `link-trim` | `open` | - | - | `trailing-punct` | - |
| `review-popup` | `open` | `review` | - | - | - |
| `worktree-cleanup` | `cleanup` | - | `worktree.removed` | - | - |

Also public: the `pattern` and `action` of each link handler (which links a handler claims), and the `placement` of each pane. Titles, descriptions, pane `width`/`height` and plugin `version` are not public.

### `config.json` (in `HERDR_PLUGIN_CONFIG_DIR`)

Unknown keys are ignored. A missing, broken or mistyped value falls back to the default, so adding a key never breaks an existing file.

| Plugin | Key | Type | Default |
| --- | --- | --- | --- |
| `agent-notify` | `system_notification` | boolean | `false` |
| `agent-notify` | `sound` | boolean | `false` |
| `command-palette` | `commands` | array of `{ title: string, command: string[], cwd?: string }` | none |
| `deliver-starter` | `harness` | non-empty string | `"claude"` |
| `deliver-starter` | `mode` | `"interactive"` or `"unattended"` | `"interactive"` |
| `deliver-starter` | `suggestLimit` | integer >= 1 | `100` |
| `layout-bootstrap` | `testCommand` | non-empty string | none |

`layout-bootstrap` also reads a layout file (`layout.json` in the config directory, or `.agents/herdr-layout.json` in the repository): `{ "panes": [{ "name", "command"?, "split": { "from"?, "direction": "right"|"down", "ratio"? } }] }`. Its keys and types are public with the same rules.

### State files (in `HERDR_PLUGIN_STATE_DIR`)

| Plugin | File | Format |
| --- | --- | --- |
| `agent-notify` | `seen.json` | object, pane-and-state key to timestamp (number) |
| `command-palette` | `recent.json` | object, entry key to `{ count: number, last: number }` |
| `deliver-view` | `view.json` | the saved herdr agent view object |

Newer versions must read files written by older 1.x versions. A reader may ignore unknown fields and may reset a file it cannot read.

### Event behaviour

- `agent-notify` notifies when an agent pane turns `done` or `blocked`, once per pane and state within 30 seconds.
- `worktree-cleanup` removes the worktree and local branch of a removed worktree only when its PBI is merged and every commit is on a remote branch.
- Plugins read herdr's input from the documented environment (`HERDR_PLUGIN_EVENT_JSON`, `HERDR_PLUGIN_CONTEXT_JSON`, `HERDR_PLUGIN_CONFIG_DIR`, `HERDR_PLUGIN_STATE_DIR`, `HERDR_SOCKET_PATH`).

### Runtime requirements

- `min_herdr_version`: `0.9.5`.
- Node.js: `>=26` (`engines` in `package.json`, `.nvmrc`).
- Supported OS: `macos` and `linux` (`platforms` in every manifest).

### Not public

- Everything under `*/lib/` (internal modules, exports, types) and `*/bin/` file names beyond the manifest commands.
- Log, stderr and popup output text, layout and colours.
- Pane sizes, titles and descriptions in the manifests.
- Tests, CI, scripts, the CHANGELOG format and dev dependencies.
- The review JSON schemas of `review-popup` are not covered until they are published (separate decision).

## Versioning rules

| Change | Bump |
| --- | --- |
| Bug fix, internal refactor, docs, change to a non-public item | patch |
| New plugin, action, pane, event, link handler | minor |
| New optional `config.json` key with a default, new optional state field | minor |
| Higher `min_herdr_version` or newer Node version that drops no supported OS | minor, called out in the release notes |
| Removing or renaming a plugin, action, pane, event or link handler ID | major |
| Removing or renaming a `config.json` key, or changing its type or default meaning | major |
| State file change that older data cannot be read by the new version | major |
| Changing which events or links a plugin handles, or its documented event behaviour | major |
| Dropping a supported OS | major |

A deprecation keeps the old name working for at least one minor release before the major that removes it.

## Consequences

- Renames (planned separately) must land before 1.0.0, because afterwards they are major bumps.
- Every PR that touches the table above states the bump in its Conventional Commit type (`feat`, `fix`, `!`).
- Changes to this list need a new ADR that supersedes this one.
