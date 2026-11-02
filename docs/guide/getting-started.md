# Getting started

This section takes you from nothing to a working command palette and deliver board in about five minutes.

1. [Prerequisites](./prerequisites.md): herdr, Node, `gh`, `pwsh` and the `deliver` skills.
2. [Install, update and uninstall](./install.md): all plugins or a single one, on macOS, Linux and Windows.
3. [Quickstart](./quickstart.md): install `command-palette` and `deliver-board`, bind a key, open both.

## What the plugins are

Each plugin in this repository is a separate herdr plugin that you install on its own. They add actions (run from a keybinding, the command palette or `herdr plugin action invoke <plugin>.<action>`), popups and panes to herdr. [Plugins](../plugins/index.md) lists them and each has its own page under [Plugin pages](./plugins/link-trim.md).

The plugins version independently and are released together as repository tags such as `v0.5.0`. Always install a release tag. Without a tag, herdr installs the default branch, which is unreleased.

## The shortcut: the setup script

A clone of this repository contains a setup script that checks your machine, adds the `config.toml` blocks the plugins rely on and installs the plugins at the latest release tag. It needs Node 26.

```sh
node scripts/herdr-setup.ts doctor    # check herdr and this machine, changes nothing
node scripts/herdr-setup.ts apply     # add the missing config.toml blocks (diff, backup, asks first)
node scripts/herdr-setup.ts install   # install all plugins at the latest release tag
```

See `node scripts/herdr-setup.ts --help` for all flags, and [herdr settings the plugins rely on](https://github.com/GravionLabs/herdr-plugins#herdr-settings-the-plugins-rely-on) in the README for what `apply` writes.

### doctor: check, change nothing

`doctor` only reads: it asks `herdr --version`, `herdr plugin list --json` and `gh auth status`, and reads `config.toml`. It exits with 1 when a check fails and prints a `hint:` line for it. `--json` prints the checks as JSON.

```text
$ node scripts/herdr-setup.ts doctor
ok   herdr: 0.9.5
ok   node: v26.13.0
ok   pwsh: 7.5.4
ok   gh: gh version 2.103.3 (2026-10-26)
ok   gh login: logged in
ok   deliver skill: ~/.claude/skills/deliver
ok   ui.toast.delivery: herdr
ok   ui.mouse_capture: true
ok   sidebar rows: name $deliver
ok   plugins: agent-notify enabled v0.5.0; command-palette enabled v0.5.0; ...
ok   config: ~/.config/herdr/config.toml
```

### apply: add the config.toml blocks

`apply` adds the blocks the plugins rely on to herdr's `config.toml`: toast delivery, the "space first" sidebar rows and keys for `deliver-starter.start`, `deliver-log.toggle` and `command-palette.open`. It shows a diff, writes a backup `config.toml.bak-<timestamp>`, asks, writes, then runs `herdr server reload-config`. It never overwrites a key you already set (a different value is only a hint), except `ui.toast.delivery = "off"`.

- `--dry-run` shows the diff and changes nothing.
- `--yes` skips the question.

The output of `HERDR_CONFIG_PATH=~/herdr-test.toml node scripts/herdr-setup.ts apply --dry-run` for a config that does not exist yet (the diff is cut):

```text
would change in ~/herdr-test.toml:
  - add [ui.toast] delivery = "herdr"
  - add [ui.sidebar.agents] with the "space first" rows
  - bind prefix+d to deliver-starter.start
  - bind prefix+shift+o to deliver-log.toggle
  - bind prefix+a to command-palette.open

--- ~/herdr-test.toml
+++ ~/herdr-test.toml (after apply)
@@ -1,0 +1,27 @@
+[ui.toast]
+delivery = "herdr"
...
```

### install: install the plugins at a release tag

`install [<plugin>...]` runs `herdr plugin install -y --ref <tag> GravionLabs/herdr-plugins/<plugin>` for all or the named plugins. The tag is the latest GitHub release, or the one you pass with `--ref <tag>`. A plugin that does not exist at the tag (for example `repo-open` at `v0.4.0`) is listed as `skipped (not in <tag>)` and left out without an error; naming such a plugin yourself is an error and exits 1. `--dry-run` only shows the plan and installs nothing.

```text
$ node scripts/herdr-setup.ts install --dry-run
Plan: install at v0.5.0
  agent-notify: v0.5.0 -> v0.5.0
  ...
  link-trim: not installed -> v0.5.0
  ...
dry run: nothing installed
```

::: warning Not yet verified on Linux and Windows
The commands in this section were verified on macOS with herdr 0.9.5. They are expected to behave the same on Linux, but the owner has not verified that yet. Windows is not a declared platform yet. See [Install, update and uninstall](./install.md#linux-and-windows).
:::
