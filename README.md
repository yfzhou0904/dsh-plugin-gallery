# DSH Plugin Gallery

A personal collection of plugins for [DeepSeek Harness (DSH)](https://www.npmjs.com/package/@deepseek-ai/dsh).

> [!IMPORTANT]
> These plugins currently target DSH `0.1.0-rc.6`. DSH is prerelease software, so extension APIs and page structure may change between versions.

## Gallery

| Plugin | Package | Runtime | What it does |
|---|---|---|---|
| [Mobile Sidebar](plugins/mobile-sidebar) | `@yfzhou/dsh-mobile-sidebar` | Web client | Removes the collapsed rail on small screens and adds a hamburger beside the conversation title. |
| [Full-width Chat](plugins/full-width-chat) | `@yfzhou/dsh-full-width-chat` | Web client | Lets conversations use the full available content width. |
| [Session Cost Statusline](plugins/session-cost-statusline) | `@yfzhou/dsh-session-cost-statusline` | Web client | Adds an estimated CNY cost before the standard session statistics. |
| [Codex Moot Escalation](plugins/codex-moot-escalation) | `@yfzhou/dsh-codex-moot-escalation` | Host | Removes impossible escalation arguments for Codex sessions already running with unrestricted sandbox access. |

## Installation

Packages will be installed into a DSH profile using the DSH plugin command:

```bash
dsh plugin --profile web add @yfzhou/dsh-mobile-sidebar
```

A package must also have a row in the profile's `cordis.patch.yml` to activate it:

```yaml
- insert:
    - id: mobile-sidebar
      name: '@yfzhou/dsh-mobile-sidebar'
```

See each plugin's README for its package name and row ID. Restart a persistent DSH service after changing its profile. Browser plugins also require a page refresh after first installation or upgrade.

## Development

This is a pnpm workspace with one independently publishable package per directory.

```bash
pnpm check
pnpm pack:dry-run
```

The repository contains prebuilt plain-JavaScript client modules because DSH loads browser plugin entry points directly. There is no TypeScript or bundling step in this repository.

## Publishing status

The packages are prepared for npm publication but are not necessarily published yet. Pin exact versions in production profiles once releases exist.

## License

[MIT](LICENSE)
