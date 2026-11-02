# Security review: command execution and URL handling

Review of every place where a plugin runs a command, opens a URL or reads or opens a file from input it does not fully control (#92). Reviewed on `release/next` after `0.4.0`. Report new problems privately as described in [SECURITY.md](https://github.com/GravionLabs/herdr-plugins/blob/main/SECURITY.md).

## Scope and threat model

Input is treated by where it comes from:

| Source | Trust | Examples |
|:--|:--|:--|
| The user's own plugin config (`HERDR_PLUGIN_CONFIG_DIR`), `$EDITOR`, the `harness` setting | trusted: the user can run any command anyway | `command-palette` `commands`, `repo-open` `tabs[].command`, `layout-bootstrap` `testCommand` |
| herdr itself (event and context JSON, `plugin action list`) | semi-trusted: other installed plugins and git refs end up in it | `worktree.removed` branch, action ids |
| Text from a terminal, GitHub or an agent | untrusted | a clicked URL, issue and milestone titles, branch names of merged PRs, `review-<nr>.json` written by `deliver` |
| Files of the repository the pane is in | untrusted for a fresh clone | `.claude/skills/deliver/`, `.agents/herdr-layout.json` |

Two kinds of sink were checked:

- **Process start** (`execFile`, `spawn`): an argument array without a shell. Shell metacharacters are harmless here; the risks are a program chosen by the input and an argument read as an option (`-x`).
- **Typed shell line** (`herdr pane run <pane> <line>`): the line is typed into the pane's interactive shell, which may be bash, zsh, fish or PowerShell. Here quoting matters, and a newline submits the line early.

Grep used to find the sinks: `spawn|execFile|exec(|shell:|child_process|readFile|pane run`. No plugin uses `shell: true`, `exec`/`execSync` or a string-built command for `execFile`/`spawn`.

## Findings and resolution

### command-palette: own commands and plugin actions

- Own commands (`config.json` `commands[].command`) are argument arrays spawned without a shell in the entry `cwd`. Trusted input; `;`, `&`, quotes and `..` reach the program unchanged. **No change.** Test: `bin/run.ts with a config command` passes each of them as a literal argument and checks that nothing was executed.
- Plugin and action ids from `herdr plugin action list` become arguments of `herdr plugin action invoke <action> --plugin <plugin>`. An id that starts with `-` would be parsed as an option. **Fixed:** `parseActions` leaves out ids that start with `-` (`command-palette/lib/actions.ts`).

### deliver-starter: issue links and milestone names

- `parseIssueUrl` accepted `[^/]+` as owner and repository, so a clicked `https://github.com/a;x/../issues/3` reached `gh --repo` (as one argument, no shell). **Fixed:** owner `[A-Za-z0-9][A-Za-z0-9-]*`, repository `[A-Za-z0-9._-]+` but not `.` or `..`, the number a safe integer (`deliver-starter/lib/link.ts`).
- Issue numbers are digits only and go to `gh issue view` as arguments. **No change.**
- The milestone name is typed into the new pane: `pwsh '<loop script>' -Milestone '<name>'` or `claude '/deliver --milestone "<name>"'`. The POSIX `'\''` escaping is safe in bash and zsh, but in fish `\'` inside single quotes is an escaped quote and in PowerShell `'` and the typographic quotes `‘’‚‛` end the string, so a name like `x\'; id; '` or `x'; id; '` could run commands in those shells. **Fixed:** `parseArgs` refuses a milestone name with `'`, `"`, `\`, `U+2018`–`U+201B` or a control character (`deliver-starter/lib/args.ts`); everything else (`;`, `&`, `$()`, backticks, spaces) stays literal inside the single quotes in every one of those shells.
- `branchName` turned `../x` into `deliver/milestone-..-x`, which git refuses. **Fixed:** runs of dots collapse and leading or trailing `.`/`-` are trimmed (`deliver-starter/lib/command.ts`).
- The `harness` setting is typed as given; trusted config. **No change.**

### link-trim (and the same opener in deliver-board): open arguments

- The URL goes to `open`, `xdg-open` or `rundll32 url.dll,FileProtocolHandler` as one argument without a shell, so `&`, `;`, `%` and quotes are not interpreted. The link handler only routes `^https?://` URLs, but `opener` itself accepted anything: `file:///…/calc.exe` through `FileProtocolHandler` starts a program, `open` treats a leading `-` as an option and opens local paths and app bundles. **Fixed:** `opener` returns null unless the text is an absolute `http`/`https` URL without whitespace or control characters (`isWebUrl` in `link-trim/lib/open.ts`; the same file in `deliver-board/lib/open.ts`, whose URLs come from the GitHub API).
- Coordination with 2.2 (Windows `start` quoting): the Windows path uses `rundll32 url.dll,FileProtocolHandler <url>` through `execFile`, not `cmd /c start`, so cmd metacharacters (`&`, `^`, `%`) need no quoting. The http/https check above also closes the local-file and program-start case of `FileProtocolHandler`. Windows is not a declared platform yet.

### review-popup: file reads and the editor command

- The review file path is `<git common dir>/.agents/state/review-<nr>.json` with `<nr>` taken as digits from the branch name, so `..` cannot reach it; the list view only reads names matching `^review-(\d+)\.json$`. **No change.**
- A finding's `file` comes from the review JSON and was joined to the worktree and typed into the split pane as `$EDITOR +<line> '<path>'`. `../../etc/passwd` opened a file outside the worktree, and the fish/PowerShell quoting problem above applied to the name. **Fixed:** `findingPath` refuses a file outside the worktree and a name with `'`, `\`, a typographic single quote or a control character; the popup shows `Not opened: …` (`review-popup/lib/split.ts`).
- Titles, reasons and notes of the review were written to the terminal as they are. A finding title copied from hostile code could carry an escape sequence (cursor moves, OSC 52 clipboard write). **Fixed:** `render` replaces control characters with `?` (`review-popup/lib/review.ts`).
- `review.branch` is only used as `refs/heads/<branch>` in `git rev-parse --verify` and for a string comparison. **No change.**
- `$EDITOR` is typed as given; trusted. **No change.**

### worktree-cleanup: deletions

- The `cleanup` action passes only numbers (`-Pr <n> -Issue <n>`) to `Remove-PbiWorktrees.ps1`; the head branch names of merged PRs (attacker-chosen for a fork PR) are only compared with local branch names. **No change.**
- The `worktree.removed` hook ran `git branch -d <branch>` with the branch from the event payload. A ref named `-D` or `--force` (possible through `git update-ref`) would be read as an option. **Fixed:** `git branch -d -- <branch>` and `-D --` (`worktree-cleanup/lib/cleanup.ts`).
- The `left` entry logged `git branch -D <branch>` for copy-paste. Git allows `;`, `&`, `$`, `|`, quotes and backticks in branch names, so a branch `feat/1-x;touch${IFS}pwned` produced a command that runs more than git. **Fixed:** `deleteBranchCommand` shell-quotes the name when it holds anything outside `[A-Za-z0-9._/+@%=,:-]` and adds `--` for a leading `-`. A git-backed test runs the logged command through `sh` and checks that only that branch is gone.
- Protected branches (`main`, `master`, `release/next`, origin's default) and branches still checked out are never deleted; local-only commits are never deleted. **No change.**
- The `left[].command` strings printed by `Remove-PbiWorktrees.ps1` are logged verbatim; their quoting belongs to the `deliver` skill in GravionLabs/skills and was not reviewed here.

### Other plugins (same patterns)

| Plugin | Sink | Result |
|:--|:--|:--|
| agent-notify | `osascript -e` with an AppleScript string literal (`\` and `"` escaped), `notify-send --`, PowerShell toast with title and body passed through the environment | no change |
| deliver-board | `gh`/`git` argument arrays; URL opener | opener fixed as in link-trim |
| deliver-log | `pwsh -NoProfile -File <skill>/scripts/Switch-LogPane.ps1` | no change (see open points) |
| deliver-view | `herdr notification show` argument array | no change |
| layout-bootstrap | `pane run <pane> cd -- '<repo>'` (POSIX-quoted local path); pane commands from the layout file | no change (see open points) |
| repo-open | herdr argument arrays; `tabs[].command` from the user's config typed as given | no change |

## Open points (filed as bugs, not fixed here)

- **Repository-local code runs without a trust check.** `deliver-starter`, `deliver-log` and `worktree-cleanup` prefer `<repo>/.claude/skills/deliver/scripts/*.ps1` over the user's installed skill, and `layout-bootstrap` types the pane commands of `<repo>/.agents/herdr-layout.json`. In a freshly cloned untrusted repository, the action runs that repository's code. Needs a design decision (trust prompt, allow list or home-only lookup).
- **Terminal escape sequences in the other popups.** `deliver-board` (issue titles from GitHub), `deliver-starter` (issue and milestone suggestions), `command-palette` (action titles) and `repo-open` (directory names) write that text to the terminal unfiltered, as review-popup did before this review.
- **Symlinks in review-popup.** `findingPath` checks the path lexically; a symlink committed inside the worktree can still point outside it. Low risk (the link is part of the repository under review), not fixed.

## Tests

Every fix has tests with the injection attempts `;`, `&`, `$()`, backticks, single and double quotes and `..`:

- `link-trim/test/open.test.ts`, `deliver-board/test/open.test.ts`: hostile http(s) URLs pass unchanged as one argument; `file:`, `javascript:`, paths, `-a`, whitespace and control characters are refused on every platform.
- `deliver-starter/test/args.test.ts`: hostile owner and repository names, `..`, `%2e%2e`, oversized numbers; milestone names with `;`/`&`/`$()` stay literal, quotes, backslash, typographic quotes and control characters are refused.
- `deliver-starter/test/command.test.ts`: `..` and shell characters in the branch name; `;`, `&`, `$()` inside the single-quoted shell argument.
- `review-popup/test/review.test.ts`: findings outside the worktree, unsafe file names, control characters in the rendered review.
- `worktree-cleanup/test/git.test.ts`, `worktree-cleanup/test/cleanup.test.ts`: hostile branch names deleted exactly, a branch named `-D`, the quoted `left` command run through `sh`.
- `command-palette/test/actions.test.ts`, `command-palette/test/run.test.ts`: ids starting with `-`; config command arguments with `;`, `&`, `$()`, quotes and `..` arrive literally.
