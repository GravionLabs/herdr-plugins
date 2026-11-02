# Prerequisites

| Tool | Version | Needed for |
|:--|:--|:--|
| [herdr](https://herdr.dev) | 0.9.5 or newer | Every plugin. Each manifest declares `min_herdr_version = "0.9.5"`. |
| Node.js | 26 | The plugins' scripts and the setup script `scripts/herdr-setup.ts`. |
| `git` | any recent | `herdr plugin install` clones the repository; `deliver-board` reads the repository. |
| [GitHub CLI](https://cli.github.com) `gh`, logged in with `gh auth login` | any recent | `deliver-board`, `deliver-starter` (suggestions), `worktree-cleanup`. |
| PowerShell 7+ (`pwsh`) on `PATH` | 7 | `deliver-log`, `worktree-cleanup`, and the unattended mode of `deliver-starter`. |
| The `deliver` skill from [GravionLabs/skills](https://github.com/GravionLabs/skills) | current | The deliver plugins: `deliver-starter`, `deliver-log`, `deliver-view`, `deliver-board`, `review-popup`, `worktree-cleanup`. |

Not every plugin needs every tool. `command-palette`, for example, needs only herdr. The table on each [plugin page](./plugins/command-palette.md) and the overview in [Troubleshooting and FAQ](./troubleshooting.md) list what a plugin needs.

## Check your tools

```sh
herdr --version
node --version     # v26 or newer
gh auth status
pwsh --version
```

## Install the deliver skills

The deliver plugins call scripts of the `deliver` skill. Install it into your project:

```sh
npx skills add GravionLabs/skills --skill deliver
```

If `pwsh`, Git, Node or `gh` are missing, the `check-prerequisites` skill of GravionLabs/skills checks them and installs what is missing.

## Platforms

macOS and Linux are the declared platforms of the plugin manifests. Windows is not declared yet; it is tracked in the 0.5.0 milestone ([#83](https://github.com/GravionLabs/herdr-plugins/issues/83), [#86](https://github.com/GravionLabs/herdr-plugins/issues/86)). See [Compatibility](../compatibility.md).
