# agent-notify

Notification when an agent pane turns done or blocked, so parallel sessions need no watching. An event hook on `pane.agent_status_changed` reacts to the states `done` and `blocked`; the notification names the pane and its workspace and tab, e.g. `Claude done` with `Gravion / planing`.

A pane with the token `deliver` (the `deliver` skill sets `deliver`, `deliver_step`, `deliver_pr`) is named by its tokens: `deliver #12 review: 1 blocking`, plus `(PR #34)` when `deliver_pr` is set.

The same pane and state notify once within 30 s.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/agent-notify
```

## Config

`config.json` in the plugin config directory (`herdr plugin config-dir agent-notify`). Both switches are off by default:

```json
{
  "systemNotification": false,
  "sound": false
}
```

- `systemNotification`: also a system notification: `osascript` on macOS, `notify-send` on Linux, a WinRT toast through `powershell.exe` on Windows. A missing tool leaves only the herdr notification. The old spelling `system_notification` still works but is deprecated (a warning goes to stderr) and is removed in the next major version.
- `sound`: herdr plays its `done` sound (state done) or `request` sound (state blocked) with the notification.

## Development

Event parsing in `lib/event.ts`, text in `lib/message.ts`, de-duplication in `lib/dedupe.ts` (seen state in `HERDR_PLUGIN_STATE_DIR/seen.json`), flow in `lib/notify.ts`, herdr and OS calls in `lib/host.ts`, hook `bin/changed.ts`. The hook awaits every command and starts no background process. Run the tests from the repository root with `npm test`.
