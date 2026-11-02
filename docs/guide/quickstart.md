# Quickstart

Five minutes, ending with a working command palette and a deliver board. You need herdr 0.9.5 or newer, Node.js 26 (the palette and board run `node bin/...ts`) and `git`; the board step also needs `gh` logged in ([prerequisites](./prerequisites.md)). Check with `herdr --version` and `node --version`. Replace `v0.5.0` with the latest [release](https://github.com/GravionLabs/herdr-plugins/releases).

::: warning Not yet verified on Linux and Windows
Verified on macOS only. Linux is expected to work the same; Windows is not a declared platform yet ([details](./install.md#linux-and-windows)).
:::

## 1. Install the two plugins

```sh
herdr plugin install -y --ref v0.5.0 GravionLabs/herdr-plugins/command-palette
herdr plugin install -y --ref v0.5.0 GravionLabs/herdr-plugins/deliver-board
herdr plugin list
```

Both should appear in the list. Or, from a clone of this repository: `node scripts/herdr-setup.ts install command-palette deliver-board`.

## 2. Bind keys

Add this to herdr's `config.toml` (on macOS and Linux `~/.config/herdr/config.toml`, or the path in `HERDR_CONFIG_PATH`; the Windows location is not yet verified; `node scripts/herdr-setup.ts doctor` prints the path it uses). See [Keybindings](./keybindings.md) for the full set):

```toml
[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "command-palette.open"
description = "command palette"

[[keys.command]]
key = "prefix+shift+b"
type = "plugin_action"
command = "deliver-board.open"
description = "deliver board"
```

Then check the file and reload:

```sh
herdr config check
herdr server reload-config
```

`node scripts/herdr-setup.ts apply` adds the palette key for you (with a diff and a backup), and `doctor` checks the rest. It does not add the board key.

## 3. Open the palette

Press `prefix+a`. A popup opens with a search field and a list of every plugin action. Type `board` and press Enter to run `deliver-board.open` from the palette.

Without a key you can run `herdr plugin action invoke command-palette.open`. See [command-palette](./plugins/command-palette.md).

## 4. Open the board

Focus a pane in a git repository on GitHub and press `prefix+shift+b`. The board lists the open PBIs of the repository, their claims and their pull requests into `release/next` with the check status. Outside a git repository it says so; without a `gh` login it shows one error line. See [deliver-board](./plugins/deliver-board.md).

## Next

- Install the other plugins: [Install, update and uninstall](./install.md).
- Most deliver plugins (not `deliver-board`) need the `deliver` skill: [prerequisites](./prerequisites.md#install-the-deliver-skills).
- Something not working: [Troubleshooting and FAQ](./troubleshooting.md).
