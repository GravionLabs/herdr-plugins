# Compatibility matrix and deprecation policy

This page lists what each release of this repository supports and how a deprecation is announced and removed. The public surface itself (IDs, config keys, state files, event behaviour) is defined in [ADR 0001](adr/0001-public-api.md); the bump rules are in its "Versioning rules" table.

## Compatibility matrix

Every plugin in the repository is released as one unit, so one row applies to all plugins. A cell marked "unverified" could not be confirmed from the repository at the time of writing.

| Release | herdr | Node.js | OS (manifests `platforms`) | OS (CI and pre-release checks) | GravionLabs/skills |
|:--|:--|:--|:--|:--|:--|
| `0.4.0` (current, `release/next`) | `>= 0.9.5` (`min_herdr_version` in every `herdr-plugin.toml`) | `>= 26` (`engines.node` in `package.json`, `.nvmrc` `26`, CI `node-version: '26'`) | macOS, Linux | Test matrix on Ubuntu, macOS and Windows (`.github/workflows/ci.yml`); Windows is a pre-release check only until #86 adds `windows` to `platforms` | `deliver` skill, unpinned (installed with `npx skills add GravionLabs/skills --skill deliver`); `review-popup/schema/` copies GravionLabs/skills commit `d6953b2` |
| `0.3.0` and earlier | unverified | unverified | unverified | unverified | unverified |

Notes on the rows:

- **herdr**: `0.9.5` is the minimum any plugin declares. Plugins do not declare a maximum.
- **Node.js**: the runtime strips TypeScript types at run time, so the Node version is part of the contract. The `engines` field, `.nvmrc` and CI must name the same major version.
- **OS**: `platforms` in the manifests is what `herdr plugin install` checks. Windows is not a declared platform yet; see the Windows note in [acceptance.md](acceptance.md).
- **GravionLabs/skills**: only the `deliver` skill is used at run time (by `deliver-log`, `deliver-starter` in unattended mode, and the `deliver` pane tokens read by `deliver-view`). `review-popup` uses JSON schemas copied from GravionLabs/skills at the commit named in [`review-popup/schema/SOURCE.md`](../review-popup/schema/SOURCE.md); they are not fetched at build time. No skills version is pinned in the plugin manifests, so a skills release is compatible when it keeps the `deliver` skill's scripts and pane tokens and the review schemas this repository copied.

When a release changes any cell, update the row of that release in the same pull request and name the change in the release notes.

## Deprecation policy

The rules come from [ADR 0001](adr/0001-public-api.md):

1. A public item (plugin, action, pane, event or link handler ID, `config.json` key, state file, or documented event behaviour) is removed or renamed only in a **major** release.
2. A deprecation is announced in a **minor** release. The old name keeps working for at least one minor release before the major that removes it.
3. The announcement is a notification to the user, given in all of these places:
   - the manifest title of the deprecated item, which says "deprecated" and names the replacement (for example `deliver-log`, action `toggle-log`: "Toggle the deliver log pane (deprecated, use toggle)");
   - a comment in `herdr-plugin.toml` next to the item;
   - the plugin README, which states that the old name still works and when it is removed;
   - the CHANGELOG and the release notes of the minor release.
4. The removal lands in the next major release and is listed under its breaking changes. The deprecated item is then deleted together with its tests.

Examples of changes and their bump, taken from ADR 0001: a new action or config key with a default is minor; a rename of a plugin ID is major; a higher `min_herdr_version` or a newer Node version that drops no supported OS is minor and called out in the release notes; dropping a supported OS is major.

Until the first major release (1.0.0), renames are planned before 1.0.0 so that they do not become breaking changes afterwards (ADR 0001, Consequences).
