# Roadmap

Plan to the stable release 1.0.0, tracked in Epic #69 (herdr-plugins 1.0.0: stable public release). Epics #10 (plugins for the `deliver` workflow) and #69 are the sources; this file only summarizes them. Updated 2026-11-01. Work runs on `release/next`, the release PR into `main` is the review point. Each release has a GitHub milestone named like its tag; GitVersion computes the tag from Conventional Commits, so a step without a `feat:` commit is released as a patch and its milestone is renamed to the released tag. Runtime: Node 26.

## Order

Latest release: **0.3.2**. Next release: **0.4.0**. Epic #69 reaches 1.0.0 in steps; each step is a milestone and a normal release of `release/next` (Epic #69, section Releases).

| Step | Theme | Issues |
| ---- | ----- | ------ |
| `0.4.0` | Foundation and Windows support | #116, #117, #118, #120, #121, #76, #79, #80, #83, #84, #85, #86, #87, #88, #93, #94 |
| `0.5.0` | API freeze and documentation site live | #77, #78, #81, #82, #89, #92, #95, #96, #97, #98, #99, #100, #103, #105, #107, #109, #119 |
| `0.6.0` | Docs complete, previews, e2e test | #101, #102, #104, #106, #108, #110, #111, #112, #113, #114, #115, #90, #91 |
| `1.0.0` | Release candidate and release (stable public release) | #122, #123, #124, #125 |

The milestone issue lists on GitHub are current; the table is the plan at the time of writing. Moving the roadmap to the documentation site is planned for 3.x.

## Releases

| Tag | Released | Tag commit | Release PR | Content |
| --- | -------- | ---------- | ---------- | ------- |
| `v0.1.0` | 2026-10-31 | `3e37625` | #35 | repository setup (#11), TypeScript 7 (#16), Node 26 (#21), release workflow (#19), `link-trim` (#8), `deliver-board` (#2), `worktree-cleanup` (#7), `deliver-log` (#23), `agent-notify` (#5), `deliver-starter` (#3) |
| `v0.2.0` | 2026-10-31 | `c9f11ba` | #38 | `deliver-view` (#22) |
| `v0.3.0` | 2026-11-01 | `d453086` | #64 | `command-palette` (#40 to #44), `deliver-starter` issue suggestions (#36), `layout-bootstrap` (#6), `review-popup` (#4), keybinding and `deliver-log` fixes (#54, #56), roadmap alignment (#45) |
| `v0.3.1` | 2026-11-01 | `4d63290` | #68 | Conventional Commit versioning (#60), CI follows `GravionLabs/ci` on `v1` (#61), hourly project-needs sync dropped (#62) |
| `v0.3.2` | 2026-11-01 | `1c1fce5` | #129 | release workflow recreates `release/next` after the release (#128) |

Release notes: [CHANGELOG.md](CHANGELOG.md) and the GitHub Releases. The earlier plan tagged the first two merges into `main` (`b18dc98`, `a3ecd7c`) as 0.1.0 and 0.2.0 by hand; that backfill was not done, the release workflow tagged the releases above instead, and the milestones were renamed to match (#45).

`skills#<n>` is an issue of [GravionLabs/skills](https://github.com/GravionLabs/skills): `review-popup` reads the review file that the `deliver` skill writes (skills#53).
