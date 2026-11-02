# Install, update and uninstall

::: warning Not yet verified on Linux and Windows
All commands below were verified on macOS with herdr 0.9.5. The herdr CLI syntax is the same on every OS, but the owner has not run them on Linux or Windows yet. Windows is not a declared platform: the manifests list `macos` and `linux`, so `herdr plugin install` may refuse a plugin there. Windows support is tracked in the 0.6.0 milestone ([#83](https://github.com/GravionLabs/herdr-plugins/issues/83), [#86](https://github.com/GravionLabs/herdr-plugins/issues/86)).
:::

Check the [prerequisites](./prerequisites.md) first.

## Install a single plugin

```sh
herdr plugin install -y --ref v0.5.0 GravionLabs/herdr-plugins/<plugin>
```

- Replace `v0.5.0` with the [release](https://github.com/GravionLabs/herdr-plugins/releases) you want, and `<plugin>` with a plugin name such as `command-palette`.
- `v0.5.0` is the first release with `repo-open`, the setup script and `deliver-log.toggle`; older tags lack them.
- Do not leave out `--ref`. Without it herdr installs the default branch, which is unreleased.
- The `<plugin>@<ref>` shorthand does not work. Use `--ref`.
- `--ref` takes a tag, a branch or a full 40-character commit SHA. A short SHA fails.
- Use `-y` in scripts; `update` without a terminal fails without it.

Show what is installed and from which ref:

```sh
herdr plugin list
herdr plugin list --json
```

## Install all plugins

With the setup script (from a clone of this repository, Node 26):

```sh
node scripts/herdr-setup.ts install                 # all plugins at the latest release tag
node scripts/herdr-setup.ts install link-trim       # only the named plugins
node scripts/herdr-setup.ts install --ref v0.5.0    # a specific tag
node scripts/herdr-setup.ts install --dry-run       # only show the plan
```

It runs the `herdr plugin install -y --ref` command above for each plugin. A plugin that is not in the tag (for example `repo-open` at `v0.4.0`) is shown as `skipped (not in <tag>)` and left out without an error; naming such a plugin yourself exits 1. Without the script, run that command once per plugin.

## Update

To move to another release, install again with the new tag. The plugin is replaced in place and its config is kept:

```sh
herdr plugin install -y --ref v0.5.0 GravionLabs/herdr-plugins/<plugin>
```

`herdr plugin update -y [<plugin>...]` is meant for plugins installed from a branch or the default branch; a tag or commit pin is not expected to move. Both are expected from how update works but not verified (a pinned plugin reported "already up to date"). Without a terminal, `update` requires `-y`.

## Uninstall

```sh
herdr plugin uninstall <plugin>
```

This keeps the plugin's config directory, so a later reinstall finds your settings. It also leaves the downloaded checkout (about 1.3 MB) under herdr's `plugins/github-installations` folder; delete it by hand if you want the disk space back. Keybindings you added to `config.toml` stay too: remove them yourself.

## Linux and Windows

- **Linux:** use the same commands. Expected to work like macOS; not yet verified.
- **Windows:** not a declared platform yet. `herdr plugin install` may refuse the plugins because the manifests do not list `windows`; this was not tested. The paths of herdr's config and plugin folders on Windows are not documented here because they have not been verified.

If something fails, see [Troubleshooting and FAQ](./troubleshooting.md).
