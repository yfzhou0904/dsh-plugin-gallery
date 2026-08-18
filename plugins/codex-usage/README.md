# `@yfzhou/dsh-codex-usage`

Shows the current Codex subscription usage inside Codex conversations.

The plugin adds a compact **Codex usage** control to the composer only when the
active session is routed through the `codex` provider. It is hidden for other
providers and when no session is open. Clicking the control fetches the current
quota on demand and shows remaining percentage plus the precise reset date and
time in the browser's local timezone.

## Requirements

- DSH Web with the `codex` provider installed and configured.
- A Codex CLI ChatGPT subscription credential in the configured account file.
- Node.js 20 or newer on the DSH host.

The host reads the account configured for the local DSH installation. The
published package does not include credentials or tokens. If the Codex provider
has an `account` plus `accounts` configuration, that selected account file is
used; otherwise the standard Codex home auth file is used.

The browser talks to the package's ordinary Host route at `/api/codex-usage`;
it does not depend on dynamic Cordis `harness` globals.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-codex-usage
```

For local development:

```bash
dsh plugin --profile web add ./plugins/codex-usage
```

Restart a persistent DSH service after installation, then refresh the browser
page. The usage request is manual only: the plugin does not poll or refresh in
the background.

## License

[MIT](LICENSE)
