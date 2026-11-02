# Manual acceptance checklist

Run this checklist on macOS, Linux and Windows before the release candidate and before the release. Windows is the target for 1.0, but it becomes a declared platform only when #86 adds `windows` to the `platforms` of every manifest; until then the Windows runs are pre-release checks, and `herdr plugin install` may refuse the plugin there. Windows results marked "Target behaviour" are not verified yet. The public surface (IDs, config keys, state files, event behaviour) is defined in [ADR 0001](adr/0001-public-api.md); every step below checks one item of it.

Running the checklist is tracked outside this file (#124 and each release). Record the result per plugin and OS in the release PR.

## Before you start

- [ ] herdr `0.9.5` or newer is installed and running (`herdr --version`).
- [ ] Node.js 26 (`node --version`), `git`, and for several plugins `gh` (logged in with `gh auth login`) and PowerShell 7+ (`pwsh --version`).
- [ ] The release candidate is the version under test: install from the branch or tag, for example `herdr plugin install GravionLabs/herdr-plugins/<plugin>`.
- [ ] A scratch git repository with a `release/next` branch, a GitHub remote and a few open issues labelled `pbi`.
- [ ] `ui.mouse_capture` is on in herdr's `config.toml` (needed for link handlers).
- [ ] Windows only: until #86 lands, the manifests list only `macos` and `linux` (ADR 0001), so `herdr plugin install` may refuse the plugin; record that as a known pre-release result, not a plugin failure. After #86 every manifest lists `windows` in `platforms` and the install must succeed. Use PowerShell or Windows Terminal; paths below use `$HERDR_PLUGIN_CONFIG_DIR` and `$HERDR_PLUGIN_STATE_DIR` as printed by `herdr plugin config-dir <plugin>` and the state directory of the plugin.

How to trigger an action without a keybinding: `herdr plugin action invoke <plugin>.<action>`. Test the bound key once for each plugin that has an action (`agent-notify`, `link-trim` and `deliver-view` have no keybinding example in their READMEs; invoke those with the command). `deliver-view` is invoked as `herdr plugin action invoke deliver-view apply` (its README syntax), the others as `<plugin>.<action>`.

## Per-OS differences to watch

| Area | macOS | Linux | Windows |
|:--|:--|:--|:--|
| Open a link (`link-trim`) | `open` | `xdg-open` | `rundll32` URL handler (implemented in #84/#85 for `link-trim` and `deliver-board`) |
| System notification (`agent-notify`) | `osascript` | `notify-send` | WinRT toast through `powershell.exe` |
| Paths | `/` | `/` | `\`; plugins must accept both and not need a POSIX shell (target behaviour, #84/#86, not verified yet) |
| Shell for typed pane commands | zsh or bash | bash | PowerShell (target behaviour, #84/#86, not verified yet) |
| Child processes (`node`, `git`, `gh`, `pwsh`) | on `PATH` | on `PATH` | on `PATH`; `.exe`/`.cmd` resolution without a shell is target behaviour (#84/#86), not verified yet |

For every plugin below, "Uninstall" means `herdr plugin uninstall <plugin>` followed by `herdr plugin list`, which must no longer list it, and its actions must be gone from `herdr plugin action list`.

## `agent-notify`

Event `pane.agent_status_changed`. No action, pane or link handler.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/agent-notify`; `herdr plugin list` shows `agent-notify`.
- [ ] Event, done: in a pane running an agent (or a script that sets the agent state), make the pane turn `done`. Expected: one herdr notification naming the pane, workspace and tab, for example `Claude done`.
- [ ] Event, blocked: make the pane turn `blocked`. Expected: one herdr notification for the blocked state.
- [ ] De-duplication: trigger the same pane and the same state twice within 30 seconds. Expected: one notification only.
- [ ] A state other than `done` or `blocked` (for example `working`) shows no notification.
- [ ] Deliver tokens: a pane with the token `deliver` (and `deliver_step`, `deliver_pr`) is named by its tokens, for example `deliver #12 review: 1 blocking (PR #34)`.
- [ ] Config off (default): no system notification and no sound.
- [ ] Config `{"system_notification": true}` in `config.json`: additionally a system notification (macOS `osascript`, Linux `notify-send`, Windows WinRT toast through `powershell.exe`, implemented). If the tool is missing, the herdr notification still appears and nothing crashes.
- [ ] Config `{"sound": true}`: herdr plays its `done` sound for done and its `request` sound for blocked.
- [ ] State file `seen.json` exists in the state directory and holds an object of key to number.
- [ ] A broken `config.json` (invalid JSON) falls back to the defaults.
- [ ] Uninstall: no more notifications on a state change.

## `command-palette`

Action `open`, pane `palette` (popup).

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/command-palette`.
- [ ] Action: `herdr plugin action invoke command-palette.open`, or the bound key. Expected: a popup with a search field and a list `<plugin_id> · <title>` of all installed plugin actions; `command-palette.open` itself is not listed.
- [ ] Filter: type `dl`. Expected: entries are filtered live, case-insensitive, word starts match (`deliver-log`). Backspace widens the list again.
- [ ] Keys: Up, Down, Ctrl+P and Ctrl+N move the selection.
- [ ] Run: Enter on an entry. Expected: the popup closes and the chosen action runs on the pane that was focused before.
- [ ] Close: Escape and Ctrl+C close the popup, the terminal is restored (cursor visible, no leftover screen).
- [ ] Own commands: `config.json` with `{"commands":[{"title":"show version","command":["node","--version"]}]}`. Expected: entry `config · show version` appears; Enter runs it without a shell. A failing command (`["node","--no-such-flag"]`) shows the notification `command-palette: <title> failed`.
- [ ] Invalid `config.json` (broken JSON or an entry without `title`): one hint line `config.json: <problem>` under the search field; valid entries still work.
- [ ] Recently used: after running an entry, reopen the popup with an empty search. Expected: that entry comes first; `recent.json` in the state directory holds `{ "count", "last" }` for it. A failed run is not recorded.
- [ ] Uninstall: the action and pane are gone.

## `deliver-board`

Action `open`, pane `board` (popup).

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/deliver-board`.
- [ ] Action in the scratch repository: `herdr plugin action invoke deliver-board.open`. Expected: a popup with one row per open `pbi` issue, ordered by number, with the columns PBI, Title, Assignee, Labels, Branch, PR, Checks.
- [ ] A PBI with a pushed `<type>/<nr>-*` branch and a PR into `release/next` shows the branch, the PR number and the check state.
- [ ] Keys: `j`/`k` and the arrow keys move the selection; Enter opens the PR (or the issue without a PR) in the browser; `r` refreshes; `q` and Escape close.
- [ ] Focus a pane outside a git repository. Expected: the popup says so and closes on any key.
- [ ] `gh` not logged in (`gh auth logout`, then log in again afterwards). Expected: one error line, no crash.
- [ ] Uninstall: the action and pane are gone.

## `deliver-log`

Action `toggle-log`. Needs the `deliver` skill and `pwsh`.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/deliver-log`.
- [ ] Skill missing: run the action without the `deliver` skill installed. Expected: a notification that names what is missing, exit without a crash.
- [ ] With the skill installed and a log file `.agents/deliver-loop.ansi.log` (or `.agents/deliver-loop.log`) in the repository: the action shows the log pane.
- [ ] Run the action again. Expected: the log pane is hidden (closed and reopened with the same content on the next toggle).
- [ ] Without a log file: a notification says there is no log to show.
- [ ] Uninstall: the action is gone.

## `deliver-starter`

Actions `start`, `start-link`; pane `form` (popup); link handler `github-issue`.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/deliver-starter`.
- [ ] Action `start`: the popup asks for the `/deliver` arguments and the mode (`interactive` or `unattended`).
- [ ] Validation: enter an issue number that does not exist. Expected: nothing starts and a message names the problem.
- [ ] Suggestions: type `#`. Expected: open PBIs, Features and Epics of the focused pane's repository, filtered live; Up/Down move, Enter inserts the number.
- [ ] Empty input and Escape close the popup without starting.
- [ ] Several numbers: enter `3 4` (two open PBIs). Expected: both are checked with `gh issue view`, the worktree is `deliver/3` and the run is `/deliver 3 4`; unattended mode passes `-Target 3 4`. One invalid number among them keeps the popup open with the reason.
- [ ] Milestone: enter `--milestone <name>` (an existing milestone). Expected: the worktree is `deliver/milestone-<name>` and the run is `/deliver --milestone <name>`; unattended mode passes `-Milestone <name>`.
- [ ] Interactive mode with a valid issue: a herdr worktree `deliver/<nr>` is created from `origin/release/next` and its root pane runs the harness (`claude` by default) with `/deliver <nr>`.
- [ ] Tab switches the mode; unattended mode opens a tab `deliver #<nr>` that runs `Invoke-DeliverLoop.ps1` through `pwsh` (needs the `deliver` skill).
- [ ] Link handler: Ctrl+click on `https://github.com/<owner>/<repo>/issues/<nr>` in a pane. Expected: the interactive run for that issue starts without the popup. A closed or unknown issue shows a notification. A pull request URL is not claimed by the handler.
- [ ] Config: `{"harness":"claude --model opus","mode":"unattended","suggestLimit":5}` preselects unattended, limits the suggestions to 5 and starts the configured harness. A mistyped value (`"suggestLimit":"x"`) falls back to the default.
- [ ] Uninstall: actions, pane and link handler are gone (Ctrl+click on an issue link no longer starts a run).

## `deliver-view`

Action `apply`; one `[[startup]]` hook.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/deliver-view`.
- [ ] Action: `herdr plugin action invoke deliver-view.apply`. Expected: the agent view `deliver` is active; blocked agents are on top, then agents with the token `deliver`, then the most recent state change first.
- [ ] State file: `view.json` exists in the state directory and holds the view object.
- [ ] Startup hook: edit `view.json` (for example change the label), restart herdr. Expected: the stored view is applied once after the session is restored.
- [ ] Without `view.json` the hook applies the default view.
- [ ] A failed apply (herdr API socket not reachable) shows a notification and does not hang.
- [ ] Windows: the view is applied over the herdr API socket as well. Target behaviour (#84/#86), not verified yet.
- [ ] Uninstall: the action is gone; after a herdr restart the view is no longer applied by the plugin.

## `layout-bootstrap`

Action `apply`.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/layout-bootstrap`.
- [ ] Default layout: in a workspace of a git repository, run `herdr plugin action invoke layout-bootstrap.apply`. Expected: the focused pane becomes `agent`, plus panes `tests` (right, top) and `shell` (right, bottom), all in the repository root.
- [ ] Idempotent: run the action again. Expected: no new panes, nothing renamed or run again.
- [ ] `testCommand`: `config.json` with `{"testCommand":"npm test -- --watch"}`. Expected: the `tests` pane runs it; without the key the pane stays empty.
- [ ] Layout file `.agents/herdr-layout.json` in the repository wins over `layout.json` in the config directory, which wins over the default.
- [ ] Invalid layout file: the action stops with a notification naming the file and the problem; it does not fall back.
- [ ] A pane that cannot be moved to the repository root (agent pane elsewhere) is listed in the notification "not in the repository root".
- [ ] Windows: typed pane commands run in PowerShell and the `cd` to the repository root works with backslash paths. Target behaviour (#84/#86), not verified yet.
- [ ] Uninstall: the action is gone; panes already created stay.

## `link-trim`

Action `open`; link handler `trailing-punct`.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/link-trim`.
- [ ] Print `https://github.com/GravionLabs/ci/pull/91)` in a pane and Ctrl+click it. Expected: the browser opens `.../pull/91` (no 404).
- [ ] Repeat with the endings `.`, `,`, `;`, `:`, `'`, `"` and `]`. Expected: each is removed; several in a row (`...91).`) are all removed.
- [ ] `https://en.wikipedia.org/wiki/Foo_(bar)` opens unchanged (the `)` has a partner).
- [ ] A URL without trailing punctuation is not routed to the plugin and opens as before.
- [ ] Opening uses `open` on macOS, `xdg-open` on Linux and `rundll32` (default browser) on Windows (implemented in #84/#85). If opening fails, herdr shows a notification with the URL.
- [ ] Uninstall: Ctrl+click on `...91)` opens the untrimmed URL again.

## `repo-open`

Action `open`, pane `picker` (popup).

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/repo-open`.
- [ ] Discovery: with the default config, the repositories below `~/Source` (up to 3 levels) are listed by name with their relative path; nested repositories, hidden directories and `node_modules` are not listed.
- [ ] Action: `herdr plugin action invoke repo-open.open`, or the bound key. Expected: a popup with a search field and the repositories as `<name>  <relative path>`.
- [ ] Filter: type `hp`. Expected: `herdr-plugins` is listed (word starts), filtering is live and case-insensitive; Backspace widens the list again. Up, Down, Ctrl+P and Ctrl+N move the selection.
- [ ] Close: Escape and Ctrl+C close the popup, the terminal is restored.
- [ ] Open: Enter on a repository without a workspace. Expected: the popup closes, a workspace labelled with the repository name opens with the tabs `terminal` (shell) and `agent` (running `claude`), both in the repository root; the `agent` tab is focused.
- [ ] Reopen: open the same repository again. Expected: its workspace is focused, no second workspace or tab is created. Opening a different repository with the same name creates a workspace labelled with its relative path.
- [ ] Recently opened: reopen the popup with an empty search. Expected: the opened repository comes first.
- [ ] Own tabs: `config.json` with `{"tabs":[{"label":"shell"},{"label":"ai","command":"codex","focus":true}]}`. Expected: a new workspace gets these tabs and focuses `ai`.
- [ ] `config.json` with `{"roots":["~/other"],"depth":1}`: only the repositories directly below `~/other` are listed. An invalid value (`{"depth":0}`) shows the hint line `config.json: depth must be an integer from 1 to 10` and uses the default depth.
- [ ] Uninstall: the action and pane are gone.

## `review-popup`

Action `open`, pane `review` (popup).

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/review-popup`.
- [ ] Branch without PBI number (`main`): the popup shows one line saying so.
- [ ] Branch `feat/12-example` without a review file: one line saying that no review file exists.
- [ ] Place a valid `<git-common-dir>/.agents/state/review-12.json` (review of the `deliver` skill). The schemas are `review-popup/schema/deliver-review.schema.json` (outer object) and `review-popup/schema/review.schema.json` (the `review` member). Minimal valid file (`sha` is 7 to 64 lowercase hex characters; use the branch's HEAD to avoid the stale mark):

  ```json
  {"pbi":12,"branch":"feat/12-example","sha":"0123abc","round":1,"unmet":["Criterion not met"],"review":{"blocking":[{"file":"src/a.ts","line":3,"title":"Missing check","why":"Input is not validated."}],"notes":["Rename x."]}}
  ```
 Expected: header `#12 round <round>`, unmet criteria, blocking findings as `file:line - title` with the reason below, and notes.
- [ ] Another worktree of the same repository shows the same file.
- [ ] A review whose `sha` differs from the HEAD of the branch is marked stale.
- [ ] Keys: Up/Down (or `k`/`j`) select a blocking finding; Enter opens the file at the line in `$EDITOR` (`vi`/default when unset) in a new split pane; `q` and Escape close.
- [ ] Invalid review file (remove a required field): one line with the validation error.
- [ ] Uninstall: the action and pane are gone.

## `worktree-cleanup`

Action `cleanup`; event `worktree.removed`. Needs the `deliver` skill, `pwsh`, `gh` and `git`.

- [ ] Install: `herdr plugin install GravionLabs/herdr-plugins/worktree-cleanup`.
- [ ] Prepare: merge a PR from `feat/<nr>-x` into `release/next` (or use a scratch repository), keep the local branch and the worktree.
- [ ] Action: `herdr plugin action invoke worktree-cleanup.cleanup`. Expected: the worktree and local branch of the merged PBI are removed; notification `<n> removed, <m> left`.
- [ ] Safety: a worktree with uncommitted changes and the worktree of the focused pane are not removed and are listed in `herdr plugin log list --plugin worktree-cleanup` with the command to remove them by hand.
- [ ] Nothing to clean: the notification says `0 removed`, no error.
- [ ] Event, merged and pushed: `herdr worktree remove` on a worktree whose branch is fully on a remote branch. Expected: the local branch is deleted (`git branch` no longer lists it).
- [ ] Event, unpushed: remove a worktree whose branch has a commit that is on no remote branch. Expected: the branch is kept.
- [ ] Event, protected: removing a worktree of `main` or `release/next` never deletes that branch.
- [ ] Event with nothing to do (detached worktree, branch still checked out elsewhere): silent, no notification.
- [ ] Missing `deliver` skill or `pwsh`: the action shows a notification that names what is missing.
- [ ] Uninstall: the action is gone and removing a worktree no longer deletes branches.
