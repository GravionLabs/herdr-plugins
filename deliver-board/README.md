# deliver-board

A popup with the delivery state of the current repository: the open PBIs, who claimed them, their branch and their PR into `release/next` with the check status. `deliver` keeps all of that in GitHub (claims by assignee, branches, PRs, labels); with several parallel sessions the board is the one place that shows which PBI runs where. It only reads, it never writes.

## Install

```bash
herdr plugin install -y --ref <tag> GravionLabs/herdr-plugins/deliver-board
```

`<tag>` is a release tag, for example `v0.5.0`; see [Install](https://gravionlabs.github.io/herdr-plugins/guide/install).

## Keybinding

Bind the `open` action in herdr's `config.toml`, for example to `prefix+shift+b` (`prefix+b` toggles the sidebar):

```toml
[[keys.command]]
key = "prefix+shift+b"
type = "plugin_action"
command = "deliver-board.open"
description = "deliver board"
```

Without a keybinding: `herdr plugin action invoke deliver-board.open`.

## Requirements

- [GitHub CLI](https://cli.github.com) `gh`, logged in with `gh auth login`. Without `gh` or without a login the board shows one error line.
- `git`. The repository is the one of the focused pane's cwd; outside a git repository the popup says so and closes on any key.

## What it shows

One row per open issue labelled `pbi`, ordered by number:

| Column | Source |
|:--|:--|
| PBI, Title | REST issues API filtered by label `pbi` (cached, ETag) |
| Assignee | the claim: the issue's assignees |
| Labels | `needs-decision`, `in-progress` and `merged`; other labels are left out |
| Branch | the pushed `<type>/<nr>-*` branch (`git ls-remote --heads origin`), or the PR's head branch |
| PR | the PR into `release/next` from a `<type>/<nr>-*` branch; an open PR wins over a merged or closed one, whose state is shown next to the number |
| Checks | the PR's checks in the buckets of `gh pr checks`: failed, pending, passed, skipped |

## Keys

| Key | Action |
|:--|:--|
| `j` / `k`, arrow keys | move the selection |
| Enter | open the PR of the row in the browser, or the issue when there is no PR |
| `r` | refresh |
| `q`, Escape | close |

## The data action

`herdr plugin action invoke` is for people; programs (poimen's native deliver board) run the `data` action's command from `plugin.list` directly: `node bin/data.ts --cwd <repository>` in the plugin directory. It prints one JSON document on stdout and uses the same rows, `gh` calls and 30 s cache as the popup. It runs no write command.

```json
{
  "version": 1,
  "plugin": "deliver-board",
  "generated": "2026-11-02T10:00:00.000Z",
  "data": {
    "repo": "GravionLabs/poimen",
    "rows": [
      {
        "number": 42, "title": "...", "url": "https://github.com/GravionLabs/poimen/issues/42",
        "assignee": "jkaufmann", "labels": ["in-progress"], "branch": "docs/42-adr",
        "pr": { "number": 150, "url": "...", "state": "OPEN",
                "checks": { "state": "pending", "passed": 3, "failed": 0, "pending": 1, "skipped": 0 } }
      }
    ]
  }
}
```

- `version` is the major version of the contract (`1`). Fields are only added within a version; a change that removes or renames a field raises it.
- `repo` is `owner/name` of `origin`, or `null` when it is not a GitHub remote. `rows` is ordered by PBI number.
- `assignee` is the comma-separated claim (`""` when unclaimed); `labels` only `needs-decision`, `in-progress`, `merged`; `branch` and `pr` are `null` when there is none. The row `url` is the PR when there is one, else the issue.
- `pr.state` is `OPEN`, `MERGED` or `CLOSED`; `checks.state` is `passing`, `failing`, `pending` or `none`.
- On failure the exit code is 1 and the output is `{ "version": 1, "plugin": "deliver-board", "error": { "code": "...", "message": "..." } }`. Codes: `invalid_arguments`, `not_a_repository`, `gh_failed`, `rate_limited`, `invalid_gh_output`.

## Development

Parsing of the `gh` and `git` output lives in `lib/board.ts`, the repository lookup and error wording in `lib/context.ts`, keys and rendering in `lib/view.ts`; all run without herdr. The `data` action is `bin/data.ts` with `lib/data.ts`. The action entry point is `bin/open.ts`, which opens the `board` pane (`bin/board.ts`) as a popup and passes the focused pane's cwd on. The tests in `test/` run against `gh` JSON recorded in `test/fixtures/`. Run them from the repository root with `npm test`.

## API load

The open PBIs come from the REST issues API (`gh api repos/{owner}/{repo}/issues?labels=pbi`), revalidated with an ETag; the PR list (`gh pr list`, GraphQL) is cached. Both are cached for 30 seconds under `HERDR_PLUGIN_STATE_DIR/gh-cache`, so `r` within that time makes no call. When the rate limit is exhausted, the board shows `GitHub rate limit exceeded, resets at HH:MM` (local time) and a herdr notification. `lib/ghcache.ts` is copied into `deliver-starter`; a test keeps the copies equal.
