# `@yfzhou/dsh-codex-usage`

Adds a compact **Codex usage** control to the composer, shown only when the
active session runs through the `codex` provider. Clicking it fetches your
current subscription quota on demand — remaining percentage plus the reset time
in the browser's local timezone — via the package's own `/api/codex-usage` host
route. It never polls or refreshes in the background.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-codex-usage
```

Restart a persistent DSH service, then refresh the browser.

## Notes

Requires the `codex` provider configured with a Codex CLI subscription
credential, and Node.js 20+ on the host. The host reads the account file that
provider selects; no credentials are in the published package and none reach the
browser. Requests reuse `@yfzhou/dsh-llm-codex-subscription`'s transport, so
proxy behavior follows the Codex provider's own settings with no extra
configuration.

Tested with DSH `0.1.0-rc.6`.

## License

[MIT](LICENSE)
