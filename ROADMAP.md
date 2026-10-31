# Roadmap

Order of work and release assignment for the open issues of Feature #1. Written 2026-10-31. Work runs on `release/next`, the release PR into `main` is the review point. Releases are cut per milestone below.

## Order

| Order | Release | Issue | Plugin | Size | Depends on |
| ----- | ------- | ----- | ------ | ---- | ---------- |
| 1 | 0.1.0 | #8 | `link-trim`: open links without trailing punctuation; sets runtime, tests and CI for the repository | S | — |
| 2 | 0.2.0 | #5 | `agent-notify`: notification when an agent pane is done or blocked | S | #8 |
| 3 | 0.2.0 | #7 | `worktree-cleanup`: remove worktrees and branches of merged PBIs | S | #8 |
| 4 | 0.3.0 | #3 | `deliver-starter`: start `/deliver <nr>` in a new tab | S | #8 |
| 5 | 0.3.0 | #2 | `deliver-board`: popup with PBIs, claims and PR state | M | #8, after #3 |
| 6 | 0.4.0 | #6 | `layout-bootstrap`: apply a project layout to a workspace | S | #8 |
| 7 | 0.4.0 | #4 | `review-popup`: show the code-review result of the current branch | M | #8, decision in #4 |

## Why this order

- **#8 first**: smallest plugin with an everyday annoyance behind it, and the place where the runtime, the test setup and CI are decided once. Every other PBI is blocked by it.
- **#5 and #7 next**: both are event hooks without their own UI and pay off as soon as several `deliver` sessions run in parallel: one says when a session needs attention, the other clears what aborted or hand-merged sessions leave behind.
- **#3 before #2**: the starter is the smaller popup and establishes the popup pattern (input, keys, error line) that the board reuses; the board is the largest UI piece.
- **#6 late**: convenience, the manual splits work today.
- **#4 last**: needs an open decision first (where the `code-review` result comes from, possibly a change in apm-hub). It moves up as soon as that is decided.

## Open decisions

| Issue | Decision |
| ----- | -------- |
| #8 | Runtime for all plugins (proposal: Node ≥ 22 with Vitest) |
| #4 | Source of the review result: file written by `deliver`, own headless review, or PR comment |
| — | Visibility of the repository: the herdr marketplace indexes public repositories only |
