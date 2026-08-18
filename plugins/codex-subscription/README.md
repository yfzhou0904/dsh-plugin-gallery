# `@yfzhou/dsh-llm-codex-subscription`

Registers a `codex` LLM provider that reuses the Codex CLI's local login, so DSH
can talk to ChatGPT subscription models (`gpt-5.6-sol` and friends) with no API
key. It reads the same `~/.codex/auth.json` that `codex login` writes, fresh on
every request, so logging in or switching accounts through the CLI takes effect
immediately; expired tokens are refreshed and written back atomically, exactly
as the CLI does. Requests go to the OpenAI Responses API over SSE, with
reasoning, text, and tool calls mapped to the matching DSH blocks.

Requires Node.js 20+ and a `codex login`. Quota is metered by OpenAI per account
and shared with the Codex CLI.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-llm-codex-subscription
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry. Restart DSH and **Codex (ChatGPT subscription)**
appears in the model picker.

## Configuration

Machine-specific settings live in `$DSH_HOME/settings.yaml`, never in the
package. The ChatGPT backend usually needs a proxy, and Node's `fetch` ignores
system proxy variables:

```yaml
llm-codex-subscription:
  proxy: http://127.0.0.1:7890
  account: personal
  accounts:
    personal: ~/.codex-personal/auth.json
    work: ~/.codex-work/auth.json

agent-default-model:      # optional: make Codex the default
  provider: codex
  model: gpt-5.6-sol
```

| Key | Effect |
| --- | --- |
| `proxy` | Takes precedence over `HTTPS_PROXY`, then `HTTP_PROXY`; `NO_PROXY` hosts connect directly. |
| `accounts` / `account` | Your own aliases for separate auth files, and which one is live. Switching applies to the next request; refreshes only write to the selected file. Not OpenAI's `account_id` — that still comes from the file's `tokens.account_id`. |
| `authFile` | Single auth file, when `accounts` is unset. Defaults to `~/.codex/auth.json`. |
| `writeBack` | `false` keeps refreshed tokens in memory instead of updating `auth.json`. |
| `staticModels` / `modelsCacheFile` | Override the catalog, which otherwise comes from the API, then `~/.codex/models_cache.json`, then a built-in list. |
| `clientVersion` | Version string sent upstream. |

The section hot-reloads. Image attachments are sent as Responses API
`input_image` data URLs, with the local `attachment-local` pixel ceiling raised
to 200,000,000 — upstream limits still apply.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `MISSING_CREDENTIAL` | Run `codex login`. |
| `TRANSPORT: Connect Timeout` | Backend unreachable directly; configure `proxy`. |
| HTTP 401 after a failed refresh | Subscription expired or flagged; `codex login` again. |
| HTTP 429 | Quota or rate limit; retry later. |
| Empty model list | Live discovery failed with no cache; the static list is used. |
| `INVALID_REQUEST: Unsupported parameter` | The adapter strips parameters the subscription backend rejects; upgrade the plugin. |

## License

[MIT](LICENSE)
