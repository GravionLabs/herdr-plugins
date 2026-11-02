# <plugin-id>

<!--
Plugin page template (#98). Copy this file to docs/guide/plugins/<plugin-id>.md and
replace every <placeholder>. This file is excluded from the site (srcExclude in
apps/site/.vitepress/config.ts). Keep the sections in this order; write "None." when a
section does not apply, never delete it. Every statement must match the plugin's README,
herdr-plugin.toml and config schema.
-->

## Purpose

<One or two sentences: what the plugin does for the user, and when it runs. Name the trigger (a click, a status change, an action invoked by hand).>

## Install

```bash
herdr plugin install GravionLabs/herdr-plugins/<plugin-id>
```

<Requirements the user must meet, e.g. herdr settings, platforms (from `platforms` in herdr-plugin.toml) and `min_herdr_version`. Write "None beyond herdr <min_herdr_version>." if there are none.>

## Actions, panes and events

<Table of the public names from herdr-plugin.toml and docs/naming.md. Write "None." for an empty kind.>

| Kind | Name | What it does |
| --- | --- | --- |
| Action | `<plugin-id>.<action>` | <what it does> |
| Pane | `<pane-id>` | <what it shows> |
| Event | `<event name>` | <when it runs> |
| Link handler | `<handler-id>` | <which links it takes> |

<!-- Keep this snippet only for an action that runs without input (no clicked URL or other
payload from a link handler). For an action that needs a click or an event, delete the
snippet and state in the table row how it is reached instead. -->

Invoke an action without a keybinding:

```sh
herdr plugin action invoke <plugin-id>.<action>
```

## Keybinding

<State whether the manifest ships a default keybinding. If none, say so and show how to bind `<plugin-id>.<action>` in herdr's own config, only if the plugin README documents it. Do not invent key names.>

## Configuration

<Where the config file lives (`herdr plugin config-dir <plugin-id>`), the keys with their defaults and meaning, and the schema file. Write "None." if the plugin reads no config.>

```json
{
  "<key>": "<default>"
}
```

## Examples

<Two or three concrete cases taken from the README: input, what happens. Use real URLs or states, not invented output.>

## Troubleshooting

<Symptom, then cause, then fix, as a short list. Cover the failure notifications the README names and the requirements from Install.>

- **<Symptom>.** <Cause and fix.>

## Preview

<Placeholder, no invented image. Describe what the user sees, in text, inside a block.>

```text
[screenshot placeholder: <what the screenshot would show>]
```
