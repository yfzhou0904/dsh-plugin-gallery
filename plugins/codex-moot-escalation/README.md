# `@yfzhou/dsh-codex-moot-escalation`

A narrowly scoped host plugin for Codex-backed DeepSeek Harness sessions.

Some Codex models emit optional `sandbox_permissions` and `justification` arguments whenever those fields appear in a tool schema. In a session already running with `danger-full-access`, no wider sandbox exists, so DSH rejects such an escalation before running the tool. This plugin removes those two schema fields only when:

1. the active provider is `codex`; and
2. the resolved sandbox mode is `danger-full-access`.

Other providers and sandbox modes retain DSH's native escalation behavior.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-codex-moot-escalation
```

The package supplies its own DSH bundle row; do not add a separate `cordis.patch.yml` entry.

## Security scope

This plugin does not grant permissions or change the resolved sandbox mode. It only changes schemas shown to the model after DSH has already resolved unrestricted access.

Tested with DSH `0.1.0-rc.6`. The plugin uses the `system-prompt/assemble` event and optional `sandboxPolicy` service, which may change in later DSH releases.

## License

MIT
