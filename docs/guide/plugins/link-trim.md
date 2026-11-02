# link-trim

## Purpose

`link-trim` opens a link without the trailing punctuation that herdr's URL detection picks up. Agents often print a URL right before `)`, `.`, `,` or `]`, and the click then opens a 404. The plugin runs when you click a link that matches its `trailing-punct` link handler and opens the trimmed URL instead.

Only http and https URLs ending in `)`, `]`, `.`, `,`, `;`, `:`, `'` or `"` are routed to the plugin. Other links open as before.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/link-trim
```

Requirements:

- `ui.mouse_capture` must be on in herdr's `config.toml`. Without mouse capture herdr does not see the click and the link handler never runs.
- Click with **Ctrl+click**, also on macOS. herdr handles Ctrl+click on links.
- Platforms: macOS and Linux. Minimum herdr version: 0.9.5.

## Actions, panes and events

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `link-trim.open` | Opens the trimmed URL. Reads the clicked URL that herdr passes to the link handler. |
| Link handler | `trailing-punct` | Routes http and https links ending in trailing punctuation to `link-trim.open`. |

The plugin declares no panes and no events.

The action `link-trim.open` is reachable only through the `trailing-punct` link handler, that is by Ctrl+click on a matching link. It has no input without a click, so `herdr plugin action invoke link-trim.open` by hand exits 1 and shows a "Could not open link" notification. Do not invoke it by hand.

## Keybinding

The plugin ships no default keybinding. It is triggered by Ctrl+click on a link.

## Configuration

None. The plugin reads no config file.

## Examples

Agent output ends a URL with a parenthesis:

```text
See https://github.com/GravionLabs/ci/pull/91)
```

Ctrl+click opens `https://github.com/GravionLabs/ci/pull/91`.

A URL with balanced parentheses keeps its closing parenthesis:

```text
https://en.wikipedia.org/wiki/Foo_(bar)
```

Ctrl+click opens the URL unchanged.

Trailing `.`, `,`, `;`, `:`, `'` and `"` are removed repeatedly, so `https://example.com/a.,` opens `https://example.com/a`.

Cmd+click in WezTerm is handled by WezTerm and never reaches herdr. To get the same trimming there, add a `hyperlink_rules` entry to `wezterm.lua`:

```lua
local wezterm = require 'wezterm'

return {
  hyperlink_rules = {
    -- This rule comes first, so its match wins over the default URL rule.
    {
      regex = [=[\b\w+://[^\s]*[^\s)\].,;:'"]]=],
      format = '$0',
    },
    table.unpack(wezterm.default_hyperlink_rules()),
  },
}
```

If you already define `hyperlink_rules`, keep your rules and add the regex above.

## Troubleshooting

- **Ctrl+click does nothing.** `ui.mouse_capture` is off. Turn it on in herdr's `config.toml`.
- **Cmd+click still opens the URL with the punctuation.** WezTerm handles Cmd+click, not herdr. Add the `hyperlink_rules` entry from Examples.
- **herdr shows a notification with the URL.** Opening failed, or the URL was refused. Only absolute http and https URLs without whitespace or control characters are opened. `file:`, `javascript:`, paths and a leading `-` are not passed to the opener.
- **Ctrl+click on a `file:` or path link.** Those links do not match the handler and open as before.

## Preview

```text
[screenshot placeholder: a terminal pane with the agent output
"See https://github.com/GravionLabs/ci/pull/91)" and the cursor on the link;
after Ctrl+click the browser opens https://github.com/GravionLabs/ci/pull/91]
```
