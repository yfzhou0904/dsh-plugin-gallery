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
| [Composer Enter](plugins/composer-enter) | `@yfzhou/dsh-composer-enter` | Web client | Makes Enter insert newlines and Cmd/Ctrl+Enter submit. |
| [Touch Tooltips](plugins/touch-tooltips) | `@yfzhou/dsh-touch-tooltips` | Web client | Suppresses tooltip bubbles on touch devices, where a tap would otherwise leave them stuck on screen. |
| [Codex Moot Escalation](plugins/codex-moot-escalation) | `@yfzhou/dsh-codex-moot-escalation` | Host | Removes impossible escalation arguments for Codex sessions already running with unrestricted sandbox access. |
| [Codex Subscription](plugins/codex-subscription) | `@yfzhou/dsh-llm-codex-subscription` | Host | Adds a Codex provider that reuses the local Codex CLI login for ChatGPT subscription models. |
| [Codex Usage](plugins/codex-usage) | `@yfzhou/dsh-codex-usage` | Host + Web client | Shows manual Codex subscription usage and reset time inside Codex conversations. |

## Installation

Install a plugin into a DSH profile using the DSH plugin command:

```bash
dsh plugin --profile web add @yfzhou/dsh-mobile-sidebar
```

Every gallery package is a self-contained DSH bundle. The command installs the dependency and automatically adds its `cordis.bundle.yml` patch to the profile's `dsh.profile.bundles` stack. Do not add a duplicate row to `cordis.patch.yml`.

For local development, pass the plugin directory instead:

```bash
dsh plugin --profile web add ./plugins/mobile-sidebar
```

Upgrade installed plugins with `dsh plugin --profile web update`. Restart a persistent DSH service after changing its profile. Browser plugins also require a page refresh after first installation or upgrade.

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
