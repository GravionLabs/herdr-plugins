# Roadmap

Order of work and release assignment for the open issues of Feature #1. Written 2026-10-31. Work runs on `release/next`, the release PR into `main` is the review point. Releases are cut per milestone below; each release has a GitHub milestone of the same name. Runtime: Node 26 (switched from 24 on 2026-10-31, #21).

## Order

| Order | Release | Issue | Plugin | Size | Depends on |
| ----- | ------- | ----- | ------ | ---- | ---------- |
| 1 | 0.1.0 | #11 | repository setup: Node 24, Vitest, CI and the `GravionLabs/ci` issue, project and release-branch workflows | S | — |
| 2 | 0.1.0 | #8 | `link-trim`: open links without trailing punctuation | S | #11 |
| 3 | 0.2.0 | #16 | `chore(repo)`: TypeScript 7 for plugin development (type check only, Node runs `.ts` directly) | S | #11 |
| 4 | 0.2.0 | #21 | `chore(repo)`: Node 26 as runtime | S | #11 |
| 5 | 0.3.0 | #19 | `ci(repo)`: tag, changelog and GitHub Release on `main`; tags 0.1.0 and 0.2.0 afterwards | S | #11 |
| 6 | 0.3.0 | #5 | `agent-notify`: notification when an agent pane is done or blocked; `deliver` panes named by their tokens | S | #11, #16, skills#16 |
| 7 | 0.3.0 | #7 | `worktree-cleanup`: remove worktrees and branches of merged PBIs | S | #11, #16 |
| 8 | 0.3.0 | #3 | `deliver-starter`: start `/deliver` from a popup or an issue link, interactive in a herdr worktree or through the loop | M | #11, skills#16 |
| 8 | 0.3.0 | #22 | `deliver-view`: agent view with the `deliver` sessions first, blocked on top | S | skills#16 |
| 8 | 0.3.0 | #23 | `deliver-log`: action `toggle-log` for the log pane of `Invoke-DeliverLoop.ps1` | S | skills#13 |
| 9 | 0.3.0 | #2 | `deliver-board`: popup with PBIs, claims and PR state | M | #11, after #3 |
| 10 | 0.4.0 | #6 | `layout-bootstrap`: apply a project layout to a workspace | S | #11 |
| 11 | 0.4.0 | #4 | `review-popup`: show the code-review result of the current branch | M | #11, decision in #4 |

## Releases

- **0.1.0** (#11, #8): merged into `main` with #15 on 2026-10-31.
- **0.2.0** (#16, #21, plus the takeover of GravionLabs/skills#17 in #24): release PR #26. #5 and #7 moved to 0.3.0 so the TypeScript and Node 26 base ships first.
- Neither release has a tag, changelog or GitHub Release yet: the repository has no release workflow on `main`. #19 adds it and tags both afterwards.

`skills#<n>` is an issue of [GravionLabs/skills](https://github.com/GravionLabs/skills): the `deliver` skill provides the pane tokens (skills#16) and `Switch-LogPane.ps1` (skills#13). #3, #22 and #23 took over GravionLabs/skills#17 (2026-10-31); the plugins live here, the scripts they call stay in the skill.

## Why this order

- **#11 first**: runtime, test setup, CI and the issue/project/release workflows are set up once; every plugin PBI is blocked by it. Split from #8 so the plugins can start in parallel.
- **#8 next**: smallest plugin with an everyday annoyance behind it.
- **#16 before #5 and #7**: the TypeScript setup (type check with TypeScript 7, `.ts` entry points run by Node 26) is the base the plugins after 0.1.0 are written on.
- **#21 with #16**: switching the runtime before the next plugins are written avoids touching them twice.
- **#19 first in 0.3.0**: every release from 0.3.0 on gets its tag, changelog and GitHub Release on merge; the two releases before it are tagged once afterwards.
- **#5 and #7 next**: both are event hooks without their own UI and pay off as soon as several `deliver` sessions run in parallel: one says when a session needs attention, the other clears what aborted or hand-merged sessions leave behind.
- **#3 before #2**: the starter is the smaller popup and establishes the popup pattern (input, keys, error line) that the board reuses; the board is the largest UI piece.
- **#6 late**: convenience, the manual splits work today.
- **#4 last**: needs an open decision first (where the `code-review` result comes from, possibly a change in GravionLabs/skills). It moves up as soon as that is decided.

## Open decisions

Decided during refinement.

| Issue | Decision |
| ----- | -------- |
| #4 | Source of the review result: file written by `deliver`, own headless review, or PR comment |
