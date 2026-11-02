# agent-notify

## Purpose

`agent-notify` notifies you when an agent pane turns `done` or `blocked`, so parallel sessions need no watching. An event hook on `pane.agent_status_changed` reacts to those two states. The notification names the pane and its workspace and tab, for example `Claude done` with `Gravion / planing`.

A pane with the token `deliver` is named by its tokens: `deliver #12 review: 1 blocking`, plus `(PR #34)` when `deliver_pr` is set. The same pane and state notify once within 30 s.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/agent-notify
```

Requirements:

- Platforms: macOS and Linux. Minimum herdr version: 0.9.5.
- The manifest lists macOS and Linux as platforms. The README also describes a Windows toast for `systemNotification` (see Configuration).

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Event | `pane.agent_status_changed` | Runs `bin/changed.ts`, which notifies on the states `done` and `blocked`. |

The plugin declares no actions, no panes and no link handlers.

## Keybinding

The plugin ships no keybinding. It has no action to bind; it runs on the event.

## Configuration

`config.json` in the plugin config directory. Find it with:

```sh
herdr plugin config-dir agent-notify
```

Both switches are off by default:

```json
{
  "systemNotification": false,
  "sound": false
}
```

- `systemNotification`: also a system notification. It uses `osascript` on macOS, `notify-send` on Linux, and a WinRT toast through `powershell.exe` on Windows. A missing tool leaves only the herdr notification.
- `sound`: herdr plays its `done` sound (state `done`) or `request` sound (state `blocked`) with the notification.

The old key `system_notification` still works but is deprecated: a warning goes to stderr. It is removed in the next major version. When both are set, `systemNotification` wins.

The file is checked against `schema/config.schema.json`. An invalid value, an unknown key or broken JSON shows the notification `agent-notify: invalid config` naming the file and the key. The invalid keys use their defaults.

## Examples

Enable both switches:

```json
{
  "systemNotification": true,
  "sound": true
}
```

Rename the deprecated key. Before:

```json
{
  "system_notification": true
}
```

After:

```json
{
  "systemNotification": true
}
```

A pane with the `deliver` tokens is named by them, for example `deliver #12 review: 1 blocking`. When `deliver_pr` is set, the notification adds `(PR #34)`.

## Troubleshooting

- **The notification shows `agent-notify: invalid config`.** The config file has broken JSON, an unknown key, or a value of the wrong type. The notification names the file and the key. Fix that key; until then the invalid keys use their defaults.
- **A warning about `system_notification` on stderr.** The key is deprecated. Rename it to `systemNotification`.
- **No system notification, only the herdr one.** `osascript`, `notify-send` or `powershell.exe` is missing from the system. Install the tool, or leave `systemNotification` off.
- **The same pane notifies only once.** It is intended: the same pane and state notify once within 30 s.

## Preview

```text
[screenshot placeholder: the herdr notification "Claude done" with the
workspace and tab "Gravion / planing", next to the macOS system notification
when systemNotification is on]
```
