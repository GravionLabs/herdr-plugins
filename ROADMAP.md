# Roadmap

Order of work and release assignment for the open issues of Epic #10: Feature #1 (herdr plugins for the `deliver` workflow) and Feature #39 (`command-palette`). Updated 2026-10-31. Work runs on `release/next`, the release PR into `main` is the review point. Each release has a GitHub milestone named like its tag; GitVersion computes the next tag, so the next milestone is `0.3.0`. Runtime: Node 26.

## Order

Next release: **0.3.0**.

| Order | Issue | Plugin | Size | Depends on |
| ----- | ----- | ------ | ---- | ---------- |
| 1 | #45 | `docs(roadmap)`: align roadmap, README and milestones with the released tags | S | — |
| 2 | #36 | `deliver-starter`: suggest open issues when typing `#` in the start popup | S | — |
| 3 | #6 | `layout-bootstrap`: apply a project layout to a workspace | S | — |
| 4 | #40 | `command-palette`: plugin skeleton with action `open` and popup | S | — |
| 5 | #41 | `command-palette`: palette TUI with fuzzy filter and keyboard navigation | M | #40 |
| 6 | #42 | `command-palette`: list and run plugin actions | S | #41 |
| 7 | #43 | `command-palette`: own entries from `config.json` | S | #41, #42 |
| 7 | #44 | `command-palette`: rank recently used entries first | S | #42 |
| 8 | #4 | `review-popup`: show the code-review result of the current branch | M | skills#53 |

Unscheduled: #18 (`ci`: adopt the bundled `pr-checks.yml`, waits for GravionLabs/ci#92).

## Releases

| Tag | Released | Tag commit | Release PR | Content |
| --- | -------- | ---------- | ---------- | ------- |
| `v0.1.0` | 2026-10-31 | `3e37625` | #35 | repository setup (#11), TypeScript 7 (#16), Node 26 (#21), release workflow (#19), `link-trim` (#8), `deliver-board` (#2), `worktree-cleanup` (#7), `deliver-log` (#23), `agent-notify` (#5), `deliver-starter` (#3) |
| `v0.2.0` | 2026-10-31 | `c9f11ba` | #38 | `deliver-view` (#22) |

Release notes: [CHANGELOG.md](CHANGELOG.md) and the GitHub Releases. The earlier plan tagged the first two merges into `main` (`b18dc98`, `a3ecd7c`) as 0.1.0 and 0.2.0 by hand; that backfill was not done, the release workflow tagged the releases above instead, and the milestones were renamed to match (#45).

`skills#<n>` is an issue of [GravionLabs/skills](https://github.com/GravionLabs/skills): `review-popup` reads the review file that the `deliver` skill writes (skills#53).

## Why this order

- **#45 first**: the roadmap, README and milestones describe the released state before new work lands on it.
- **#36 next**: small follow-up to the shipped `deliver-starter` popup, used in every delivery.
- **#6 before `command-palette`**: small and independent; the manual splits work today, so it is a quick win rather than a blocker.
- **`command-palette` (#40 → #44)**: one key instead of one keybinding per action. #40 settles how a run reaches the original pane; #42 builds the runner that #43 reuses; #44 ranks on top of #42.
- **#4 last**: blocked by skills#53 (the `deliver` skill writes the review result to a file); it moves up as soon as that ships.

## Open decisions

None open. Decided during refinement:

| Issue | Decision |
| ----- | -------- |
| #4 | Source of the review result: a file written by `deliver` (skills#53), no own review, no PR comment |
| #39 | `command-palette`: own entries in `config.json`, the popup closes before an entry runs, one global usage history |
| #45 | Released tags are the source of truth; milestones renamed to match, published tags untouched |
