# `@yfzhou/dsh-codex-moot-escalation`

Some Codex models emit `sandbox_permissions` and `justification` arguments
whenever those fields appear in a tool schema, and in a session already running
with `danger-full-access` there is no wider sandbox to escalate into, so DSH
rejects the call before the tool runs. This host plugin removes those two schema
fields, but only when the provider is `codex` and the resolved sandbox mode is
`danger-full-access`. It grants nothing and changes no sandbox mode — it only
edits schemas shown to the model after DSH has already resolved unrestricted
access.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-codex-moot-escalation
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry.

Tested with DSH `0.1.0-rc.6`; it uses the `system-prompt/assemble` event and the
optional `sandboxPolicy` service.

## License

MIT
