# link-trim

Opens links without the trailing punctuation that herdr's URL detection picks up. Agents often print a URL right before `)`, `.`, `,` or `]`; the click then opens a 404 for `https://github.com/GravionLabs/ci/pull/91)`. `link-trim` opens `https://github.com/GravionLabs/ci/pull/91` instead.

Only URLs that match the `trailing-punct` link handler (http or https, ending in `)`, `]`, `.`, `,`, `;`, `:`, `'` or `"`) are routed to the plugin. Other links open as before.

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/link-trim
```

## Requirements

- `ui.mouse_capture` must be on in herdr's `config.toml`. Without mouse capture herdr does not see the click and the link handler never runs.
- Click with **Ctrl+click**, also on macOS. herdr handles Ctrl+click on links.

## What it trims

- Trailing `.`, `,`, `;`, `:`, `'` and `"` are removed, repeatedly.
- A trailing `)` or `]` is removed only when the URL has no opening partner. `https://en.wikipedia.org/wiki/Foo_(bar)` stays unchanged.

The trimmed URL opens with `open` on macOS and `xdg-open` on Linux. If opening fails, herdr shows a notification with the URL.

## Clicking with Cmd outside herdr

Cmd+click in WezTerm is handled by WezTerm and never reaches herdr. To get the same trimming there, add a `hyperlink_rules` entry that excludes the trailing characters from the link. In `wezterm.lua`:

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

Adjust the rule if you already define `hyperlink_rules`: keep your rules and add the regex above. The regex keeps the last character out of the match when it is one of the trailing punctuation characters, so Cmd+click opens the same URL herdr would.

## Development

Trimming lives in `lib/trim.mjs` and runs without herdr. Run the tests from the repository root with `npm test`.
