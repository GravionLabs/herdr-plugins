# Public names per plugin (naming audit, #77)

Audit of every public name from ADR 0001 before 1.0. Rules: IDs are kebab-case; an action is named for what it does (`open`, `apply`, `start`, `toggle`, `cleanup`), without repeating the plugin name; `config.json` keys are camelCase. Old names stay as deprecated aliases and are removed in the next major version.

| Plugin | Actions | Panes | Events | Link handlers | Config keys |
| --- | --- | --- | --- | --- | --- |
| `agent-notify` | - | - | `pane.agent_status_changed` | - | `systemNotification` (was `system_notification`), `sound` |
| `command-palette` | `open` | `palette` | - | - | `commands` |
| `deliver-board` | `open` | `board` | - | - | - |
| `deliver-log` | `toggle` (was `toggle-log`) | - | - | - | - |
| `deliver-starter` | `start`, `start-link` | `form` | - | `github-issue` | `harness`, `mode`, `suggestLimit` |
| `deliver-view` | `apply` | - | - | - | - |
| `layout-bootstrap` | `apply` | - | - | - | `testCommand` |
| `link-trim` | `open` | - | - | `trailing-punct` | - |
| `repo-open` | `open` | `picker` | - | - | `roots`, `depth`, `tabs` |
| `review-popup` | `open` | `review` | - | - | - |
| `worktree-cleanup` | `cleanup` | - | `worktree.removed` | - | - |

## Renames applied

| Old | New | Alias |
| --- | --- | --- |
| `agent-notify` config `system_notification` | `systemNotification` | Old key still read; `systemNotification` wins when both are set; a warning goes to stderr. |
| `deliver-log` action `toggle-log` | `toggle` | Old action stays declared on the same command. |

## Upgrade guide

- Rename `system_notification` to `systemNotification` in the `agent-notify` `config.json`.
- Change keybindings from `deliver-log.toggle-log` to `deliver-log.toggle`.
- Both old names are removed in the next major release (`refactor!:` together with that removal, not before).

## Checked, kept

`start-link`, `github-issue`, `trailing-punct`, `cleanup`, `apply`, pane IDs and the other config keys already follow the rules.
