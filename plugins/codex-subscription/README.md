# `@yfzhou/dsh-llm-codex-subscription`

An LLM provider plugin that reuses the Codex CLI's local login, so DSH can talk
to ChatGPT subscription models (`gpt-5.6-sol` and friends) without an API key.

`codex login` writes a ChatGPT OAuth token to `~/.codex/auth.json` (or
`CODEX_HOME`). This plugin reads the same file and registers a `codex` provider
against the OpenAI Responses API. Credentials are read fresh on every request,
so logging in, switching accounts, or logging out through the CLI takes effect
on the next DSH request with no restart.

| Credential | Endpoint |
| --- | --- |
| `tokens` (`auth_mode: chatgpt`) | `https://chatgpt.com/backend-api/codex/responses` |
| `OPENAI_API_KEY` (`auth_mode: apikey`) | `https://api.openai.com/v1/responses` |

When an access token expires the plugin refreshes it via
`auth.openai.com/oauth/token` and retries the request once. The refreshed token
is written back to `auth.json` atomically, matching Codex CLI behavior, so both
sides stay in sync; set `writeBack: false` to keep refreshes in memory only.

The model catalog comes from `GET {base}/codex/models`, falling back to
`~/.codex/models_cache.json` and then to a built-in static list. Responses are
streamed as SSE; reasoning summaries, text, and tool calls map to DSH's
reasoning, text, and tool-call blocks, and usage is read from
`response.completed`.

## Requirements

- Node.js 20 or newer on the DSH host.
- A Codex CLI ChatGPT subscription login (`codex login`).

Subscription quota is metered by OpenAI per account and shared with the Codex
CLI.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-llm-codex-subscription
```

For local development:

```bash
dsh plugin --profile web add ./plugins/codex-subscription
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry. Restart DSH, and **Codex (ChatGPT subscription)**
appears in the web model picker.

## Configuration

Machine-specific settings live in `$DSH_HOME/settings.yaml` and are never part
of the package. The ChatGPT backend usually needs a proxy, and Node's native
`fetch` does not read system proxy variables:

```yaml
llm-codex-subscription:
  proxy: http://127.0.0.1:7890
  account: personal
  accounts:
    personal: ~/.codex-personal/auth.json
    work: ~/.codex-work/auth.json
```

An explicit `proxy` takes precedence over `HTTPS_PROXY`, then `HTTP_PROXY`;
`NO_PROXY` hosts connect directly. Other optional fields: `clientVersion`,
`writeBack`, `authFile`, `modelsCacheFile`, and `staticModels`. The settings
section hot-reloads.

`accounts` maps your own aliases to separate `auth.json` files, and `account`
selects one; switching it applies to the next request, with no copying back to
`~/.codex/auth.json`. Token refreshes only ever write to the selected file. This
`account` is a local alias, not OpenAI's `account_id` — that is still read from
the chosen file's `tokens.account_id`. Without `accounts`, `authFile` or the
default `~/.codex/auth.json` is used.

To make Codex the default model:

```yaml
agent-default-model:
  provider: codex
  model: gpt-5.6-sol
  reasoningEffort: medium
```

## Attachments

Image attachments are encoded as Responses API `input_image` data URLs. The
local `attachment-local` pixel ceiling is raised to 200,000,000; the upstream
provider still enforces its own pixel, dimension, and file size limits.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `MISSING_CREDENTIAL` | Run `codex login`. |
| `TRANSPORT: Connect Timeout` | The ChatGPT backend is unreachable directly; configure `proxy`. |
| HTTP 401 after a failed refresh | The subscription expired or was flagged; run `codex login` again. |
| HTTP 429 | Subscription quota or rate limit; retry later. |
| Empty model list | Live discovery failed and no `models_cache.json` exists; the static list is used. |
| `INVALID_REQUEST: Unsupported parameter` | The adapter already strips parameters the subscription backend rejects; upgrade the plugin if this appears. |

## License

[MIT](LICENSE)
