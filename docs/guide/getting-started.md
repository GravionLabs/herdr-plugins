# Getting started

This section takes you from nothing to a working command palette and deliver board in about five minutes.

1. [Prerequisites](./prerequisites.md): herdr, Node, `gh`, `pwsh` and the `deliver` skills.
2. [Install, update and uninstall](./install.md): all plugins or a single one, on macOS, Linux and Windows.
3. [Quickstart](./quickstart.md): install `command-palette` and `deliver-board`, bind a key, open both.

## What the plugins are

Each plugin in this repository is a separate herdr plugin that you install on its own. They add actions (run from a keybinding, the command palette or `herdr plugin action invoke <plugin>.<action>`), popups and panes to herdr. [Plugins](../plugins/index.md) lists them and each has its own page under [Plugin pages](./plugins/link-trim.md).

The plugins version independently and are released together as repository tags such as `v0.4.0`. Always install a release tag. Without a tag, herdr installs the default branch, which is unreleased.

## The shortcut: the setup script

A clone of this repository contains a setup script that checks your machine, adds the `config.toml` blocks the plugins rely on and installs the plugins at the latest release tag. It needs Node 26.

```sh
node scripts/herdr-setup.ts doctor    # check herdr and this machine, changes nothing
node scripts/herdr-setup.ts apply     # add the missing config.toml blocks (diff, backup, asks first)
node scripts/herdr-setup.ts install   # install all plugins at the latest release tag
```

See `node scripts/herdr-setup.ts --help` for all flags, and [herdr settings the plugins rely on](https://github.com/GravionLabs/herdr-plugins#herdr-settings-the-plugins-rely-on) in the README for what `apply` writes.

::: warning Not yet verified on Linux and Windows
The commands in this section were verified on macOS with herdr 0.9.5. They are expected to behave the same on Linux, but the owner has not verified that yet. Windows is not a declared platform yet. See [Install, update and uninstall](./install.md#linux-and-windows).
:::
