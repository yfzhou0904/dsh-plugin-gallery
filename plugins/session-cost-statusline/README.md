# `@yfzhou/dsh-session-cost-statusline`

Adds an estimated session cost in CNY before the standard DeepSeek Harness composer statistics.

The plugin registers a durable `sessionCost` projection on the host. It folds each logged request step and prices each `assistant/message.usage` record using the model from its `request/header`. The client only renders that projection, so totals replay for existing sessions and remain correct when a session changes models.

It currently recognizes selected DeepSeek V4 and GPT-5.6 models. Usage from an unknown model is deliberately omitted rather than priced with an unrelated fallback, so the displayed figure is a lower-bound operational estimate rather than billing authority.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-session-cost-statusline
```

The package supplies its own DSH bundle row; do not add a separate `cordis.patch.yml` entry.

## Runtime requirements

- Host service: `sessionProjections`
- Client service: `slots`
- Client slot: `conversation.composer.dock`
- Tested with DSH `0.1.0-rc.6`

DeepSeek V4 uses the published effective-dated schedule from the [DeepSeek pricing documentation](https://api-docs.deepseek.com/zh-cn/quick_start/pricing): starting 2026-08-17 00:00 Beijing time, peak hours are 09:00–12:00 and 14:00–18:00, with all other hours off-peak. Per million tokens, Flash is ¥1.50/¥0.05/¥4.50 off-peak and ¥3.00/¥0.10/¥9.00 peak; Pro is ¥4.50/¥0.15/¥13.50 off-peak and ¥9.00/¥0.30/¥27.00 peak (uncached input/cache-hit input/output). Sessions before that effective time use the then-published fixed prices: Flash ¥1/¥0.02/¥2 and Pro ¥3/¥0.025/¥6.

The fold prices each model request separately: model switches are attached to the step that uses the header, and every step selects peak/off-peak from its own persisted request start (`request/header`, or `step/start` when the header is unchanged), using Beijing time explicitly. It does not split a request that crosses a pricing boundary; all of that request's tokens use the bucket at request start. Pricing changes over time; review the embedded rate table before relying on the displayed amount.

## License

MIT
