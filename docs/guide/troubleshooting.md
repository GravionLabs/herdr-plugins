# Troubleshooting and FAQ

Known problems and their fixes, collected from the plugin pages and the code. Each fix is the one the repository states. Where the repository does not say what causes a problem or how to fix it, the entry says "not verified". The details of each plugin are on its [plugin page](./plugins/link-trim.md) (linked per entry).

## Troubleshooting

### Ctrl+click does nothing

Ctrl+click on a link only reaches a plugin when herdr's mouse capture is on. The `ui.mouse_capture` setting is in herdr's `config.toml`. Turn it on. Without it herdr does not see the click, so no link handler runs ([link-trim](./plugins/link-trim.md), [deliver-starter](./plugins/deliver-starter.md)).

The exact TOML syntax of the setting is not shown in the repository: not verified. Check herdr's own documentation for how to write it.

- **Ctrl+click on a URL that ends in punctuation still opens the 404.** Only http and https URLs that end in `)`, `]`, `.`, `,`, `;`, `:`, `'` or `"` are routed to `link-trim`. Check that the link matches and that mouse capture is on ([link-trim](./plugins/link-trim.md)).
- **Ctrl+click on a `file:` or path link opens as before.** This is expected. Those links do not match the handler ([link-trim](./plugins/link-trim.md)).
- **Cmd+click in WezTerm still opens the URL with the punctuation.** WezTerm handles Cmd+click, and it never reaches herdr. Add the `hyperlink_rules` entry from the [link-trim page](./plugins/link-trim.md#examples) to `wezterm.lua`. The same entry is in [link-trim's README](https://github.com/GravionLabs/herdr-plugins/blob/main/link-trim/README.md).
- **Ctrl+click on an issue link does nothing.** Either `ui.mouse_capture` is off, or the link is not `https://github.com/<owner>/<repo>/issues/<nr>` with a valid owner and repository. Only owner and repository names with letters, digits, `-`, `.` and `_` are accepted (not `.` or `..`). The repository is the one of the focused pane, so click links of the repository you are in ([deliver-starter](./plugins/deliver-starter.md)).
- **`link-trim.open` run by hand exits with an error.** It has no input without a click. It shows a "Could not open link" notification. Do not invoke it by hand ([link-trim](./plugins/link-trim.md)).

### `gh` is missing

The GitHub CLI `gh` must be installed and on `PATH` for `deliver-board`, `deliver-starter` (suggestions) and `worktree-cleanup`. Its messages are:

- `gh is not installed: install the GitHub CLI from https://cli.github.com` (the board's error line, [deliver-board](./plugins/deliver-board.md)).
- `<plugin>: gh is not installed` with the body `Install it and make sure it is on your PATH.` (the notification of the other plugins, see [How notifications are worded](#how-notifications-are-worded)).

Install `gh` from [cli.github.com](https://cli.github.com) and check that `gh` is on `PATH`.

### `gh is not logged in`

The notification is `<plugin>: gh is not logged in` with the body `` Run `gh auth login`. ``. The board says `` gh is not authenticated: run `gh auth login` `` instead. Run `gh auth login`. The plugins classify it from `gh` exit code 4 or from stderr text such as "not logged in" or "gh auth login" ([deliver-board](./plugins/deliver-board.md), [worktree-cleanup](./plugins/worktree-cleanup.md)).

### `GitHub rate limit exceeded`

GitHub's rate limit for the account is used up. There are two forms:

- `GitHub rate limit exceeded, resets at HH:MM. Wait until then, then try again.` (local time). This form appears when the reset time is known. A herdr notification is shown too. Wait until the reset time ([deliver-board](./plugins/deliver-board.md), [deliver-starter](./plugins/deliver-starter.md)).
- `GitHub rate limit exceeded. Wait until it resets, then try again.` This form appears when the reset time is not known (from the cache code in `lib/ghcache.ts`).

The plugins reduce the calls they make. The answers of the REST calls are cached for 30 seconds under `HERDR_PLUGIN_STATE_DIR/gh-cache`, and an older answer is revalidated with an ETag. A `304` answer costs no rate limit. The PR list of `deliver-board` uses GraphQL, which has no ETag, so it still counts against the rate limit even though it is cached for 30 seconds ([deliver-board](./plugins/deliver-board.md)).

- **Pressing `r` in the board changes nothing for 30 seconds.** This is the cache working, not a fault. Within 30 seconds of the last load, `r` makes no GitHub call ([deliver-board](./plugins/deliver-board.md)).
- **A new PBI or PR does not show after `r`.** The data is cached for 30 seconds. Press `r` again after that ([deliver-board](./plugins/deliver-board.md)).
- **Suggestions after `#` or `@` are missing.** `gh` failed, the rate limit is used up, or the machine is offline. The popup works without suggestions and shows the reason when you type `#` or `@` ([deliver-starter](./plugins/deliver-starter.md)).

### `pwsh` is missing

The notification is `<plugin>: pwsh is not installed` with the body `Install it and make sure it is on your PATH.`. Install PowerShell 7+ and make sure `pwsh` is on `PATH`. `pwsh` is needed by:

- `deliver-log`, which runs `pwsh -NoProfile -File <deliver-skill>/scripts/Switch-LogPane.ps1` ([deliver-log](./plugins/deliver-log.md)).
- `deliver-starter`, in unattended mode only ([deliver-starter](./plugins/deliver-starter.md)).
- `worktree-cleanup` ([worktree-cleanup](./plugins/worktree-cleanup.md)).

The `deliver` skill is also required for these actions. Without it a notification says how to install it.

### The `deliver` skill is not installed

The skill is looked up in this order: `<repo>/.claude/skills/deliver`, `<repo>/.agents/skills/deliver`, `~/.claude/skills/deliver` and `~/.agents/skills/deliver`, where `<repo>` is the git toplevel of the focused pane's cwd. Install it with:

```sh
npx skills add GravionLabs/skills --skill deliver
```

The notification is `<plugin>: deliver skill not installed` (see [worktree-cleanup](./plugins/worktree-cleanup.md)). The skill is listed in [deliver-log](./plugins/deliver-log.md), [deliver-starter](./plugins/deliver-starter.md) and [worktree-cleanup](./plugins/worktree-cleanup.md).

### Node version

The repository declares Node.js `>= 26` (`engines.node` in `package.json`, `.nvmrc` `26`, CI `node-version: '26'`). The runtime strips TypeScript types at run time, so the Node version is part of the contract ([compatibility](../compatibility.md)). [deliver-view](./plugins/deliver-view.md) states Node 26, and the developer section of [link-trim's README](https://github.com/GravionLabs/herdr-plugins/blob/main/link-trim/README.md) does. The minimum is also in `engines.node` of `package.json`.

Which error a plugin shows on an older Node: not verified. Check with `node --version`.

### Windows

Windows is not a declared platform yet. The plugin manifests list only `macos` and `linux`, and `herdr plugin install` may refuse the plugin on Windows ([compatibility](../compatibility.md), [acceptance](../acceptance.md)). The repository's CI runs its tests on Windows, but this is a check, not support.

- **`herdr plugin install` refuses the plugin on Windows.** It may. Until #86 adds `windows` to `platforms`, record it as a known pre-release result, not a plugin failure ([acceptance](../acceptance.md)).
- **Use PowerShell or Windows Terminal.** The acceptance checklist uses these for its Windows runs ([acceptance](../acceptance.md)).
- **The system notification of `agent-notify` on Windows.** `systemNotification` shows a WinRT toast through `powershell.exe`. A missing tool leaves only the herdr notification ([agent-notify](./plugins/agent-notify.md)).
- **Windows behaviour of the other plugins.** Target behaviour (#84 and #86), not verified yet. This covers the view applied over the API socket, typed pane commands in PowerShell with backslash paths, and opening URLs with `rundll32` ([acceptance](../acceptance.md)).

### Agent notifications come in bursts

`agent-notify` notifies once per pane and state within 30 seconds. A repeated event in that window is suppressed ([agent-notify](./plugins/agent-notify.md)).

## FAQ

### Which tools does each plugin need?

| Plugin | Needs | Source |
|:--|:--|:--|
| [link-trim](./plugins/link-trim.md) | herdr with `ui.mouse_capture`, Node 26 | its page for herdr; Node from [compatibility](../compatibility.md) and `engines.node` in `package.json` |
| [deliver-board](./plugins/deliver-board.md) | `gh`, logged in | its page |
| [deliver-starter](./plugins/deliver-starter.md) | herdr 0.9.5, `ui.mouse_capture` for the link handler; `gh` for suggestions; `pwsh` and the `deliver` skill for unattended mode | its page |
| [deliver-log](./plugins/deliver-log.md) | PowerShell 7+ (`pwsh`), the `deliver` skill | its page |
| [deliver-view](./plugins/deliver-view.md) | herdr 0.9.5 or later, Node 26; macOS or Linux | its page |
| [worktree-cleanup](./plugins/worktree-cleanup.md) | `pwsh`, `gh` logged in, `git`, the `deliver` skill | its page |

Every plugin needs herdr 0.9.5 or later (`min_herdr_version`). The complete list is in [compatibility](../compatibility.md).

### Which herdr version do I need?

herdr `>= 0.9.5`. This is the minimum any plugin declares, and plugins do not declare a maximum ([compatibility](../compatibility.md)).

### Where do I find a plugin's log?

Run `herdr plugin log list --plugin <name>`, for example `herdr plugin log list --plugin worktree-cleanup` ([worktree-cleanup](./plugins/worktree-cleanup.md)).

### Why does `link-trim.open` not work from `herdr plugin action invoke`?

It is reachable only by Ctrl+click through its link handler. Use Ctrl+click on a matching link instead ([link-trim](./plugins/link-trim.md)).

### Why does a `/deliver` run in a chat session not appear in the deliver log?

Only `Invoke-DeliverLoop.ps1` writes the log. A `/deliver` run in a chat session does not ([deliver-log](./plugins/deliver-log.md)).

### Does the plugin run on Windows?

Not verified as supported. Windows is not a declared platform yet ([compatibility](../compatibility.md)).

### How do I run an action without a keybinding?

Run `herdr plugin action invoke <plugin>.<action>` ([getting started](./getting-started.md)). Actions that need a click or an event, such as `link-trim.open` and `deliver-starter.start-link`, do not work by hand ([link-trim](./plugins/link-trim.md), [deliver-starter](./plugins/deliver-starter.md)).

### Where are the security notes?

In the [security review](../security-review.md).

## How notifications are worded

The plugins that share the error classes show one notification per failure. The title is `<plugin>: <message>` and the body is a hint:

| Message | Body |
|:--|:--|
| `<tool> is not installed` | `Install it and make sure it is on your PATH.` |
| `gh is not logged in` | ``Run `gh auth login`.`` |
| `GitHub rate limit exceeded` | `Wait until the GitHub rate limit resets, then try again.` |
| `not a git repository` | `Open the pane inside a git repository.` |

Source: the shared `lib/errors.ts` of each plugin, and the `notice` tests of `deliver-log`. The board and the popup show the same reasons in one line instead.
