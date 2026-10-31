# Roadmap

Order of work and release assignment for the open issues of Feature #1. Written 2026-10-31. Work runs on `release/next`, the release PR into `main` is the review point. Releases are cut per milestone below; each release has a GitHub milestone of the same name. Runtime: Node 26 (switched from 24 on 2026-10-31, #21).

## Order

| Order | Release | Issue | Plugin | Size | Depends on |
| ----- | ------- | ----- | ------ | ---- | ---------- |
| 1 | 0.1.0 | #11 | repository setup: Node 24, Vitest, CI and the `GravionLabs/ci` issue, project and release-branch workflows | S | — |
| 2 | 0.1.0 | #8 | `link-trim`: open links without trailing punctuation | S | #11 |
| 3 | 0.2.0 | #16 | `chore(repo)`: TypeScript 7 for plugin development (type check only, Node runs `.ts` directly) | S | #11 |
| 4 | 0.2.0 | #5 | `agent-notify`: notification when an agent pane is done or blocked | S | #11, #16 |
| 5 | 0.2.0 | #7 | `worktree-cleanup`: remove worktrees and branches of merged PBIs | S | #11, #16 |
| 6 | 0.3.0 | #3 | `deliver-starter`: start `/deliver <nr>` in a new tab | S | #11 |
| 7 | 0.3.0 | #2 | `deliver-board`: popup with PBIs, claims and PR state | M | #11, after #3 |
| 8 | 0.4.0 | #6 | `layout-bootstrap`: apply a project layout to a workspace | S | #11 |
| 9 | 0.4.0 | #4 | `review-popup`: show the code-review result of the current branch | M | #11, decision in #4 |

## Why this order

- **#11 first**: runtime, test setup, CI and the issue/project/release workflows are set up once; every plugin PBI is blocked by it. Split from #8 so the plugins can start in parallel.
- **#8 next**: smallest plugin with an everyday annoyance behind it.
- **#16 before #5 and #7**: the TypeScript setup (type check with TypeScript 7, `.ts` entry points run by Node 26) is the base the 0.2.0 plugins are written on.
- **#5 and #7 next**: both are event hooks without their own UI and pay off as soon as several `deliver` sessions run in parallel: one says when a session needs attention, the other clears what aborted or hand-merged sessions leave behind.
- **#3 before #2**: the starter is the smaller popup and establishes the popup pattern (input, keys, error line) that the board reuses; the board is the largest UI piece.
- **#6 late**: convenience, the manual splits work today.
- **#4 last**: needs an open decision first (where the `code-review` result comes from, possibly a change in apm-hub). It moves up as soon as that is decided.

## Open decisions

Decided during refinement.

| Issue | Decision |
| ----- | -------- |
| #4 | Source of the review result: file written by `deliver`, own headless review, or PR comment |
