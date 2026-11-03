# Changelog

All notable changes to herdr-plugins are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.6.0] — 2026-11-03

### Features
- **deliver-board**: Data action with the board as versioned JSON (#215) (#216)


## [0.5.0] — 2026-11-02

### Bug Fixes
- **test**: Accept the released version in the manifest tests (#151) (#152)
- **review-popup**: List the reviews on a branch without PBI number (#150) (#153)
- **security**: Review command execution and URL handling (#92) (#173)
- **worktree-cleanup**: E2e test fakes gh pr view, the deliver script now calls gh api (#165) (#185)
- Setup install ignores flags before the command (#196) (#202)
- Doctor hint for ui.toast.delivery says all, apply and docs say herdr (#197) (#203)
- Plugin pages and README install without --ref, against the spike rule (#200) (#204)
- Plugin overview and site sidebar list 10 plugins, repo-open is missing (#198) (#205)
- Keybindings page says link-trim.open can be invoked by hand (#199) (#206)
- Compatibility matrix names 0.4.0 as current, not 0.5.0 (#201) (#207)
- Repo-open pages and plugin install examples name tag v0.4.0, which has no repo-open (#209) (#211)
- Setup install fails for plugins that are not in the chosen release tag (#208) (#212)
- Doctor only finds a globally installed deliver skill, docs say to install it into the project (#210) (#213)
- **deliver-view**: Show the space-first sidebar layout in the README (#160)


### Documentation
- Compatibility matrix and deprecation policy (#81) (#168)
- VitePress site skeleton (#95) (#174)
- Plugin page template with link-trim and agent-notify (#98) (#176)
- Plugin pages for the deliver plugins (#99) (#178)
- Plugin pages for review-popup, worktree-cleanup, command-palette and layout-bootstrap (#100) (#179)
- Keybindings page with a complete config.toml (#103) (#180)
- Troubleshooting and FAQ (#105) (#181)
- Contributor guide (#107) (#182)
- Document the herdr settings the plugins rely on (#143) (#184)
- Getting started (#97) (#192)
- Document the setup script (#149) (#193)
- **deliver-view**: Sync the README and its test with release/next (#160) (#195)
- Update CHANGELOG.md for v0.5.0 [skip ci]


### Features
- **repo-open**: Plugin skeleton, config and repository discovery (#156) (#159)
- **repo-open**: Repository picker popup with fuzzy filter (#157) (#161)
- **repo-open**: Open or focus the repository workspace with its tabs (#158) (#163)
- **deliver-starter**: Milestone picker and level filter in the popup (#144) (#164)
- JSON schema and validation for every plugin config (#78) (#167)
- **review-popup**: Check the skills review schema version (#82) (#169)
- **setup**: Setup script skeleton and doctor checks (#146) (#186)
- **setup**: Apply the config blocks with diff and backup (#148) (#187)
- **setup**: Install the plugins at a release tag (#147) (#191)


### Performance
- Reduce GitHub API load of the deliver plugins (#89) (#170)


### Refactoring
- Naming audit before the API freeze (#77) (#166)


## [0.4.0] — 2026-11-01

### Bug Fixes
- Consistent error handling across plugins (#88) (#133)


### Documentation
- **adr**: Define the public API covered by SemVer (#76) (#126)
- Update ROADMAP.md (#120) (#139)
- Update CHANGELOG.md for v0.4.0 [skip ci]


### Features
- Open URLs on Windows in link-trim and deliver-board (#84) (#130)
- **agent-notify**: System notifications on Windows and Linux (#85) (#131)


## [0.3.2] — 2026-11-01

### Bug Fixes
- **ci**: Recreate release/next after the release (#128) (#129)


### Documentation
- Update CHANGELOG.md for v0.3.2 [skip ci]


## [0.3.1] — 2026-11-01

### Documentation
- Update CHANGELOG.md for v0.3.1 [skip ci]


## [0.3.0] — 2026-11-01

### Bug Fixes
- Recommend keybindings free in herdr's default keymap (#54) (#55)
- **deliver-log**: Notify the reason when toggle-log shows no pane (#56) (#57)


### Documentation
- **roadmap**: Align roadmap, README and milestones with the released tags (#45) (#46)
- Update CHANGELOG.md for v0.2.1 [skip ci]
- Update CHANGELOG.md for v0.3.0 [skip ci]


### Features
- **command-palette**: Plugin skeleton with action open and popup (#40) (#47)
- **command-palette**: Palette TUI with fuzzy filter and keyboard navigation (#41) (#48)
- **deliver-starter**: Suggest open issues when typing # in the start popup (#36) (#49)
- **layout-bootstrap**: Apply a project layout to a workspace (#6) (#50)
- **command-palette**: List and run plugin actions (#42) (#51)
- **command-palette**: Own entries from config.json (#43) (#52)
- **command-palette**: Rank recently used entries first (#44) (#53)
- **review-popup**: Show the code-review result of the current branch (#4) (#58)


## [0.2.0] — 2026-10-31

### Documentation
- Update CHANGELOG.md for v0.2.0 [skip ci]


### Features
- **deliver-view**: Agent view for the deliver sessions (#22) (#37)


## [0.1.0] — 2026-10-31

### Documentation
- Add roadmap and link-trim plugin to README (#9)
- Roadmap starts with the repository setup PBI (#11) (#12)
- Deliver-starter, deliver-view and deliver-log take over GravionLabs/skills#17 (#24)
- Roadmap records releases 0.1.0 and 0.2.0 (#27)
- Update CHANGELOG.md for v0.1.0 [skip ci]


### Features
- **link-trim**: Open links without trailing punctuation (#8) (#14)
- **deliver-board**: Popup with PBIs, claims and PR state (#2) (#28)
- **worktree-cleanup**: Remove worktrees and branches of merged PBIs (#7) (#29)
- **deliver-log**: Toggle the deliver log pane (#23) (#32)
- **agent-notify**: Notify when an agent pane is done or blocked (#5) (#33)
- **deliver-starter**: Start /deliver from herdr (#3) (#34)



